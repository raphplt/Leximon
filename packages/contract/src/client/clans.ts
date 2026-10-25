import { z } from "zod";
import {
  type ClaimGoalResponse,
  type ClanEntryMode,
  type ClanJoinResult,
  type ClanMember,
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
} from "../index";
import { ApiError, type Http, json, parse, refusal, segment, withQuery } from "./http";

/** A refusal the screen explains, or the value. `account_locked` comes from a sanction. */
export type ClanResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "refused"; readonly reason: ClanRefusal | "account_locked" };

const clanOrLockSchema = clanRefusalSchema.or(sanctionRefusalSchema);
const inviteCodeSchema = z.object({ inviteCode: z.string() });

async function result<T>(response: Response, schema: z.ZodType<T> | null): Promise<ClanResult<T>> {
  if (response.ok) {
    const value = schema === null ? (undefined as T) : await parse(response, schema);
    return { kind: "ok", value };
  }
  if ([403, 404, 409, 422].includes(response.status)) {
    const reason = await refusal(response, clanOrLockSchema);
    if (reason !== null) return { kind: "refused", reason };
  }
  throw new ApiError("failed", response.status);
}

const clanPath = (clanId: string, rest = "") => `/clans/${segment(clanId)}${rest}`;
const memberPath = (clanId: string, code: string, rest = "") =>
  clanPath(clanId, `/members/${segment(code)}${rest}`);

