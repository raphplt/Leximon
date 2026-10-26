import type { GameEvent, MailLetter, UnsubscribeStopped } from "@leximon/contract";
import {
  capacityAt,
  computeRefill,
  type EpochMs,
  gameDayOf,
  gameHourOf,
  isLastReminder,
  NOTIFY_SCHEDULE,
  notifyRulesAt,
  REFILL_SCHEDULE,
  reminderSeenDays,
  reminderStep,
  sendableAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { letterView } from "@leximon/view-model";
import { eq, inArray, lt, sql } from "drizzle-orm";
import { EmailSendError } from "../account/email-sender";
import { unsubscribeLinks } from "../campaigns/delivery";
import { createUnsubscribeSigner } from "../campaigns/signatures";
import { SITE_URL } from "../email/layout";
import {
  NEWS_LINES,
  type NotificationEmail,
  renderNewsEmail,
  renderReminderEmail,
} from "../email/notifications";
import { readMail } from "../mail/mail";
import { purgeRows } from "../purge";
import { createNotificationMailer, type NotificationMailer } from "./mailer";

/**
 * E-mails that bring a player back: news when letters wait unread, a reminder when the player
 * stays away while their sachets are full. The queue only carries player ids: who gets what is
 * read from the database when the e-mail would leave, and a row claimed before sending makes a
 * replayed message send nothing twice.
 */

const { cards, notificationEmails, userPreferences } = schema;

/** Erased after this long: the unsubscribe links of older e-mails lead nowhere. */
export const NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
/** Players per `reminders_due` message. */
const REMINDER_CHUNK = 50;

/** Letters worth an e-mail: someone waits for an answer, or answered. */
const NEWS_KINDS = [
  "friend_request",
  "offer_received",
  "offer_completed",
  "clan_mention",
  "clan_request",
] as const satisfies readonly MailLetter["kind"][];
type NewsKind = (typeof NEWS_KINDS)[number];

const isNewsKind = (kind: MailLetter["kind"]): kind is NewsKind =>
  (NEWS_KINDS as readonly string[]).includes(kind);

export type NotificationKind = "news" | "reminder";

export interface NotifyContext {
  readonly db: Database;
  readonly mailer: NotificationMailer;
  /** Signs the unsubscribe links. */
  readonly linkSecret: string;
  readonly webUrl: string;
  readonly apiUrl: string;
  /** E-mails per day in Paris, all players together. */
  readonly dailyLimit: number;
}

export interface NotifyReport {
  readonly sent: number;
  /** Nothing to say anymore, or the player turned the e-mails off or came back. */
  readonly skipped: number;
  /** Already written to today, or the day's budget is spent. */
  readonly capped: number;
  readonly failed: number;
  /** News checks put off until the quiet hours end. */
  readonly deferred: { readonly userIds: readonly string[]; readonly delaySeconds: number } | null;
}

/**
 * What sending needs in this environment, or `null` when notifications are off: no sender, no
 * link secret, or no daily budget. Nothing is scheduled then.
 */
export function notifyContext(env: Env, db: Database): NotifyContext | null {
  const mailer = createNotificationMailer(env);
  const linkSecret = env.EMAIL_LINK_SECRET?.trim() ?? "";
  const dailyLimit = Number.parseInt(env.NOTIFY_DAILY_LIMIT, 10);
  if (mailer === null || linkSecret === "" || !(dailyLimit > 0)) return null;
  return {
    db,
    mailer,
    linkSecret,
    webUrl: env.PUBLIC_WEB_URL,
    apiUrl: env.BETTER_AUTH_URL,
    dailyLimit,
  };
}

// --- Scheduling ---------------------------------------------------------------------------------

/** The newest letter id: the letters written after it are the ones a batch of events added. */
export async function lastLetterId(db: Database): Promise<number> {
  const result = await db.execute<{ id: number }>(
    sql`select coalesce(max(id), 0)::int as id from mail_letters`,
  );
  return result.rows[0]?.id ?? 0;
}

/** Players who got a letter worth an e-mail after `afterId`. */
export async function playersWithNews(db: Database, afterId: number): Promise<string[]> {
  const result = await db.execute<{ user_id: string }>(sql`
    select distinct user_id from mail_letters
    where id > ${afterId} and kind in (${sql.join(
      NEWS_KINDS.map((kind) => sql`${kind}`),
      sql`, `,
    )})`);
  return result.rows.map((row) => row.user_id);
}

/** The `news_due` messages for new letters, after the delay that lets an active player read them. */
export function newsChecks(
  userIds: readonly string[],
  now: EpochMs,
): { readonly body: GameEvent; readonly delaySeconds: number }[] {
  const delaySeconds = Math.round(notifyRulesAt(NOTIFY_SCHEDULE, now).newsDelayMs / 1000);
  return userIds.map((userId) => ({ body: { type: "news_due", userId }, delaySeconds }));
}

/** Whether a scheduled run at `now` is the one of the evening reminders, in Paris. */
export function isReminderHour(now: EpochMs): boolean {
  return gameHourOf(now) === notifyRulesAt(NOTIFY_SCHEDULE, now).reminderHour;
}

/**
 * The evening run: the players whose absence reaches a reminder day today, not written to yet,
 * as `reminders_due` messages. Everything is checked again when each e-mail leaves.
 */
export async function remindersDue(db: Database, now: EpochMs): Promise<GameEvent[]> {
  const rules = notifyRulesAt(NOTIFY_SCHEDULE, now);
  const today = gameDayOf(now).key;
  const days = reminderSeenDays(rules, now);
  const result = await db.execute<{ id: string }>(sql`
    select u.id from users u
    left join players p on p.user_id = u.id
    left join user_preferences pr on pr.user_id = u.id
    where not u.is_anonymous and u.email_verified and not coalesce(u.banned, false)
      and coalesce(pr.email_reminders, true)
      and (coalesce(p.last_seen_at, u.created_at) at time zone 'Europe/Paris')::date
        = any(${`{${days.join(",")}}`}::date[])
      and not exists (select 1 from notification_emails n
        where n.user_id = u.id and n.kind = 'reminder' and n.day = ${today})
    order by u.id`);
  const ids = result.rows.map((row) => row.id);
  const messages: GameEvent[] = [];
  for (let i = 0; i < ids.length; i += REMINDER_CHUNK) {
    const [first, ...rest] = ids.slice(i, i + REMINDER_CHUNK);
    if (first !== undefined) messages.push({ type: "reminders_due", userIds: [first, ...rest] });
  }
  return messages;
}

// --- Sending ------------------------------------------------------------------------------------

interface Recipient {
  readonly id: string;
  readonly email: string;
  readonly lastSeenAt: EpochMs;
  /** The last e-mail of any kind that left: letters older than it were already told. */
  readonly notifiedAt: EpochMs | null;
  readonly emailNews: boolean;
  readonly emailReminders: boolean;
  readonly notifyTrades: boolean;
  readonly notifyClanMentions: boolean;
  readonly notifyReviews: boolean;
}

/**
 * The players an e-mail may reach, in one query: accounts with a checked address, not banned,
 * whose address never bounced nor complained.
 */
async function readRecipients(db: Database, userIds: readonly string[]): Promise<Recipient[]> {
  if (userIds.length === 0) return [];
  const result = await db.execute<{
    id: string;
    email: string;
    last_seen_at: Date | string;
    notified_at: Date | string | null;
    email_news: boolean;
    email_reminders: boolean;
    notify_trades: boolean;
    notify_clan_mentions: boolean;
    notify_reviews: boolean;
  }>(sql`
    select u.id, u.email, coalesce(p.last_seen_at, u.created_at) as last_seen_at,
      (select max(n.sent_at) from notification_emails n
        where n.user_id = u.id and n.status = 'sent') as notified_at,
      coalesce(pr.email_news, true) as email_news,
      coalesce(pr.email_reminders, true) as email_reminders,
      coalesce(pr.notify_trades, true) as notify_trades,
      coalesce(pr.notify_clan_mentions, true) as notify_clan_mentions,
      coalesce(pr.notify_reviews, true) as notify_reviews
    from users u
    left join players p on p.user_id = u.id
    left join user_preferences pr on pr.user_id = u.id
    where u.id in (${sql.join(
      userIds.map((id) => sql`${id}`),
      sql`, `,
    )})
      and not u.is_anonymous and u.email_verified and not coalesce(u.banned, false)
      and not exists (select 1 from email_suppressions s
        where s.email = lower(u.email) and s.reason in ('hard_bounce', 'complaint'))`);
  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    lastSeenAt: new Date(row.last_seen_at).getTime(),
    notifiedAt: row.notified_at === null ? null : new Date(row.notified_at).getTime(),
    emailNews: row.email_news,
    emailReminders: row.email_reminders,
    notifyTrades: row.notify_trades,
    notifyClanMentions: row.notify_clan_mentions,
    notifyReviews: row.notify_reviews,
  }));
}

