/**
 * Shared helpers for API integration tests. Test-only: never import from application code.
 */
import { RARITIES, UNLOCK_SCHEDULE } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { eq, sql } from "drizzle-orm";
import { expect } from "vitest";
import type { EmailSender, EmailSenderFactory } from "./account/email-sender";
import type { MailDomainResolver } from "./account/mail-domain";
import type { createApp } from "./app";
import { TEST_ORIGIN } from "./test-env";

/** Two published collections and one in preparation, three cards per rarity each. */
/** The collection the rules open before the choice of collection. */
export const STARTER_COLLECTION = UNLOCK_SCHEDULE[0].starterCollection;

export const TEST_COLLECTIONS = [
  { id: STARTER_COLLECTION, name: "Les Fondateurs", published: true },
  { id: "test-a", name: "Test A", published: true },
  { id: "test-b", name: "Test B", published: true },
  { id: "test-hidden", name: "Test cachée", published: false },
] as const;

export async function seedTestCatalog(db: Database): Promise<void> {
  await db
    .insert(schema.collections)
    .values(
      TEST_COLLECTIONS.map(({ id, name, published }) => ({
        id,
        name,
        publishedAt: published ? new Date("2026-01-01T00:00:00Z") : null,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.cards)
    .values(
      TEST_COLLECTIONS.flatMap(({ id: collectionId }) =>
        RARITIES.flatMap((rarity) =>
          [1, 2, 3].map((n) => ({
            id: `${collectionId}-${rarity}-${n}`,
            lemma: `${rarity} ${n}`,
            rarity,
            collectionId,
          })),
        ),
      ),
    )
    .onConflictDoNothing();
}

export interface Guest {
  readonly cookie: string;
  readonly userId: string;
}

export async function signInAsGuest(app: ReturnType<typeof createApp>, env: Env): Promise<Guest> {
  const response = await app.request(
    "/api/auth/sign-in/anonymous",
    {
      method: "POST",
      headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
      body: "{}",
    },
    env,
  );
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  const body = (await response.json()) as { user: { id: string } };
  return { cookie, userId: body.user.id };
}

/**
 * A player who created an account, for tests that open more boosters than a guest may: a
 * guest session whose user is then marked as signed up, quicker than the e-mail code.
 */
export async function signInAsMember(
  app: ReturnType<typeof createApp>,
  env: Env,
  db: Database,
): Promise<Guest> {
  const player = await signInAsGuest(app, env);
  await db
    .update(schema.users)
    .set({ isAnonymous: false })
    .where(eq(schema.users.id, player.userId));
  // The signed cookie cache still says "guest": dropped, the session is read from the database.
  const cookie = player.cookie
    .split("; ")
    .filter((pair) => !pair.includes("session_data"))
    .join("; ");
  return { ...player, cookie };
}

/** Backdates an account, e.g. past the minimum age to trade. */
export async function ageAccount(db: Database, userId: string, ageMs: number): Promise<void> {
  await db
    .update(schema.users)
    .set({ createdAt: new Date(Date.now() - ageMs) })
    .where(eq(schema.users.id, userId));
}

/** Sets a player's total XP, e.g. to the level needed to trade. */
export async function setXp(db: Database, userId: string, xp: number): Promise<void> {
  await db
    .insert(schema.userProgress)
    .values({ userId, xp })
    .onConflictDoUpdate({ target: schema.userProgress.userId, set: { xp } });
}

export interface OwnedCard {
  readonly cardId: string;
  readonly quantity: number;
  /** Defaults to long ago, so that rare cards are past their holding period. */
  readonly lastObtainedAt?: Date;
}

/** Sets the quantities a player owns of some cards (standard variant), replacing earlier ones. */
export async function setOwnedCards(
  db: Database,
  userId: string,
  owned: readonly OwnedCard[],
): Promise<void> {
  const longAgo = new Date("2026-01-01T00:00:00Z");
  await db
    .insert(schema.userCards)
    .values(
      owned.map(({ cardId, quantity, lastObtainedAt }) => ({
        userId,
        cardId,
        quantity,
        firstObtainedAt: longAgo,
        lastObtainedAt: lastObtainedAt ?? longAgo,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.userCards.userId, schema.userCards.cardId, schema.userCards.variant],
      set: {
        quantity: sql`excluded.quantity`,
        lastObtainedAt: sql`excluded.last_obtained_at`,
      },
    });
}

/** Keeps the e-mails "sent" by the API, by address: sign-in codes, and invitation e-mails. */
export function createOutbox() {
  const codes = new Map<string, string>();
  const invitationOnly = new Set<string>();
  const sender: EmailSender = {
    async sendSignInCode({ to, code }) {
      codes.set(to, code);
    },
    async sendInvitationOnly({ to }) {
      invitationOnly.add(to);
    },
  };
  const emailSender: EmailSenderFactory = () => sender;
  return {
    emailSender,
    codeFor(email: string): string {
      const code = codes.get(email);
      if (code === undefined) throw new Error(`No code sent to ${email}`);
      return code;
    },
    hasCodeFor(email: string): boolean {
      return codes.has(email);
    },
    /** Whether the address got the invitation e-mail in place of a code. */
    toldInvitationOnly(email: string): boolean {
      return invitationOnly.has(email);
    },
  };
}

/** Every domain takes e-mail: tests never reach DNS (`example.com` publishes a null MX). */
export const anyMailDomain: MailDomainResolver = async () => "deliverable";

type App = ReturnType<typeof createApp>;

function authHeaders(cookie: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    origin: TEST_ORIGIN,
    "content-type": "application/json",
  };
  if (cookie !== null) headers["cookie"] = cookie;
  return headers;
}

export function requestCode(
  app: App,
  env: Env,
  email: string,
  cookie: string | null = null,
  extra: Record<string, string> = {},
) {
  return app.request(
    "/api/auth/email-otp/send-verification-otp",
    {
      method: "POST",
      headers: { ...authHeaders(cookie), ...extra },
      body: JSON.stringify({ email, type: "sign-in" }),
    },
    env,
  );
}

export function previewLink(
  app: App,
  env: Env,
  input: { email: string; code: string; cookie: string | null },
) {
  return app.request(
    "/account/link-preview",
    {
      method: "POST",
      headers: authHeaders(input.cookie),
      body: JSON.stringify({ email: input.email, code: input.code }),
    },
    env,
  );
}

export function signInWithCode(
  app: App,
  env: Env,
  input: {
    email: string;
    code: string;
    cookie: string | null;
    ageConfirmed?: boolean;
    acceptGuestLoss?: boolean;
  },
) {
  const { cookie, code, ...rest } = input;
  return app.request(
    "/api/auth/sign-in/email-otp",
    { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ ...rest, otp: code }) },
    env,
  );
}

/**
 * The cookies a browser holds after this response: each `Set-Cookie` applied in order, an expired
 * one removing the cookie, as a browser does.
 */
export function applySetCookies(cookie: string, response: Response): string {
  const jar = new Map<string, string>();
  for (const pair of cookie.split(";")) {
    const [name, ...value] = pair.trim().split("=");
    if (name) jar.set(name, value.join("="));
  }
  for (const header of response.headers.getSetCookie()) {
    const [pair = "", ...attributes] = header.split(";");
    const [name, ...value] = pair.trim().split("=");
    if (!name) continue;
    const expired = attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute));
    if (expired) jar.delete(name);
    else jar.set(name, value.join("="));
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
