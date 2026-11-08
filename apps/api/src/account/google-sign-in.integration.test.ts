import {
  ACCOUNT_ERROR_CODES,
  accountResponseSchema,
  appStatusResponseSchema,
  SOURCE_HEADER,
} from "@leximon/contract";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import {
  ageAccount,
  anyMailDomain,
  applySetCookies,
  createOutbox,
  requestCode,
  seedTestCatalog,
  setOwnedCards,
  signInAsGuest,
  signInWithCode,
} from "../test-support";

const url = testDatabaseUrl();
const env = { ...testEnv(url), GOOGLE_CLIENT_ID: "google-client", GOOGLE_CLIENT_SECRET: "secret" };
const outbox = createOutbox();
const app = createApp({ emailSender: outbox.emailSender, mailDomain: anyMailDomain });
const { db, close } = createDb(url, { maxConnections: 4 });

const { accounts, playerAgeBrackets, playerSignups, userCards, users } = schema;

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const PLAY_URL = `${TEST_ORIGIN}/jouer`;
const ERROR_URL = `${TEST_ORIGIN}/compte`;
const LINKED_URL = `${TEST_ORIGIN}/compte?associe=1`;
const DAY = 24 * 60 * 60_000;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

/** The Google account the next trip comes back with, answered by the mocked token endpoint. */
let googleProfile: { sub: string; email: string; email_verified: boolean };