/** Whether the player asked to be told about this kind of letter. */
function wantsLetter(recipient: Recipient, kind: NewsKind): boolean {
  switch (kind) {
    case "offer_received":
    case "offer_completed":
      return recipient.notifyTrades;
    case "clan_mention":
      return recipient.notifyClanMentions;
    case "friend_request":
    case "clan_request":
      return true;
  }
}

/**
 * Takes the player's e-mail of this kind for the day, within the day's budget. `null`: already
 * taken (a replayed message, or a second e-mail the same day) or the budget is spent.
 */
async function claim(
  ctx: NotifyContext,
  userId: string,
  kind: NotificationKind,
  now: EpochMs,
): Promise<string | null> {
  const day = gameDayOf(now).key;
  const result = await ctx.db.execute<{ id: string }>(sql`
    insert into notification_emails (user_id, kind, day, created_at)
    select ${userId}, ${kind}, ${day}, ${new Date(now)}
    where (select count(*) from notification_emails where day = ${day}) < ${ctx.dailyLimit}
    on conflict (user_id, kind, day) do nothing
    returning id`);
  return result.rows[0]?.id ?? null;
}

type SendOutcome = "sent" | "failed" | "quota";

/**
 * Sends a claimed e-mail and writes the outcome on its row. A failed e-mail is not tried again:
 * a duplicate would cost more than a missed one, and the letters stay in the game.
 */
