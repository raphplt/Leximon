import {
  type ClaimGoalResponse,
  type ClanEntryMode,
  type ClanJoinResult,
  type ClanMembersResponse,
  type ClanMessage,
  type ClanMessagesResponse,
  type ClanRefusal,
  type ClanRequestsResponse,
  type ClansResponse,
  type ClanView,
  type CreateClanRequest,
  claimGoalResponseSchema,
  clanJoinResultSchema,
  clanMembersResponseSchema,
  clanMessageSchema,
  clanMessagesResponseSchema,
  clanRefusalSchema,
  clanRequestsResponseSchema,
  clansResponseSchema,
  clanViewSchema,
  contestRefusalSchema,
  type GoalTier,
  type MyClanResponse,
  myClanResponseSchema,
  type SanctionsResponse,
  sanctionRefusalSchema,
  sanctionsResponseSchema,
  type UpdateClanRequest,
} from "@leximon/contract";
import { z } from "zod";
import { ApiError, parse, refusal, sendAsPlayer } from "../lib/api";

/** Browser client of the clan routes (K-01 to K-13) and of the player's sanctions (R-08). */

/** A refusal the screen explains, or the value. `account_locked` comes from a sanction. */
export type ClanResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "refused"; readonly reason: ClanRefusal | "account_locked" };

const clanOrLockSchema = clanRefusalSchema.or(sanctionRefusalSchema);
const inviteCodeSchema = z.object({ inviteCode: z.string() });

async function result<T>(
  response: Response,
  schema: z.ZodType<T> | null,
  failure: string,
): Promise<ClanResult<T>> {
  if (response.ok) {
    const value = schema === null ? (undefined as T) : await parse(response, schema);
    return { kind: "ok", value };
  }
  if ([403, 404, 409, 422].includes(response.status)) {
    const reason = await refusal(response, clanOrLockSchema);
    if (reason !== null) return { kind: "refused", reason };
  }
  throw new ApiError(failure, response.status);
}