beforeEach(() => {
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const target = input instanceof Request ? input.url : String(input);
    if (target !== GOOGLE_TOKEN_URL) return realFetch(input, init);
    return Response.json({
      access_token: "google-access-token",
      refresh_token: "google-refresh-token",
      id_token: unsignedJwt({
        iss: "https://accounts.google.com",
        aud: "google-client",
        ...googleProfile,
      }),
      token_type: "Bearer",
      expires_in: 3600,
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function unsignedJwt(payload: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256", typ: "JWT" })}.${part(payload)}.signature`;
}

let addresses = 0;
/** A Google account nobody used yet: accounts are never deleted between tests. */
function newGoogleAccount(verified = true) {
  addresses += 1;
  const id = `${addresses}-${crypto.randomUUID().slice(0, 8)}`;
  return { sub: `google-${id}`, email: `gmail-${id}@example.com`, email_verified: verified };
}

interface Trip {
  /** From « Créer un compte »: the client asks for the account to be created. */
  readonly signUp?: boolean;
  readonly declared?: Record<string, unknown>;
  readonly headers?: Record<string, string>;
}

/** The whole trip: the client asks to leave, Google sends the player back with a code. */
async function signInWithGoogle(cookie: string | null, trip: Trip = {}) {
  const start = await app.request(
    "/api/auth/sign-in/social",
    {
      method: "POST",
      headers: {
        origin: TEST_ORIGIN,
        "content-type": "application/json",
        ...(cookie === null ? {} : { cookie }),
        ...trip.headers,
      },
      body: JSON.stringify({
        provider: "google",
        callbackURL: PLAY_URL,
        errorCallbackURL: ERROR_URL,
        disableRedirect: true,
        ...(trip.signUp === true ? { requestSignUp: true } : {}),
        ...(trip.declared === undefined ? {} : { additionalData: trip.declared }),
      }),
    },
    env,
  );
  expect(start.status).toBe(200);
  const { url: googleURL } = (await start.json()) as { url: string };
  const leaving = applySetCookies(cookie ?? "", start);
  const state = new URL(googleURL).searchParams.get("state");

  const back = await app.request(
    `/api/auth/callback/google?code=google-code&state=${state}`,
    { headers: { cookie: leaving } },
    env,
  );
  expect(back.status).toBe(302);
  return {
    googleURL: new URL(googleURL),
    location: new URL(back.headers.get("location") ?? "", TEST_ORIGIN),
    cookie: applySetCookies(leaving, back),
  };
}

async function whoIs(cookie: string) {
  const response = await app.request(
    "/me/account",
    { headers: { origin: TEST_ORIGIN, cookie } },
    env,
  );
  if (response.status !== 200) return null;
  return accountResponseSchema.parse(await response.json());
}

async function userByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user ?? null;
}

/** The member adds Google from the account page: the trip, then Google's redirect. */
async function linkWithGoogle(cookie: string) {
  const start = await app.request(
    "/api/auth/link-social",
    {
      method: "POST",
      headers: { origin: TEST_ORIGIN, "content-type": "application/json", cookie },
      body: JSON.stringify({
        provider: "google",
        callbackURL: LINKED_URL,
        errorCallbackURL: LINKED_URL,
        disableRedirect: true,
      }),
    },
    env,
  );
  expect(start.status).toBe(200);
  const { url: googleURL } = (await start.json()) as { url: string };
  const leaving = applySetCookies(cookie, start);
  const state = new URL(googleURL).searchParams.get("state");
  const back = await app.request(
    `/api/auth/callback/google?code=google-code&state=${state}`,
    { headers: { cookie: leaving } },
    env,
  );
  expect(back.status).toBe(302);
  return new URL(back.headers.get("location") ?? "", TEST_ORIGIN);
}

/** A member signed in with a code, and the session cookie the client keeps. */
async function memberWithCode(email: string) {
  expect((await requestCode(app, env, email)).status).toBe(200);
  const response = await signInWithCode(app, env, {
    email,
    code: outbox.codeFor(email),
    cookie: null,
    ageConfirmed: true,
  });
  expect(response.status).toBe(200);
  const { user } = (await response.json()) as { user: { id: string } };
  return { userId: user.id, cookie: applySetCookies("", response) };
}

async function googleRowsOf(userId: string) {
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId));
  return rows.filter((row) => row.providerId === "google");
}

async function codeAccount(email: string) {
  expect((await requestCode(app, env, email)).status).toBe(200);
  const response = await signInWithCode(app, env, {
    email,
    code: outbox.codeFor(email),
    cookie: null,
    ageConfirmed: true,
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { user: { id: string } }).user.id;
}

describe("creating an account with Google", () => {
  it("asks Google for the address only", async () => {
    googleProfile = newGoogleAccount();
    const { googleURL } = await signInWithGoogle(null, {
      signUp: true,
      declared: { ageConfirmed: true },
    });
    expect(googleURL.origin).toBe("https://accounts.google.com");
    expect(googleURL.searchParams.get("scope")).toBe("openid email");
  });

  it("creates the player with the address only, its age bracket, and keeps no token", async () => {
    googleProfile = newGoogleAccount();
    const { location, cookie } = await signInWithGoogle(null, {
      signUp: true,
      declared: { ageConfirmed: true, ageBracket: "18-24" },
      headers: { [SOURCE_HEADER]: "reddit" },
    });
    expect(location.href).toBe(PLAY_URL);
    // Made with Google: a welcome, not a word about Google being added.
    expect(await whoIs(cookie)).toMatchObject({
      kind: "member",
      withGoogle: true,
      justJoined: true,
      googleJustLinked: false,
    });

    const user = await userByEmail(googleProfile.email);
    expect(user).toMatchObject({ name: "", image: null, emailVerified: true, isAnonymous: false });
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, user?.id ?? ""));
    expect(account).toMatchObject({
      providerId: "google",
      accountId: googleProfile.sub,
      accessToken: null,
      refreshToken: null,
      idToken: null,
    });
    const [bracket] = await db
      .select()
      .from(playerAgeBrackets)
      .where(eq(playerAgeBrackets.userId, user?.id ?? ""));
    expect(bracket?.bracket).toBe("18-24");
    // The arrival travelled with the trip, though Google's redirect carries no header.
    const [signup] = await db
      .select()
      .from(playerSignups)
      .where(eq(playerSignups.userId, user?.id ?? ""));
    expect(signup?.source).toBe("reddit");
  });

  it("refuses to create an account without the age declaration", async () => {
    googleProfile = newGoogleAccount();
    const { location, cookie } = await signInWithGoogle(null, { signUp: true });
    expect(location.pathname).toBe("/compte");
    expect(location.searchParams.get("error")).toBe(ACCOUNT_ERROR_CODES.ageConfirmationRequired);
    expect(await userByEmail(googleProfile.email)).toBeNull();
    expect(await whoIs(cookie)).toBeNull();
  });

  it("creates nothing from « Se connecter »", async () => {
    googleProfile = newGoogleAccount();
    const { location } = await signInWithGoogle(null, { declared: { ageConfirmed: true } });
    expect(location.pathname).toBe("/compte");
    expect(location.searchParams.get("error")).toBe("signup_disabled");
    expect(await userByEmail(googleProfile.email)).toBeNull();
  });

  it("refuses an address Google has not verified", async () => {
    googleProfile = newGoogleAccount(false);
    const { location } = await signInWithGoogle(null, {
      signUp: true,
      declared: { ageConfirmed: true },
    });
    expect(location.searchParams.get("error")).toBe("email_not_verified");
    expect(await userByEmail(googleProfile.email)).toBeNull();
  });
});