async function sendClaimed(
  ctx: NotifyContext,
  recipient: Recipient,
  id: string,
  render: (links: ReturnType<typeof unsubscribeLinks>) => NotificationEmail,
  sign: (id: string) => Promise<string>,
  now: EpochMs,
): Promise<SendOutcome> {
  const links = unsubscribeLinks(
    { linkSecret: ctx.linkSecret, webUrl: ctx.webUrl, apiUrl: ctx.apiUrl },
    await sign(id),
  );
  let error: EmailSendError | null = null;
  try {
    await ctx.mailer.send(recipient.email, render(links));
  } catch (caught) {
    if (!(caught instanceof EmailSendError)) throw caught;
    error = caught;
  }
  await ctx.db
    .update(notificationEmails)
    .set(
      error === null
        ? { status: "sent", sentAt: new Date(now) }
        : { status: "failed", lastError: error.code },
    )
    .where(eq(notificationEmails.id, id));
  if (error === null) return "sent";
  console.warn("Notification e-mail refused", { kind: error.kind, code: error.code });
  return error.code === "E_DAILY_LIMIT_EXCEEDED" || error.code === "E_RATE_LIMIT_EXCEEDED"
    ? "quota"
    : "failed";
}

interface Tally {
  sent: number;
  skipped: number;
  capped: number;
  failed: number;
}

/**
 * `news_due`: an e-mail naming the letters that came since the player's last visit and last
 * e-mail, still unread. Held during the quiet hours, one per day; what comes after waits for the
 * game, or for tomorrow's reminder.
 */
