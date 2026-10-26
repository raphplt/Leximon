import {
  createFullWallet,
  decideGuestLink,
  type EpochMs,
  type GuestLinkOutcome,
  REFILL_SCHEDULE,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, gt, or, sql } from "drizzle-orm";
import { welcomeReferee } from "../friends/referrals";

const {
  boosterBonusAwards,
  boosterOpenRequests,
  boosterOpens,
  boosterWallets,
  friendFeedEvents,
  guestLinks,
  mailLetters,
  playerDays,
  playerFeedback,
  playerInterest,
  playerSignups,
  players,
  referrals,
  reviewLogs,
  sessions,
  trades,
  userCards,
  userLevelRewards,
  userMastery,
  userRarityCompletions,
  userProgress,
  users,
} = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Pick<Database, "execute">;

/**
 * What a sign-in does with each column referencing `users.id`, for each outcome. An integration
 * test lists every foreign key to `users.id` in the database and fails if one is missing here:
 * a new table holding player data must be handled before it can be lost.
 *
 * - `moved`: re-pointed to the account;
 * - `kept`: left on the archived guest, for audit or because the account keeps its own;
 * - `pending_cancelled`: kept on the guest, its pending offers cancelled;
 * - `revoked`: deleted, the guest can no longer sign in;
 * - `link_log`: the log of links itself.
 */
export const USER_REFERENCES = {
  "booster_wallets.user_id": { transfer: "moved", abandon: "kept" },
  "booster_bonus_awards.user_id": { transfer: "moved", abandon: "kept" },
  "user_cards.user_id": { transfer: "moved", abandon: "kept" },
  "user_mastery.user_id": { transfer: "moved", abandon: "kept" },
  "user_progress.user_id": { transfer: "moved", abandon: "kept" },
  "user_level_rewards.user_id": { transfer: "moved", abandon: "kept" },
  "user_rarity_completions.user_id": { transfer: "moved", abandon: "kept" },
  "booster_opens.user_id": { transfer: "moved", abandon: "kept" },
  "booster_open_requests.user_id": { transfer: "moved", abandon: "kept" },
  "players.user_id": { transfer: "moved", abandon: "kept" },
  // Profile, blocks and reports are for members only: a guest never has any (kept to be safe).
  "pinned_cards.user_id": { transfer: "kept", abandon: "kept" },
  "user_preferences.user_id": { transfer: "kept", abandon: "kept" },
  "user_blocks.blocker_id": { transfer: "kept", abandon: "kept" },
  "user_blocks.blocked_id": { transfer: "kept", abandon: "kept" },
  "moderation_reports.reporter_id": { transfer: "kept", abandon: "kept" },
  "moderation_reports.reported_id": { transfer: "kept", abandon: "kept" },
  "sanctions.user_id": { transfer: "kept", abandon: "kept" },
  // Clans need an account: a guest is in none, writes nothing and claims nothing.
  "clan_members.user_id": { transfer: "kept", abandon: "kept" },
  "clan_join_requests.user_id": { transfer: "kept", abandon: "kept" },
  "clan_messages.author_id": { transfer: "kept", abandon: "kept" },
  "clan_messages.deleted_by": { transfer: "kept", abandon: "kept" },
  "clan_week_members.user_id": { transfer: "kept", abandon: "kept" },
  "clan_goal_claims.user_id": { transfer: "kept", abandon: "kept" },
  "review_logs.user_id": { transfer: "moved", abandon: "kept" },
  // Letters about the guest's offers follow the offers.
  "mail_letters.user_id": { transfer: "moved", abandon: "kept" },
  "trades.proposer_id": { transfer: "moved", abandon: "pending_cancelled" },
  "trades.recipient_id": { transfer: "moved", abandon: "pending_cancelled" },
  "sessions.user_id": { transfer: "revoked", abandon: "revoked" },
  // Sign-in methods. A guest has none: Better Auth creates it without an account row.
  "accounts.user_id": { transfer: "kept", abandon: "kept" },
  "guest_links.guest_id": { transfer: "link_log", abandon: "link_log" },
  "guest_links.account_id": { transfer: "link_log", abandon: "link_log" },
  // Back office audit log: written by admins, who are never guests.
  "admin_actions.admin_id": { transfer: "kept", abandon: "kept" },
  "moderation_reports.resolved_by": { transfer: "kept", abandon: "kept" },
  "sanctions.created_by": { transfer: "kept", abandon: "kept" },
  "email_campaigns.created_by": { transfer: "kept", abandon: "kept" },
  "email_campaigns.launched_by": { transfer: "kept", abandon: "kept" },
  // Campaigns, their consent and notification e-mails need an address: a guest never has one.
  "email_campaign_sends.user_id": { transfer: "kept", abandon: "kept" },
  "email_consents.user_id": { transfer: "kept", abandon: "kept" },
  "notification_emails.user_id": { transfer: "kept", abandon: "kept" },
  // Where the guest came from and the days it played: the account's first days are the guest's.
  // An account that already has its own origin keeps it.
  "player_signups.user_id": { transfer: "moved", abandon: "kept" },
  "player_days.user_id": { transfer: "moved", abandon: "kept" },
  "player_feedback.user_id": { transfer: "moved", abandon: "kept" },
  "player_interest.user_id": { transfer: "moved", abandon: "kept" },
  // Declared with an account only.
  "player_age_brackets.user_id": { transfer: "kept", abandon: "kept" },
  // Invitations are created by admins, who are never guests.
  "invites.created_by": { transfer: "kept", abandon: "kept" },
  // Friends need an account with a pseudo: a guest has none, sends and answers no request.
  "friendships.user_id": { transfer: "kept", abandon: "kept" },
  "friendships.friend_id": { transfer: "kept", abandon: "kept" },
  "friend_requests.sender_id": { transfer: "kept", abandon: "kept" },
  "friend_requests.recipient_id": { transfer: "kept", abandon: "kept" },
  "friend_reactions.user_id": { transfer: "kept", abandon: "kept" },
  // The guest's finds and who invited it follow its game; a guest never invites anyone.
  "friend_feed_events.user_id": { transfer: "moved", abandon: "kept" },
  "referrals.referee_id": { transfer: "moved", abandon: "kept" },
  "referrals.referrer_id": { transfer: "kept", abandon: "kept" },
} as const satisfies Readonly<
  Record<
    string,
    {
      readonly transfer: "moved" | "kept" | "revoked" | "link_log";
      readonly abandon: "kept" | "pending_cancelled" | "revoked" | "link_log";
    }
  >
