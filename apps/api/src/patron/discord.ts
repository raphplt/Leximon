import type { EpochMs } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { signPayload, verifySignedPayload } from "../campaigns/signatures";
import { standingOfRow } from "./patron";

const { discordLinks, patronSubscriptions } = schema;

type Reader = Pick<Database, "select">;

const DISCORD_API = "https://discord.com/api/v10";
const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
/** Who the player is, and the right to bring them into the server if they are not in it yet. */
const SCOPES = "identify guilds.join";
const STATE_CONTEXT = "discord-link:v1:";
/** Time to read Discord's page and accept. */
const STATE_TTL_MS = 15 * 60 * 1000;
export const DISCORD_CALLBACK_PATH = "/discord/callback";

/**
 * What the game asks of Discord, and nothing more. Behind an interface so that tests run without
 * the network.
 */
export interface DiscordApi {
  /** The player's Discord account, from the code Discord's page sent back. */
  identify(code: string, redirectUri: string): Promise<DiscordIdentity>;
  /** Gives or takes the patrons' role; `not_member` when the account left the server. */
  setPatronRole(discordUserId: string, held: boolean): Promise<"done" | "not_member">;
}

export interface DiscordIdentity {
  readonly id: string;
  readonly username: string;
}

export type DiscordFactory = (env: Env) => DiscordApi;

/** Set once the bot is on the server with its role (`DISCORD_*` in the Worker's settings). */
export function discordConfigured(env: Env): boolean {
  return Boolean(
    env.DISCORD_CLIENT_ID &&
      env.DISCORD_CLIENT_SECRET &&
      env.DISCORD_BOT_TOKEN &&
      env.DISCORD_GUILD_ID &&
      env.DISCORD_PATRON_ROLE_ID,
  );
}

const redirectUriOf = (env: Env) =>
  `${env.BETTER_AUTH_URL.replace(/\/+$/, "")}${DISCORD_CALLBACK_PATH}`;

const tokenSchema = z.object({ access_token: z.string().min(1) });
const userSchema = z.object({ id: z.string().regex(/^\d{1,20}$/), username: z.string().min(1) });
/** Discord's code for a member who is not on the server. */
const UNKNOWN_MEMBER = 10007;