export async function deliverNews(
  ctx: NotifyContext,
  userIds: readonly string[],
  now: EpochMs,
): Promise<NotifyReport> {
  const rules = notifyRulesAt(NOTIFY_SCHEDULE, now);
  const tally: Tally = { sent: 0, skipped: 0, capped: 0, failed: 0 };
  const unique = [...new Set(userIds)];
  const at = sendableAt(rules, now);
  if (at > now) {
    return {
      ...tally,
      deferred: { userIds: unique, delaySeconds: Math.ceil((at - now) / 1000) },
    };
  }
  const sign = createUnsubscribeSigner(ctx.linkSecret);
  const recipients = await readRecipients(ctx.db, unique);
  tally.skipped += unique.length - recipients.length;
  for (const recipient of recipients) {
    if (!recipient.emailNews) {
      tally.skipped++;
      continue;
    }
    const since = Math.max(recipient.lastSeenAt, recipient.notifiedAt ?? 0);
    const mail = await readMail(ctx.db, { userId: recipient.id, before: undefined, now });
    const letters = mail.letters.filter(
      (letter) =>
        !letter.read &&
        isNewsKind(letter.kind) &&
        wantsLetter(recipient, letter.kind) &&
        Date.parse(letter.createdAt) > since,
    );
    if (letters.length === 0) {
      tally.skipped++;
      continue;
    }
    const id = await claim(ctx, recipient.id, "news", now);
    if (id === null) {
      tally.capped++;
      continue;
    }
    const content = newsContent(letters, now);
    const outcome = await sendClaimed(
      ctx,
      recipient,
      id,
      (links) => renderNewsEmail(content, links),
      sign,
      now,
    );
    if (outcome === "sent") tally.sent++;
    else tally.failed++;
    if (outcome === "quota") break;
  }
  return { ...tally, deferred: null };
}

/** What the news e-mail names, newest letter first, and where its button leads. */
export function newsContent(letters: readonly MailLetter[], now: EpochMs) {
  const shown = letters.slice(0, NEWS_LINES);
  const [only] = letters;
  return {
    lines: shown.map((letter) => ({
      title: letterView(letter, now, "Europe/Paris").title,
      quote: letter.kind === "clan_mention" ? letter.excerpt : null,
    })),
    more: letters.length - shown.length,
    button:
      letters.length === 1 && only !== undefined
        ? letterButton(only)
        : { label: "Ouvrir le courrier", url: `${SITE_URL}/jouer?courrier` },
  };
}

function letterButton(letter: MailLetter): { readonly label: string; readonly url: string } {
  switch (letter.kind) {
    case "offer_received":
      return { label: "Voir l'offre", url: `${SITE_URL}/echanges` };
    case "offer_completed":
      return { label: "Voir l'échange", url: `${SITE_URL}/echanges` };
    case "friend_request":
      return { label: "Répondre à la demande", url: `${SITE_URL}/amis` };
    case "clan_mention":
    case "clan_request":
      return { label: "Aller au clan", url: `${SITE_URL}/clan` };
    default:
      return { label: "Ouvrir le courrier", url: `${SITE_URL}/jouer?courrier` };
  }
}

/**
 * `reminders_due`: the evening e-mail to a player away on a reminder day, whose sachets are full.
 * It names the word slipping away and the letters waiting. One per day, and none to a player who
 * came back since the message was sent.
 */