>;

export interface LinkGuestInput {
  readonly guestId: string;
  readonly accountId: string;
  readonly now: EpochMs;
  /** The player was warned that the guest's cards will be lost. */
  readonly acceptGuestLoss: boolean;
}

export type LinkGuestResult =
  | {
      readonly kind: "linked";
      readonly outcome: GuestLinkOutcome;
      /** Copies the guest owned. */
      readonly cards: number;
      /** Words the guest had a mastery of. */
      readonly words: number;
    }
  /** The guest was linked before: a retried sign-in changes nothing. */
  | { readonly kind: "already_linked" }
  /** The guest would be abandoned and the player was not warned: nothing changed. */
  | { readonly kind: "guest_loss_not_acknowledged"; readonly cards: number };

/**
 * Archives a guest when its player signs in, in one transaction: transfers its whole game to an
 * account without any, or abandons it when the account already plays. The guest is
 * never deleted: trade partners keep their history, and the audit stays.
 *
 * Lock order, consistent with the rest of the API:
 * 1. the guest's wallet, created if missing: every booster opened or challenge answered by the
 *    guest holds it, so none runs halfway through the link, and later ones see the guest archived;
 * 2. the account's `users` row (`FOR NO KEY UPDATE`, which foreign key checks do not wait for):
 *    serializes two links into the same account, even one without a wallet yet;
 * 3. the account's wallet, if any: serializes with the account's own boosters and answers;
 * 4. the guest's player row: serializes with the guest sending an offer;
 * 5. then trades.
 *
 * Idempotent: the `guest_links` row, read under the guest's lock, makes a retry a no-op.
 */
