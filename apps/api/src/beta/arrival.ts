import {
  ACCOUNT_ERROR_CODES,
  ageBracketSchema,
  INVITE_HEADER,
  SOURCE_HEADER,
  sourceCodeSchema,
} from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { APIError } from "better-auth/api";
import { claimInvite, invitesRequired, parseInviteCode } from "./invites";

/** What a sign-in that creates a player brings with it, noted before the user row exists. */
export interface Arrival {
  readonly inviteId: string | null;
  readonly source: string | null;
  /** An account created from a guest session: the guest was let in already, its origin follows. */
  readonly fromGuest: boolean;
}

export function readSource(headers: Headers | undefined): string | null {
  const source = sourceCodeSchema.safeParse(headers?.get(SOURCE_HEADER));
  return source.success ? source.data : null;
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
  if (input.fromGuest) return { inviteId: null, source, fromGuest: true };

  const required = invitesRequired(env);
  const code = parseInviteCode(input.headers?.get(INVITE_HEADER));
  if (code === null) {
    if (required) throw inviteRefusal(ACCOUNT_ERROR_CODES.inviteRequired);
    return { inviteId: null, source, fromGuest: false };
  }
  const claim = await claimInvite(db, code, input.now);
  if (claim.kind === "claimed") return { inviteId: claim.inviteId, source, fromGuest: false };
  if (!required) return { inviteId: null, source, fromGuest: false };
  throw inviteRefusal(
    claim.kind === "closed" ? ACCOUNT_ERROR_CODES.inviteClosed : ACCOUNT_ERROR_CODES.inviteRequired,
  );
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