export async function deliverReminders(
  ctx: NotifyContext,
  userIds: readonly string[],
  now: EpochMs,
): Promise<NotifyReport> {
  const rules = notifyRulesAt(NOTIFY_SCHEDULE, now);
  const tally: Tally = { sent: 0, skipped: 0, capped: 0, failed: 0 };
  const unique = [...new Set(userIds)];
  const sign = createUnsubscribeSigner(ctx.linkSecret);
  const recipients = await readRecipients(ctx.db, unique);
  tally.skipped += unique.length - recipients.length;
  const stocks = await readStocks(
    ctx.db,
    recipients.map((recipient) => recipient.id),
    now,
  );
  for (const recipient of recipients) {
    const step = reminderStep(rules, recipient.lastSeenAt, now);
    const stock = stocks.get(recipient.id);
    if (!recipient.emailReminders || step === null || stock === undefined || !stock.full) {
      tally.skipped++;
      continue;
    }
    const id = await claim(ctx, recipient.id, "reminder", now);
    if (id === null) {
      tally.capped++;
      continue;
    }
    const mail = await readMail(ctx.db, { userId: recipient.id, before: undefined, now });
    const slipping =
      recipient.notifyReviews && mail.slipping !== null
        ? await slippingWord(ctx.db, mail.slipping.cardId, mail.slipping.others)
        : null;
    const outcome = await sendClaimed(
      ctx,
      recipient,
      id,
      (links) =>
        renderReminderEmail(
          {
            stock: stock.stored,
            slipping,
            letters: mail.unread,
            last: isLastReminder(rules, step),
          },
          links,
        ),
      sign,
      now,
    );
    if (outcome === "sent") tally.sent++;
    else tally.failed++;
    if (outcome === "quota") break;
  }
  return { ...tally, deferred: null };
}

/** Each player's free stock now, and whether it is full: a wallet never written is full. */
async function readStocks(
  db: Database,
  userIds: readonly string[],
  now: EpochMs,
): Promise<Map<string, { readonly stored: number; readonly full: boolean }>> {
  const capacity = capacityAt(REFILL_SCHEDULE, now);
  const stocks = new Map(userIds.map((id) => [id, { stored: capacity, full: true }]));
  if (userIds.length === 0) return stocks;
  const rows = await db
    .select({
      userId: schema.boosterWallets.userId,
      stored: schema.boosterWallets.stored,
      progressMs: schema.boosterWallets.progressMs,
      asOf: schema.boosterWallets.asOf,
    })
    .from(schema.boosterWallets)
    .where(inArray(schema.boosterWallets.userId, [...userIds]));
  for (const row of rows) {
    const { stored } = computeRefill(
      { stored: row.stored, progressMs: row.progressMs, asOf: row.asOf.getTime() },
      REFILL_SCHEDULE,
      now,
    );
    stocks.set(row.userId, { stored, full: stored >= capacity });
  }
  return stocks;
}

async function slippingWord(
  db: Database,
  cardId: string,
  others: number,
): Promise<{ readonly word: string; readonly others: number } | null> {
  const [card] = await db.select({ lemma: cards.lemma }).from(cards).where(eq(cards.id, cardId));
  return card === undefined ? null : { word: card.lemma, others };
}

// --- Unsubscribing ------------------------------------------------------------------------------

/**
 * The unsubscribe link of a notification e-mail turns off that kind of e-mail; the game keeps
 * its letters. `null` when the id names no notification (it may name a campaign send).
 */
export async function unsubscribeNotification(
  db: Database,
  id: string,
): Promise<Exclude<UnsubscribeStopped, "campaigns"> | null> {
  const [row] = await db
    .select({ userId: notificationEmails.userId, kind: notificationEmails.kind })
    .from(notificationEmails)
    .where(eq(notificationEmails.id, id));
  if (row === undefined) return null;
  const changes = row.kind === "news" ? { emailNews: false } : { emailReminders: false };
  await db
    .insert(userPreferences)
    .values({ userId: row.userId, ...changes })
    .onConflictDoUpdate({ target: userPreferences.userId, set: changes });
  return row.kind === "news" ? "news" : "reminders";
}

/** The daily maintenance: rows older than the retention go, with their links. */
export function purgeNotifications(db: Database, now: EpochMs): Promise<number> {
  return purgeRows(
    db,
    notificationEmails,
    lt(notificationEmails.createdAt, new Date(now - NOTIFICATION_RETENTION_MS)),
  );
}