export async function linkGuest(db: Database, input: LinkGuestInput): Promise<LinkGuestResult> {
  const { guestId, accountId, now } = input;
  const at = new Date(now);

  return db.transaction(async (tx): Promise<LinkGuestResult> => {
    const fresh = createFullWallet(REFILL_SCHEDULE, now);
    await tx
      .insert(boosterWallets)
      .values({
        userId: guestId,
        stored: fresh.stored,
        progressMs: fresh.progressMs,
        asOf: new Date(fresh.asOf),
        pityCounters: {},
      })
      .onConflictDoUpdate({
        target: boosterWallets.userId,
        set: { userId: sql`excluded.user_id` },
      });

    const [linked] = await tx
      .select({ guestId: guestLinks.guestId })
      .from(guestLinks)
      .where(eq(guestLinks.guestId, guestId));
    if (linked !== undefined) {
      return { kind: "already_linked" };
    }

    const [account] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, accountId))
      .for("no key update");
    if (account === undefined) {
      throw new Error("Account missing while linking a guest");
    }
    await tx
      .select({ userId: boosterWallets.userId })
      .from(boosterWallets)
      .where(eq(boosterWallets.userId, accountId))
      .for("update");
    await tx
      .select({ userId: players.userId })
      .from(players)
      .where(eq(players.userId, guestId))
      .for("update");

    const situation = await readSituation(tx, guestId, accountId);
    const { outcome, losesCollection } = decide(situation);

    if (losesCollection && !input.acceptGuestLoss) {
      // Rolls back the guest's wallet created above, if it was.
      return { kind: "guest_loss_not_acknowledged", cards: situation.guestCards };
    }

    switch (outcome) {
      case "transfer":
        await transferEverything(tx, guestId, accountId);
        // A guest who came by a friend link becomes the inviter's friend with its new account.
        await welcomeReferee(tx, { accountId, now });
        break;
      case "abandon":
        await cancelPendingTrades(tx, guestId, at);
        break;
    }

    await tx.delete(sessions).where(eq(sessions.userId, guestId));
    await tx.insert(guestLinks).values({
      guestId,
      accountId,
      outcome,
      cards: situation.guestCards,
      words: situation.guestWords,
      linkedAt: at,
    });

    return { kind: "linked", outcome, cards: situation.guestCards, words: situation.guestWords };
  });
}

export interface GuestLinkPreview {
  readonly accountExists: boolean;
  /** `none`: no guest, or nothing of it at stake (an empty guest signing in to an account). */
  readonly outcome: GuestLinkOutcome | "none";
  readonly guestCards: number;
}

/**
 * What signing in to the account of this address would do to the guest, so that the player is
 * warned before losing anything. Read-only and without locks: `linkGuest` decides again under its
 * locks, and refuses to abandon a guest the player was not warned about.
 */
export async function previewGuestLink(
  db: Database,
  input: { readonly guestId: string | null; readonly email: string },
): Promise<GuestLinkPreview> {
  const { guestId, email } = input;
  const [account] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), eq(users.isAnonymous, false)));
  const accountExists = account !== undefined;
  if (guestId === null) {
    return { accountExists, outcome: "none", guestCards: 0 };
  }

  const situation = await readSituation(db, guestId, account?.id ?? null);
  if (situation.guestLinked) {
    return { accountExists, outcome: "none", guestCards: 0 };
  }
  const { outcome, losesCollection } = decide(situation);
  if (outcome === "abandon" && !losesCollection) {
    return { accountExists, outcome: "none", guestCards: 0 };
  }
  return { accountExists, outcome, guestCards: situation.guestCards };
}

interface Situation {
  readonly guestLinked: boolean;
  readonly guestCards: number;
  readonly guestWords: number;
  readonly accountHasGame: boolean;
}

function decide(situation: Situation) {
  return decideGuestLink({
    accountHasGame: situation.accountHasGame,
    guestHasCollection: situation.guestCards > 0 || situation.guestWords > 0,
  });
}