export function createDiscordApi(env: Env): DiscordApi {
  const bot = { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` };
  const guild = `${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}`;

  return {
    async identify(code, redirectUri) {
      const token = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: {
          authorization: `Basic ${btoa(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`)}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });
      if (!token.ok) throw new Error(`Discord token refused: ${token.status}`);
      const { access_token } = tokenSchema.parse(await token.json());
      const me = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { authorization: `Bearer ${access_token}` },
      });
      if (!me.ok) throw new Error(`Discord user unreadable: ${me.status}`);
      const user = userSchema.parse(await me.json());
      // Brings the player into the server if they are not in it; a member stays as they are.
      const joined = await fetch(`${guild}/members/${user.id}`, {
        method: "PUT",
        headers: { ...bot, "content-type": "application/json" },
        body: JSON.stringify({ access_token }),
      });
      if (!joined.ok) throw new Error(`Discord server not joined: ${joined.status}`);
      return user;
    },

    async setPatronRole(discordUserId, held) {
      const response = await fetch(
        `${guild}/members/${discordUserId}/roles/${env.DISCORD_PATRON_ROLE_ID}`,
        { method: held ? "PUT" : "DELETE", headers: bot },
      );
      if (response.ok) return "done";
      if (response.status === 404) {
        const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
        if (body?.code === UNKNOWN_MEMBER) return "not_member";
      }
      // Rate limited or Discord down: the queue tries again.
      throw new Error(`Discord role not set: ${response.status}`);
    },
  };
}

/**
 * Discord's page for a paying patron. The state names the account and is signed: the callback
 * comes from the browser, without the app's session, and nobody can make one for another account.
 */
export async function discordAuthorizeUrl(
  env: Env,
  input: { readonly userId: string; readonly app: boolean; readonly now: EpochMs },
): Promise<string> {
  const payload = [input.userId, input.now + STATE_TTL_MS, input.app ? "app" : "web"].join(":");
  const state = await signPayload(env.BETTER_AUTH_SECRET, STATE_CONTEXT, payload);
  return `${AUTHORIZE_URL}?${new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUriOf(env),
    scope: SCOPES,
    state,
  })}`;
}

export interface DiscordState {
  readonly userId: string;
  readonly app: boolean;
}

/** The account and the way back of a genuine state not expired, or null. */
export async function readDiscordState(
  env: Env,
  state: string,
  now: EpochMs,
): Promise<DiscordState | null> {
  const payload = await verifySignedPayload(env.BETTER_AUTH_SECRET, STATE_CONTEXT, state);
  if (payload === null) return null;
  const [userId = "", expiresAt = "", back = ""] = payload.split(":");
  if (userId === "" || !(Number(expiresAt) > now)) return null;
  return { userId, app: back === "app" };
}

export type LinkResult =
  | {
      readonly kind: "linked";
      /** The account the role was on before, if another: the role leaves it. */
      readonly previous: string | null;
      readonly discordUserId: string;
    }
  | { readonly kind: "refused" };

/**
 * Links the Discord account Discord's page vouched for. Linked before to another Leximon account,
 * it moves here; a patron who links another account frees the first.
 */
export async function linkDiscord(
  db: Database,
  discord: DiscordApi,
  env: Env,
  input: { readonly userId: string; readonly code: string; readonly now: EpochMs },
): Promise<LinkResult> {
  if (!(await paysNow(db, input.userId))) return { kind: "refused" };
  const identity = await discord.identify(input.code, redirectUriOf(env));
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select({ discordUserId: discordLinks.discordUserId })
      .from(discordLinks)
      .where(eq(discordLinks.userId, input.userId))
      .for("update");
    await tx
      .delete(discordLinks)
      .where(
        and(eq(discordLinks.discordUserId, identity.id), ne(discordLinks.userId, input.userId)),
      );
    await tx
      .insert(discordLinks)
      .values({
        userId: input.userId,
        discordUserId: identity.id,
        username: identity.username,
        linkedAt: new Date(input.now),
      })
      .onConflictDoUpdate({
        target: discordLinks.userId,
        set: {
          discordUserId: identity.id,
          username: identity.username,
          roleHeld: sql`${discordLinks.roleHeld} and ${discordLinks.discordUserId} = ${identity.id}`,
          linkedAt: new Date(input.now),
        },
      });
    const previous =
      before !== undefined && before.discordUserId !== identity.id ? before.discordUserId : null;
    return { kind: "linked", previous, discordUserId: identity.id } as const;
  });
}

async function paysNow(db: Reader, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: patronSubscriptions.status, firstPaidAt: patronSubscriptions.firstPaidAt })
    .from(patronSubscriptions)
    .where(eq(patronSubscriptions.userId, userId));
  return standingOfRow(row) === "patron";
}

/** `DELETE /me/patron/discord`: the Discord account it was, for the role to leave it. */
export async function unlinkDiscord(db: Database, userId: string): Promise<string | null> {
  const [removed] = await db
    .delete(discordLinks)
    .where(eq(discordLinks.userId, userId))
    .returning({ discordUserId: discordLinks.discordUserId });
  return removed?.discordUserId ?? null;
}

/** The Discord account linked to a player, for the role to follow their subscription. */
export async function readDiscordLink(
  db: Reader,
  userId: string,
): Promise<{ readonly discordUserId: string; readonly username: string } | null> {
  const [row] = await db
    .select({ discordUserId: discordLinks.discordUserId, username: discordLinks.username })
    .from(discordLinks)
    .where(eq(discordLinks.userId, userId));
  return row ?? null;
}

export interface RoleSync {
  readonly userId: string;
  readonly discordUserId: string;
}

/**
 * The queue's consumer: the role is given to a Discord account still linked to a paying patron,
 * and taken from any other. Trusts nothing in the messages but ids; replaying changes nothing.
 */
export async function syncDiscordRoles(
  db: Database,
  discord: DiscordApi,
  syncs: readonly RoleSync[],
): Promise<{ readonly given: number; readonly taken: number }> {
  if (syncs.length === 0) return { given: 0, taken: 0 };
  const links = await db
    .select({
      userId: discordLinks.userId,
      discordUserId: discordLinks.discordUserId,
      status: patronSubscriptions.status,
      firstPaidAt: patronSubscriptions.firstPaidAt,
    })
    .from(discordLinks)
    .leftJoin(patronSubscriptions, eq(patronSubscriptions.userId, discordLinks.userId))
    .where(
      inArray(
        discordLinks.discordUserId,
        syncs.map((sync) => sync.discordUserId),
      ),
    );
  const byDiscord = new Map(links.map((link) => [link.discordUserId, link]));
  let given = 0;
  let taken = 0;
  for (const discordUserId of new Set(syncs.map((sync) => sync.discordUserId))) {
    const link = byDiscord.get(discordUserId);
    const held =
      link !== undefined &&
      standingOfRow({ status: link.status, firstPaidAt: link.firstPaidAt }) === "patron";
    const outcome = await discord.setPatronRole(discordUserId, held);
    if (held) given++;
    else taken++;
    if (link !== undefined) {
      await db
        .update(discordLinks)
        .set({ roleHeld: held && outcome === "done" })
        .where(eq(discordLinks.discordUserId, discordUserId));
    }
  }
  return { given, taken };
}

/**
 * For the daily maintenance: linked accounts whose role differs from what the subscription
 * gives, a message lost or a payment that lapsed without a webhook. A member who left the
 * server is tried again each day, cheaply.
 */
export async function discordRolesAdrift(db: Reader): Promise<RoleSync[]> {
  const pays = sql`(${patronSubscriptions.status} in ('active', 'past_due') and ${isNotNull(
    patronSubscriptions.firstPaidAt,
  )})`;
  return db
    .select({ userId: discordLinks.userId, discordUserId: discordLinks.discordUserId })
    .from(discordLinks)
    .leftJoin(patronSubscriptions, eq(patronSubscriptions.userId, discordLinks.userId))
    .where(sql`${discordLinks.roleHeld} is distinct from coalesce(${pays}, false)`);
}