function json(method: string, body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

const clanPath = (clanId: string, rest = "") => `/clans/${encodeURIComponent(clanId)}${rest}`;
const memberPath = (clanId: string, code: string, rest = "") =>
  clanPath(clanId, `/members/${encodeURIComponent(code)}${rest}`);

export async function fetchMyClan(): Promise<MyClanResponse> {
  const response = await sendAsPlayer("/me/clan");
  if (!response.ok) throw new ApiError("clan_unavailable", response.status);
  return parse(response, myClanResponseSchema);
}

export async function fetchClans(query: {
  readonly q?: string;
  readonly entry?: ClanEntryMode;
  readonly cursor?: string | null;
}): Promise<ClansResponse> {
  const params = new URLSearchParams();
  if (query.q !== undefined && query.q !== "") params.set("q", query.q);
  if (query.entry !== undefined) params.set("entry", query.entry);
  if (query.cursor) params.set("cursor", query.cursor);
  const response = await sendAsPlayer(`/clans?${params}`);
  if (!response.ok) throw new ApiError("clans_unavailable", response.status);
  return parse(response, clansResponseSchema);
}

/** `null` when the clan no longer exists. */
export async function fetchClan(clanId: string): Promise<ClanView | null> {
  const response = await sendAsPlayer(clanPath(clanId));
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError("clan_unavailable", response.status);
  return parse(response, clanViewSchema);
}

export async function fetchMembers(
  clanId: string,
  cursor: string | null,
): Promise<ClanMembersResponse> {
  const query = cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  const response = await sendAsPlayer(clanPath(clanId, `/members${query}`));
  if (!response.ok) throw new ApiError("members_unavailable", response.status);
  return parse(response, clanMembersResponseSchema);
}

export async function createClan(body: CreateClanRequest): Promise<ClanResult<ClanJoinResult>> {
  return result(await sendAsPlayer("/clans", json("POST", body)), clanJoinResultSchema, "failed");
}

export async function updateClan(
  clanId: string,
  body: UpdateClanRequest,
): Promise<ClanResult<void>> {
  return result(await sendAsPlayer(clanPath(clanId), json("PATCH", body)), null, "failed");
}

export async function joinClan(clanId: string): Promise<ClanResult<ClanJoinResult>> {
  const response = await sendAsPlayer(clanPath(clanId, "/join"), json("POST"));
  return result(response, clanJoinResultSchema, "failed");
}

export async function joinByCode(code: string): Promise<ClanResult<ClanJoinResult>> {
  const response = await sendAsPlayer("/clans/join", json("POST", { code }));
  return result(response, clanJoinResultSchema, "failed");
}

export async function withdrawRequest(clanId: string): Promise<ClanResult<void>> {
  return result(await sendAsPlayer(clanPath(clanId, "/join"), json("DELETE")), null, "failed");
}

export async function leaveClan(): Promise<ClanResult<void>> {
  return result(await sendAsPlayer("/me/clan/leave", json("POST")), null, "failed");
}

export async function renewInviteCode(clanId: string): Promise<ClanResult<{ inviteCode: string }>> {
  const response = await sendAsPlayer(clanPath(clanId, "/invite-code"), json("POST"));
  return result(response, inviteCodeSchema, "failed");
}

export async function reportClanName(clanId: string): Promise<ClanResult<void>> {
  return result(await sendAsPlayer(clanPath(clanId, "/report"), json("POST")), null, "failed");
}

export async function fetchRequests(clanId: string): Promise<ClanRequestsResponse> {
  const response = await sendAsPlayer(clanPath(clanId, "/requests"));
  if (!response.ok) throw new ApiError("requests_unavailable", response.status);
  return parse(response, clanRequestsResponseSchema);
}

export async function answerRequest(
  clanId: string,
  code: string,
  accept: boolean,
): Promise<ClanResult<void>> {
  const path = clanPath(
    clanId,
    `/requests/${encodeURIComponent(code)}/${accept ? "accept" : "decline"}`,
  );
  return result(await sendAsPlayer(path, json("POST")), null, "failed");
}

export async function kickMember(clanId: string, code: string): Promise<ClanResult<void>> {
  const response = await sendAsPlayer(memberPath(clanId, code, "/kick"), json("POST"));
  return result(response, null, "failed");
}

export async function setRole(
  clanId: string,
  code: string,
  role: "deputy" | "member",
): Promise<ClanResult<void>> {
  const response = await sendAsPlayer(memberPath(clanId, code, "/role"), json("PUT", { role }));
  return result(response, null, "failed");
}

export async function handOver(clanId: string, code: string): Promise<ClanResult<void>> {
  const response = await sendAsPlayer(memberPath(clanId, code, "/hand-over"), json("POST"));
  return result(response, null, "failed");
}

/** `durationMs` null lifts the silence. */
export async function muteMember(
  clanId: string,
  code: string,
  durationMs: number | null,
): Promise<ClanResult<void>> {
  const init = durationMs === null ? json("DELETE") : json("PUT", { durationMs });
  return result(await sendAsPlayer(memberPath(clanId, code, "/mute"), init), null, "failed");
}

/** Newest first. `after` for what came since, `before` to page back. */
export async function fetchMessages(
  clanId: string,
  page: { readonly after?: number; readonly before?: number } = {},
): Promise<ClanMessagesResponse | null> {
  const params = new URLSearchParams();
  if (page.after !== undefined) params.set("after", String(page.after));
  if (page.before !== undefined) params.set("before", String(page.before));
  const response = await sendAsPlayer(clanPath(clanId, `/messages?${params}`));
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new ApiError("messages_unavailable", response.status);
  return parse(response, clanMessagesResponseSchema);
}

export async function postMessage(clanId: string, body: string): Promise<ClanResult<ClanMessage>> {
  const response = await sendAsPlayer(clanPath(clanId, "/messages"), json("POST", { body }));
  return result(response, clanMessageSchema, "failed");
}

export async function deleteMessage(clanId: string, messageId: number): Promise<ClanResult<void>> {
  const response = await sendAsPlayer(clanPath(clanId, `/messages/${messageId}`), json("DELETE"));
  return result(response, null, "failed");
}

export async function reportMessage(clanId: string, messageId: number): Promise<ClanResult<void>> {
  const path = clanPath(clanId, `/messages/${messageId}/report`);
  return result(await sendAsPlayer(path, json("POST")), null, "failed");
}

export async function claimGoal(
  week: string,
  tier: GoalTier,
): Promise<ClanResult<ClaimGoalResponse>> {
  const response = await sendAsPlayer("/me/clan/claims", json("POST", { week, tier }));
  return result(response, claimGoalResponseSchema, "failed");
}

// --- Sanctions (R-08) ----------------------------------------------------------------------------

export async function fetchSanctions(): Promise<SanctionsResponse["sanctions"]> {
  const response = await sendAsPlayer("/me/sanctions");
  if (!response.ok) throw new ApiError("sanctions_unavailable", response.status);
  return (await parse(response, sanctionsResponseSchema)).sanctions;
}

export async function markSanctionsSeen(): Promise<void> {
  const response = await sendAsPlayer("/me/sanctions/seen", json("POST"));
  if (!response.ok) throw new ApiError("failed", response.status);
}

/** `false` when the sanction can no longer be contested. */
export async function contestSanction(sanctionId: string, text: string): Promise<boolean> {
  const response = await sendAsPlayer(
    `/me/sanctions/${encodeURIComponent(sanctionId)}/contest`,
    json("POST", { text }),
  );
  if (response.ok) return true;
  if ((await refusal(response, contestRefusalSchema)) !== null) return false;
  throw new ApiError("failed", response.status);
}
