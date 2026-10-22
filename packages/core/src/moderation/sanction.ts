/**
 * Sanctions (P68): what the team may decide on a report, and what it stops the player from doing.
 * Content sanctions act once (a message hidden, a name replaced); restrictions last until a date,
 * or for good when closing an account.
 */

import type { EpochMs } from "../booster/refill";

export const SANCTION_KINDS = [
  "hide_message",
  "reset_pseudo",
  "reset_clan_name",
  "mute",
  "trade_ban",
  "suspend",
  "close",
] as const;
export type SanctionKind = (typeof SANCTION_KINDS)[number];

/** Kinds that last for a while and need an end date. */
export const TIMED_SANCTIONS: readonly SanctionKind[] = ["mute", "trade_ban", "suspend"];

export interface SanctionState {
  readonly kind: SanctionKind;
  /** End of a timed sanction; `null` otherwise. */
  readonly until: EpochMs | null;
  /** Lifted after a contest or by the team. */
  readonly revokedAt: EpochMs | null;
}

export interface Restrictions {
  /** Messages, pseudo, clan name and motto. */
  readonly canWrite: boolean;
  readonly canTrade: boolean;
  /** Suspended or closed: the game answers nothing else. */
  readonly locked: boolean;
}

/** What the player's standing sanctions forbid at `now`. */
export function restrictionsAt(sanctions: readonly SanctionState[], now: EpochMs): Restrictions {
  const standing = sanctions.filter(
    (sanction) =>
      sanction.revokedAt === null &&
      (sanction.kind === "close" || (sanction.until !== null && sanction.until > now)),
  );
  const has = (kind: SanctionKind) => standing.some((sanction) => sanction.kind === kind);
  const locked = has("suspend") || has("close");
  return { canWrite: !locked && !has("mute"), canTrade: !locked && !has("trade_ban"), locked };
}

/** A sanction can be contested for six months (P68). */
export const CONTEST_WINDOW_MS = 183 * 24 * 60 * 60 * 1000;

export function canContest(decidedAt: EpochMs, contestedAt: EpochMs | null, now: EpochMs): boolean {
  return contestedAt === null && now - decidedAt <= CONTEST_WINDOW_MS;
}
