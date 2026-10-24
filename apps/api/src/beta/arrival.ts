import {
  ACCOUNT_ERROR_CODES,
  ageBracketSchema,
  INVITE_HEADER,
  playerCodeSchema,
  REFERRER_HEADER,
  SOURCE_HEADER,
  sourceCodeSchema,
} from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { APIError } from "better-auth/api";
import {
  claimReferrerPlace,
  readReferrer,
  recordReferral,
  referrerOf,
  welcomeReferee,
} from "../friends/referrals";
import { claimInvite, invitesRequired, parseInviteCode, readInviteStatus } from "./invites";

/** What a sign-in that creates a player brings with it, noted before the user row exists. */
export interface Arrival {
  readonly inviteId: string | null;
  /** The player whose friend link brought the new player; never with an invitation of the admin. */
  readonly referrerId: string | null;
  readonly source: string | null;
  /** An account created from a guest session: the guest was let in already, its origin follows. */
  readonly fromGuest: boolean;
}

export function readSource(headers: Headers | undefined): string | null {
  const source = sourceCodeSchema.safeParse(headers?.get(SOURCE_HEADER));
  return source.success ? source.data : null;
}

/** The source of a player who came by a friend link and no `?src=`, in the measures. */
export const FRIEND_LINK_SOURCE = "lien-ami";

function readReferrerCode(headers: Headers | undefined): string | null {
  const code = playerCodeSchema.safeParse(headers?.get(REFERRER_HEADER));
  return code.success ? code.data : null;
}

/**
 * Lets a new player in, or refuses them while the beta is on invitation. Runs once Better Auth is
 * about to create the user, so after the sign-in code is checked: nobody learns from this refusal
 * whether an address has an account.
 *
 * A guest needs an invitation; an account created from a guest session does not (the guest came
 * in by one); an account created without a guest needs one, as a guest would.
 */
export async function admitNewPlayer(
  db: Database,
  env: Pick<Env, "BETA_INVITES">,
  input: {
    readonly headers: Headers | undefined;
    readonly fromGuest: boolean;
    readonly now: EpochMs;
  },
): Promise<Arrival> {
  const source = readSource(input.headers);
  const nobody = { inviteId: null, referrerId: null };
  if (input.fromGuest) return { ...nobody, source, fromGuest: true };

  const required = invitesRequired(env);
  const code = parseInviteCode(input.headers?.get(INVITE_HEADER));
  if (code !== null) {
    const claim = await claimInvite(db, code, input.now);
    if (claim.kind === "claimed") {
      return { ...nobody, inviteId: claim.inviteId, source, fromGuest: false };
    }
    if (required) {
      throw inviteRefusal(
        claim.kind === "closed"
          ? ACCOUNT_ERROR_CODES.inviteClosed
          : ACCOUNT_ERROR_CODES.inviteRequired,
      );
    }
  }

  // A friend link: one of the inviter's places while the beta is closed, none once it is open.
  const referrerCode = code === null ? readReferrerCode(input.headers) : null;
  if (referrerCode !== null) {
    const fromLink = { inviteId: null, source: source ?? FRIEND_LINK_SOURCE, fromGuest: false };
    if (!required) {
      return { ...fromLink, referrerId: await referrerOf(db, referrerCode, input.now) };
    }
    const claim = await claimReferrerPlace(db, referrerCode, input.now);
    if (claim.kind === "claimed") return { ...fromLink, referrerId: claim.referrerId };
    throw inviteRefusal(
      claim.kind === "closed"
        ? ACCOUNT_ERROR_CODES.inviteClosed
        : ACCOUNT_ERROR_CODES.inviteRequired,
    );
  }
  if (required) throw inviteRefusal(ACCOUNT_ERROR_CODES.inviteRequired);
  return { ...nobody, source, fromGuest: false };
}

/**
 * Whether `admitNewPlayer` would let this new player in, without taking a place: read when a code
 * is asked for, so that someone the beta would refuse gets told so instead of a useless code. The
 * place is only taken once the code is typed.
 */
export async function wouldAdmitNewPlayer(
  db: Database,
  env: Pick<Env, "BETA_INVITES">,
  input: {
    readonly headers: Headers | undefined;
    readonly fromGuest: boolean;
    readonly now: EpochMs;
  },
): Promise<boolean> {
  if (input.fromGuest || !invitesRequired(env)) return true;
  const code = parseInviteCode(input.headers?.get(INVITE_HEADER));
  if (code !== null) return (await readInviteStatus(db, code, input.now)) === "open";
  const referrerCode = readReferrerCode(input.headers);
  if (referrerCode === null) return false;
  const referrer = await readReferrer(db, {
    code: referrerCode,
    betaRequired: true,
    now: input.now,
  });
  return referrer?.status === "open";
}

function inviteRefusal(code: string): APIError {
  return new APIError("FORBIDDEN", {
    code,
    message: "The beta is on invitation: a new player needs a valid invitation",
  });
}

/** Notes where the new player came from, and the age bracket declared with a new account. */
export async function recordArrival(
  db: Database,
  input: {
    readonly userId: string;
    readonly isGuest: boolean;
    readonly arrival: Arrival;
    readonly body: unknown;
    readonly now: EpochMs;
  },
): Promise<void> {
  const { userId, arrival } = input;
  // From a guest, the guest's own row moves to the account with its game.
  if (!arrival.fromGuest) {
    await db
      .insert(schema.playerSignups)
      .values({ userId, inviteId: arrival.inviteId, source: arrival.source })
      .onConflictDoNothing();
  }
  const { referrerId } = arrival;
  if (referrerId !== null) {
    await db.transaction(async (tx) => {
      await recordReferral(tx, { refereeId: userId, referrerId, now: input.now });
      // An account made without a guest has its game at once: the friendship too.
      if (!input.isGuest) await welcomeReferee(tx, { accountId: userId, now: input.now });
    });
  }
  if (input.isGuest) return;
  const bracket = ageBracketSchema.safeParse(
    typeof input.body === "object" && input.body !== null
      ? (input.body as Record<string, unknown>)["ageBracket"]
      : undefined,
  );
  if (!bracket.success) return;
  await db
    .insert(schema.playerAgeBrackets)
    .values({ userId, bracket: bracket.data })
    .onConflictDoNothing();
}
