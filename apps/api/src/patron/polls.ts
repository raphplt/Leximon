import {
  ADMIN_ACTIONS,
  type AdminPollCreate,
  type AdminPollRefusal,
  type AdminPollsResponse,
  type PatronPollView,
  type PatronVoteRefusal,
} from "@leximon/contract";
import { type EpochMs, PATRON_SCHEDULE, patronRulesAt, pollWinner } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { standingOfRow } from "./patron";

const { adminActions, patronPolls, patronPollVotes, patronSubscriptions } = schema;

type Reader = Pick<Database, "select">;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A closed vote still shows its result on the patron page for this long. */
const RESULT_SHOWN_MS = 30 * DAY_MS;

/** The admin list stops at the latest votes: one a month at most, years fit. */
const ADMIN_POLLS = 24;

type PollRow = typeof patronPolls.$inferSelect;

/** Voices by theme of each vote, in one query: a theme nobody chose counts zero. */
async function countVotes(db: Reader, polls: readonly PollRow[]): Promise<Map<string, number[]>> {
  const counts = new Map(polls.map((poll) => [poll.id, poll.themes.map(() => 0)]));
  if (polls.length === 0) return counts;
  const rows = await db
    .select({
      pollId: patronPollVotes.pollId,
      theme: patronPollVotes.theme,
      votes: sql<number>`count(*)::int`,
    })
    .from(patronPollVotes)
    .where(
      inArray(
        patronPollVotes.pollId,
        polls.map((poll) => poll.id),
      ),
    )
    .groupBy(patronPollVotes.pollId, patronPollVotes.theme);
  for (const row of rows) {
    const votes = counts.get(row.pollId);
    if (votes !== undefined && row.theme < votes.length) votes[row.theme] = row.votes;
  }
  return counts;
}

/**
 * The vote for the patron page: the one open, or the last closed for a month after. Voices show
 * only once it closes, so that nobody votes for the theme ahead.
 */
export async function readCurrentPoll(
  db: Reader,
  userId: string,
  now: EpochMs,
): Promise<PatronPollView | null> {
  const [poll] = await db
    .select()
    .from(patronPolls)
    .where(lte(patronPolls.opensAt, new Date(now)))
    .orderBy(desc(patronPolls.opensAt))
    .limit(1);
  if (poll === undefined || poll.closesAt.getTime() + RESULT_SHOWN_MS < now) return null;
  const open = poll.closesAt.getTime() > now;
  const [[mine], counts] = await Promise.all([
    db
      .select({ theme: patronPollVotes.theme })
      .from(patronPollVotes)
      .where(and(eq(patronPollVotes.pollId, poll.id), eq(patronPollVotes.userId, userId))),
    open ? Promise.resolve(null) : countVotes(db, [poll]),
  ]);
  const votes = counts?.get(poll.id);
  return {
    id: poll.id,
    themes: poll.themes,
    closesAt: poll.closesAt.toISOString(),
    open,
    myVote: mine?.theme ?? null,
    result: votes === undefined ? null : { votes, winner: pollWinner(votes) },
  };
}

export type VoteResult =
  | { readonly kind: "voted" }
  | { readonly kind: "missing" }
  | { readonly kind: "refused"; readonly reason: PatronVoteRefusal };

/** `PUT /me/patron/polls/:pollId/vote`: a paying patron's voice, changed until it closes. */
export async function votePoll(
  db: Database,
  input: {
    readonly userId: string;
    readonly pollId: string;
    readonly theme: number;
    readonly now: EpochMs;
  },
): Promise<VoteResult> {
  const [[poll], [row]] = await Promise.all([
    db.select().from(patronPolls).where(eq(patronPolls.id, input.pollId)),
    db
      .select({ status: patronSubscriptions.status, firstPaidAt: patronSubscriptions.firstPaidAt })
      .from(patronSubscriptions)
      .where(eq(patronSubscriptions.userId, input.userId)),
  ]);
  if (poll === undefined || poll.opensAt.getTime() > input.now) return { kind: "missing" };
  if (standingOfRow(row) !== "patron") return { kind: "refused", reason: "not_patron" };
  if (poll.closesAt.getTime() <= input.now) return { kind: "refused", reason: "poll_closed" };
  if (input.theme >= poll.themes.length) return { kind: "refused", reason: "unknown_theme" };
  const votedAt = new Date(input.now);
  await db
    .insert(patronPollVotes)
    .values({ pollId: poll.id, userId: input.userId, theme: input.theme, votedAt })
    .onConflictDoUpdate({
      target: [patronPollVotes.pollId, patronPollVotes.userId],
      set: { theme: input.theme, votedAt },
    });
  return { kind: "voted" };
}

/** `GET /admin/patrons/polls`: the latest votes first, with their voices, open or not. */
export async function listPolls(db: Reader): Promise<AdminPollsResponse> {
  const polls = await db
    .select()
    .from(patronPolls)
    .orderBy(desc(patronPolls.opensAt))
    .limit(ADMIN_POLLS);
  const counts = await countVotes(db, polls);
  return {
    polls: polls.map((poll) => ({
      id: poll.id,
      themes: poll.themes,
      opensAt: poll.opensAt.toISOString(),
      closesAt: poll.closesAt.toISOString(),
      votes: counts.get(poll.id) ?? [],
    })),
  };
}

export type OpenPollResult =
  | { readonly kind: "opened"; readonly id: string }
  | { readonly kind: "refused"; readonly reason: AdminPollRefusal };

/**
 * `POST /admin/patrons/polls`: opens a vote at once, for the days the rules give. One at a time:
 * the lock keeps two admins from opening two together.
 */
export async function openPoll(
  db: Database,
  input: {
    readonly adminId: string;
    readonly themes: AdminPollCreate["themes"];
    readonly now: EpochMs;
  },
): Promise<OpenPollResult> {
  const rules = patronRulesAt(PATRON_SCHEDULE, input.now);
  if (input.themes.length !== rules.pollThemes) {
    return { kind: "refused", reason: "theme_count" };
  }
  const at = new Date(input.now);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('patron_poll', 0))`);
    const [open] = await tx
      .select({ id: patronPolls.id })
      .from(patronPolls)
      .where(gt(patronPolls.closesAt, at))
      .limit(1);
    if (open !== undefined) return { kind: "refused", reason: "poll_open" } as const;
    const [poll] = await tx
      .insert(patronPolls)
      .values({
        themes: input.themes.map((theme) => ({ name: theme.name, description: theme.description })),
        opensAt: at,
        closesAt: new Date(input.now + rules.pollDays * DAY_MS),
        createdBy: input.adminId,
        createdAt: at,
      })
      .returning({ id: patronPolls.id });
    if (poll === undefined) throw new Error("patron poll not inserted");
    await tx.insert(adminActions).values({
      adminId: input.adminId,
      action: ADMIN_ACTIONS.patronPoll,
      details: { pollId: poll.id, themes: input.themes.length },
      createdAt: at,
    });
    return { kind: "opened", id: poll.id } as const;
  });
}