/** The clan routes and the player's sanctions. */
export function clanRoutes(http: Http) {
  const { sendAsPlayer } = http;

  return {
    async fetchMyClan(): Promise<MyClanResponse> {
      const response = await sendAsPlayer("/me/clan");
      if (!response.ok) throw new ApiError("clan_unavailable", response.status);
      return parse(response, myClanResponseSchema);
    },

    async fetchClans(query: {
      readonly q?: string;
      readonly entry?: ClanEntryMode;
      readonly cursor?: string | null;
    }): Promise<ClansResponse> {
      const response = await sendAsPlayer(withQuery("/clans", query));
      if (!response.ok) throw new ApiError("clans_unavailable", response.status);
      return parse(response, clansResponseSchema);
    },

    /** `null` when the clan no longer exists. */
    async fetchClan(clanId: string): Promise<ClanView | null> {
      const response = await sendAsPlayer(clanPath(clanId));
      if (response.status === 404) return null;
      if (!response.ok) throw new ApiError("clan_unavailable", response.status);
      return parse(response, clanViewSchema);
    },

    async fetchMembers(clanId: string, cursor: string | null): Promise<ClanMembersResponse> {
      const response = await sendAsPlayer(withQuery(clanPath(clanId, "/members"), { cursor }));
      if (!response.ok) throw new ApiError("members_unavailable", response.status);
      return parse(response, clanMembersResponseSchema);
    },

    /** The members whose pseudo starts with what follows an "@", for the discussion. */
    async searchMembers(clanId: string, query: string): Promise<ClanMember[]> {
      const response = await sendAsPlayer(withQuery(clanPath(clanId, "/members"), { q: query }));
      if (!response.ok) throw new ApiError("members_unavailable", response.status);
      return (await parse(response, clanMembersResponseSchema)).members;
    },

    async createClan(body: CreateClanRequest): Promise<ClanResult<ClanJoinResult>> {
      return result(await sendAsPlayer("/clans", json("POST", body)), clanJoinResultSchema);
    },

    async updateClan(clanId: string, body: UpdateClanRequest): Promise<ClanResult<void>> {
      return result(await sendAsPlayer(clanPath(clanId), json("PATCH", body)), null);
    },

    async joinClan(clanId: string): Promise<ClanResult<ClanJoinResult>> {
      const response = await sendAsPlayer(clanPath(clanId, "/join"), json("POST"));
      return result(response, clanJoinResultSchema);
    },

    async joinByCode(code: string): Promise<ClanResult<ClanJoinResult>> {
      return result(
        await sendAsPlayer("/clans/join", json("POST", { code })),
        clanJoinResultSchema,
      );
    },

    async withdrawRequest(clanId: string): Promise<ClanResult<void>> {
      return result(await sendAsPlayer(clanPath(clanId, "/join"), json("DELETE")), null);
    },

    async leaveClan(): Promise<ClanResult<void>> {
      return result(await sendAsPlayer("/me/clan/leave", json("POST")), null);
    },

    async renewInviteCode(clanId: string): Promise<ClanResult<{ inviteCode: string }>> {
      const response = await sendAsPlayer(clanPath(clanId, "/invite-code"), json("POST"));
      return result(response, inviteCodeSchema);
    },

    async reportClanName(clanId: string): Promise<ClanResult<void>> {
      return result(await sendAsPlayer(clanPath(clanId, "/report"), json("POST")), null);
    },

    async fetchRequests(clanId: string): Promise<ClanRequestsResponse> {
      const response = await sendAsPlayer(clanPath(clanId, "/requests"));
      if (!response.ok) throw new ApiError("requests_unavailable", response.status);
      return parse(response, clanRequestsResponseSchema);
    },

    async answerRequest(clanId: string, code: string, accept: boolean): Promise<ClanResult<void>> {
      const path = clanPath(clanId, `/requests/${segment(code)}/${accept ? "accept" : "decline"}`);
      return result(await sendAsPlayer(path, json("POST")), null);
    },

    async kickMember(clanId: string, code: string): Promise<ClanResult<void>> {
      return result(await sendAsPlayer(memberPath(clanId, code, "/kick"), json("POST")), null);
    },

    async setRole(
      clanId: string,
      code: string,
      role: "deputy" | "member",
    ): Promise<ClanResult<void>> {
      const response = await sendAsPlayer(memberPath(clanId, code, "/role"), json("PUT", { role }));
      return result(response, null);
    },

    async handOver(clanId: string, code: string): Promise<ClanResult<void>> {
      const response = await sendAsPlayer(memberPath(clanId, code, "/hand-over"), json("POST"));
      return result(response, null);
    },

    /** `durationMs` null lifts the silence. */
    async muteMember(
      clanId: string,
      code: string,
      durationMs: number | null,
    ): Promise<ClanResult<void>> {
      const init = durationMs === null ? json("DELETE") : json("PUT", { durationMs });
      return result(await sendAsPlayer(memberPath(clanId, code, "/mute"), init), null);
    },

    /** Newest first. `after` for what came since, `before` to page back. */
    async fetchMessages(
      clanId: string,
      page: { readonly after?: number; readonly before?: number } = {},
    ): Promise<ClanMessagesResponse | null> {
      const response = await sendAsPlayer(withQuery(clanPath(clanId, "/messages"), page));
      if (response.status === 403 || response.status === 404) return null;
      if (!response.ok) throw new ApiError("messages_unavailable", response.status);
      return parse(response, clanMessagesResponseSchema);
    },

    async postMessage(clanId: string, body: string): Promise<ClanResult<ClanMessage>> {
      const response = await sendAsPlayer(clanPath(clanId, "/messages"), json("POST", { body }));
      return result(response, clanMessageSchema);
    },

    async deleteMessage(clanId: string, messageId: number): Promise<ClanResult<void>> {
      const path = clanPath(clanId, `/messages/${messageId}`);
      return result(await sendAsPlayer(path, json("DELETE")), null);
    },

    async reportMessage(clanId: string, messageId: number): Promise<ClanResult<void>> {
      const path = clanPath(clanId, `/messages/${messageId}/report`);
      return result(await sendAsPlayer(path, json("POST")), null);
    },

    async claimGoal(week: string, tier: GoalTier): Promise<ClanResult<ClaimGoalResponse>> {
      const response = await sendAsPlayer("/me/clan/claims", json("POST", { week, tier }));
      return result(response, claimGoalResponseSchema);
    },

    async fetchSanctions(): Promise<SanctionsResponse["sanctions"]> {
      const response = await sendAsPlayer("/me/sanctions");
      if (!response.ok) throw new ApiError("sanctions_unavailable", response.status);
      return (await parse(response, sanctionsResponseSchema)).sanctions;
    },

    async markSanctionsSeen(): Promise<void> {
      const response = await sendAsPlayer("/me/sanctions/seen", json("POST"));
      if (!response.ok) throw new ApiError("failed", response.status);
    },

    /** `false` when the sanction can no longer be contested. */
    async contestSanction(sanctionId: string, text: string): Promise<boolean> {
      const path = `/me/sanctions/${segment(sanctionId)}/contest`;
      const response = await sendAsPlayer(path, json("POST", { text }));
      if (response.ok) return true;
      if ((await refusal(response, contestRefusalSchema)) !== null) return false;
      throw new ApiError("failed", response.status);
    },
  };
}