/** Everything the decision needs, in one round trip. Without an account, it has no game. */
async function readSituation(
  db: Executor,
  guestId: string,
  accountId: string | null,
): Promise<Situation> {
  const account = accountId ?? "";
  const result = await db.execute<{
    guest_linked: boolean;
    guest_cards: number;
    guest_words: number;
    account_has_game: boolean;
  }>(sql`
    select
      exists (select 1 from ${guestLinks} where ${guestLinks.guestId} = ${guestId}) as guest_linked,
      (select coalesce(sum(${userCards.quantity}), 0)::int from ${userCards}
        where ${userCards.userId} = ${guestId}) as guest_cards,
      (select count(*)::int from ${userMastery} where ${userMastery.userId} = ${guestId}) as guest_words,
      (exists (select 1 from ${boosterWallets} where ${boosterWallets.userId} = ${account})
        or exists (select 1 from ${userCards} where ${userCards.userId} = ${account})
        or exists (select 1 from ${userMastery} where ${userMastery.userId} = ${account})
        or exists (select 1 from ${userProgress} where ${userProgress.userId} = ${account})
        or exists (select 1 from ${players} where ${players.userId} = ${account})) as account_has_game
  `);
  const row = result.rows[0];
  if (row === undefined) throw new Error("Guest link situation query returned no row");
  return {
    guestLinked: row.guest_linked,
    guestCards: row.guest_cards,
    guestWords: row.guest_words,
    accountHasGame: row.account_has_game,
  };
}

/**
 * Sign-up: the guest's whole game becomes the account's, history included, in one
 * statement. The account has no game, so no row can collide. The account takes the guest's age
 * when the guest is older, so that the wait before trading does not start again.
 */
async function transferEverything(tx: Transaction, guestId: string, accountId: string) {
  await tx.execute(sql`
    with
      wallets as (update ${boosterWallets} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      awards as (update ${boosterBonusAwards} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      copies as (update ${userCards} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      masteries as (update ${userMastery} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      progress as (update ${userProgress} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      level_rewards as (update ${userLevelRewards} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      completions as (update ${userRarityCompletions} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      opens as (update ${boosterOpens} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      open_requests as (update ${boosterOpenRequests} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      player as (update ${players} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      reviews as (update ${reviewLogs} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      letters as (update ${mailLetters} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      proposed as (update ${trades} set proposer_id = ${accountId} where proposer_id = ${guestId} returning 1),
      received as (update ${trades} set recipient_id = ${accountId} where recipient_id = ${guestId} returning 1),
      feedback as (update ${playerFeedback} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      finds as (update ${friendFeedEvents} set user_id = ${accountId} where user_id = ${guestId} returning 1),
      invited_by as (
        update ${referrals} set referee_id = ${accountId}
        where referee_id = ${guestId}
          and not exists (select 1 from ${referrals} where referee_id = ${accountId})
        returning 1
      ),
      origin as (
        update ${playerSignups} set user_id = ${accountId}
        where user_id = ${guestId}
          and not exists (select 1 from ${playerSignups} where user_id = ${accountId})
        returning 1
      ),
      -- An account without a game may still have opened the game some days: merged.
      days_copied as (
        insert into ${playerDays} (user_id, day)
        select ${accountId}, day from ${playerDays} where user_id = ${guestId}
        on conflict do nothing returning 1
      ),
      days_dropped as (delete from ${playerDays} where user_id = ${guestId} returning 1),
      interest_copied as (
        insert into ${playerInterest} (user_id, kind, created_at)
        select ${accountId}, kind, created_at from ${playerInterest} where user_id = ${guestId}
        on conflict do nothing returning 1
      ),
      interest_dropped as (delete from ${playerInterest} where user_id = ${guestId} returning 1)
    update ${users} set created_at = least(${users}.created_at, guest.created_at)
    from ${users} as guest
    where ${users}.id = ${accountId} and guest.id = ${guestId}
  `);
}

/**
 * Offers still open with the guest on either side: an archived guest no longer trades, and an
 * offer between the guest and the account would become a trade with oneself.
 */
async function cancelPendingTrades(tx: Transaction, guestId: string, at: Date) {
  await tx
    .update(trades)
    .set({ status: "cancelled", resolvedAt: at })
    .where(
      and(
        eq(trades.status, "pending"),
        gt(trades.expiresAt, at),
        or(eq(trades.proposerId, guestId), eq(trades.recipientId, guestId)),
      ),
    );
}