describe("an address that already has an account", () => {
  it("joins the account made with a code, and signs in to it from « Se connecter »", async () => {
    googleProfile = newGoogleAccount();
    const userId = await codeAccount(googleProfile.email);
    await ageAccount(db, userId, DAY);

    const { location, cookie } = await signInWithGoogle(null);
    expect(location.href).toBe(PLAY_URL);
    expect(await whoIs(cookie)).toMatchObject({
      kind: "member",
      justJoined: false,
      googleJustLinked: true,
    });
    const linked = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(linked.map((account) => account.providerId)).toContain("google");

    // The next time, through the Google account itself.
    const again = await signInWithGoogle(null);
    expect(again.location.href).toBe(PLAY_URL);
  });

  it("does not join it when Google has not verified the address", async () => {
    googleProfile = newGoogleAccount(false);
    const userId = await codeAccount(googleProfile.email);
    const { location, cookie } = await signInWithGoogle(null);
    expect(location.pathname).toBe("/compte");
    expect(location.searchParams.get("error")).toBe("account_not_linked");
    expect(await whoIs(cookie)).toBeNull();
    const linked = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(linked.map((account) => account.providerId)).not.toContain("google");
  });

  it("turns a suspended player away", async () => {
    googleProfile = newGoogleAccount();
    const userId = await codeAccount(googleProfile.email);
    await db.update(users).set({ banned: true }).where(eq(users.id, userId));
    const { location, cookie } = await signInWithGoogle(null);
    expect(location.searchParams.get("error")).toBe("BANNED_USER");
    expect(await whoIs(cookie)).toBeNull();
  });
});

describe("adding Google to a signed-in member", () => {
  it("adds the Google account with the member's address, which then signs in", async () => {
    googleProfile = newGoogleAccount();
    const member = await memberWithCode(googleProfile.email);
    expect(await whoIs(member.cookie)).toMatchObject({ withGoogle: false });

    const location = await linkWithGoogle(member.cookie);
    expect(location.href).toBe(LINKED_URL);
    expect(await whoIs(member.cookie)).toMatchObject({ kind: "member", withGoogle: true });
    expect(await googleRowsOf(member.userId)).toMatchObject([
      { accountId: googleProfile.sub, accessToken: null, refreshToken: null, idToken: null },
    ]);

    const again = await signInWithGoogle(null);
    expect(again.location.href).toBe(PLAY_URL);
  });

  it("refuses a Google account with another address", async () => {
    googleProfile = newGoogleAccount();
    const member = await memberWithCode(newGoogleAccount().email);
    const location = await linkWithGoogle(member.cookie);
    expect(location.pathname).toBe("/compte");
    expect(location.searchParams.get("error")).toBe("email_does_not_match");
    expect(await googleRowsOf(member.userId)).toEqual([]);
  });

  it("refuses an address Google has not verified", async () => {
    googleProfile = newGoogleAccount(false);
    const member = await memberWithCode(googleProfile.email);
    const location = await linkWithGoogle(member.cookie);
    expect(location.searchParams.get("error")).toBe("email_not_verified");
    expect(await googleRowsOf(member.userId)).toEqual([]);
  });

  it("is refused to a player who is not signed in", async () => {
    const response = await app.request(
      "/api/auth/link-social",
      {
        method: "POST",
        headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: LINKED_URL }),
      },
      env,
    );
    expect(response.status).toBe(401);
  });
});

describe("a guest signing in with Google", () => {
  it("moves the guest's game to the new account", async () => {
    const guest = await signInAsGuest(app, env);
    await setOwnedCards(db, guest.userId, [{ cardId: "test-a-common-1", quantity: 2 }]);
    googleProfile = newGoogleAccount();
    const { location, cookie } = await signInWithGoogle(guest.cookie, {
      signUp: true,
      declared: { ageConfirmed: true },
    });
    expect(location.href).toBe(PLAY_URL);
    const account = await whoIs(cookie);
    expect(account?.kind).toBe("member");
    const user = await userByEmail(googleProfile.email);
    const cards = await db
      .select()
      .from(userCards)
      .where(eq(userCards.userId, user?.id ?? ""));
    expect(cards.map((card) => card.quantity)).toEqual([2]);
  });

  it("warns before abandoning the guest for an account that plays, then signs in", async () => {
    googleProfile = newGoogleAccount();
    const userId = await codeAccount(googleProfile.email);
    // An account plays once it owns a card.
    await setOwnedCards(db, userId, [{ cardId: "test-a-common-2", quantity: 1 }]);
    const guest = await signInAsGuest(app, env);
    await setOwnedCards(db, guest.userId, [{ cardId: "test-a-common-1", quantity: 3 }]);

    const warned = await signInWithGoogle(guest.cookie);
    expect(warned.location.pathname).toBe("/compte");
    expect(warned.location.searchParams.get("error")).toBe(
      ACCOUNT_ERROR_CODES.guestLossNotAcknowledged,
    );
    expect(warned.location.searchParams.get("cards")).toBe("3");
    // Still the guest, with its cards.
    expect((await whoIs(warned.cookie))?.kind).toBe("guest");

    const accepted = await signInWithGoogle(warned.cookie, { declared: { acceptGuestLoss: true } });
    expect(accepted.location.href).toBe(PLAY_URL);
    const account = await whoIs(accepted.cookie);
    expect(account?.kind).toBe("member");
    const cards = await db.select().from(userCards).where(eq(userCards.userId, userId));
    expect(cards.map((card) => card.cardId)).toEqual(["test-a-common-2"]);
  });
});

describe("the mobile app's trip", () => {
  it("comes back to the app's link with the session cookie, the guest's game moved", async () => {
    const fromApp = { "expo-origin": "leximon://", "content-type": "application/json" };
    const guest = await signInAsGuest(app, env);
    await setOwnedCards(db, guest.userId, [{ cardId: "test-a-common-1", quantity: 1 }]);
    googleProfile = newGoogleAccount();
    const start = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { ...fromApp, cookie: guest.cookie },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "leximon://compte?google=1",
          errorCallbackURL: "leximon://compte",
          disableRedirect: true,
          requestSignUp: true,
          additionalData: { ageConfirmed: true },
        }),
      },
      env,
    );
    expect(start.status).toBe(200);
    const { url: googleURL } = (await start.json()) as { url: string };

    // The browser has none of the app's cookies: the proxy gives it the state's.
    const proxy = await app.request(
      `/api/auth/expo-authorization-proxy?${new URLSearchParams({ authorizationURL: googleURL })}`,
      {},
      env,
    );
    expect(proxy.status).toBe(302);
    const state = new URL(googleURL).searchParams.get("state");
    const back = await app.request(
      `/api/auth/callback/google?code=google-code&state=${state}`,
      { headers: { cookie: applySetCookies("", proxy) } },
      env,
    );
    const location = back.headers.get("location") ?? "";
    expect(location.startsWith("leximon://compte?google=1&cookie=")).toBe(true);
    const cookie = applySetCookies("", back);
    expect(await whoIs(cookie)).toMatchObject({ kind: "member", withGoogle: true });
    const user = await userByEmail(googleProfile.email);
    const cards = await db
      .select()
      .from(userCards)
      .where(eq(userCards.userId, user?.id ?? ""));
    expect(cards.map((card) => card.quantity)).toEqual([1]);
  });
});

describe("the trip", () => {
  it("refuses a token the client got from Google itself", async () => {
    const response = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ provider: "google", idToken: { token: "forged" } }),
      },
      env,
    );
    expect(response.status).toBe(400);
  });

  it("tells the clients whether Google is offered", async () => {
    const offered = await app.request("/app", {}, env);
    expect(appStatusResponseSchema.parse(await offered.json()).googleSignIn).toBe(true);
    const withoutClient = await app.request("/app", {}, testEnv(url));
    expect(appStatusResponseSchema.parse(await withoutClient.json()).googleSignIn).toBe(false);
  });
});
