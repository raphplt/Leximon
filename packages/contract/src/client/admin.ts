import type { z } from "zod";
import {
  type AdminActionsResponse,
  type AdminBanRequest,
  type AdminCampaign,
  type AdminCampaignContent,
  type AdminCampaignInput,
  type AdminCampaignPreview,
  type AdminCampaignSummary,
  type AdminCardStats,
  type AdminCatalog,
  type AdminContestsResponse,
  type AdminCreateInviteRequest,
  type AdminFeedbackResponse,
  type AdminGrantBonusResponse,
  type AdminInvite,
  type AdminMeasures,
  type AdminOverview,
  type AdminPlayerDetail,
  type AdminPlayerKind,
  type AdminPlayersResponse,
  type AdminReportsResponse,
  type AdminTestersResponse,
  type AdminTradesResponse,
  type AdminWaitlistResponse,
  adminActionsResponseSchema,
  adminCampaignAudienceSchema,
  adminCampaignCountChangedSchema,
  adminCampaignPreviewSchema,
  adminCampaignSchema,
  adminCampaignsResponseSchema,
  adminCardStatsSchema,
  adminCatalogSchema,
  adminContestsResponseSchema,
  adminFeedbackResponseSchema,
  adminGrantBonusResponseSchema,
  adminInviteSchema,
  adminInvitesResponseSchema,
  adminMeasuresSchema,
  adminMeSchema,
  adminOverviewSchema,
  adminPlayerDetailSchema,
  adminPlayersResponseSchema,
  adminReportsResponseSchema,
  adminTestersResponseSchema,
  adminTradesResponseSchema,
  adminWaitlistResponseSchema,
  type CreateSanctionRequest,
  IDEMPOTENCY_KEY_HEADER,
  type TradeStatus,
} from "../index";
import { ApiError, errorCode, type Http, json, parse, segment, withQuery } from "./http";

export type AdminAccess =
  | { readonly kind: "admin"; readonly email: string }
  | { readonly kind: "signed_out" }
  | { readonly kind: "denied" };

export type LaunchResult =
  | { readonly kind: "launched"; readonly campaign: AdminCampaign }
  /** The audience moved since it was counted: the admin confirms the new number. */
  | { readonly kind: "count_changed"; readonly recipients: number };

export type EraseResult =
  | { readonly kind: "erased"; readonly erased: number }
  | { readonly kind: "count_changed"; readonly count: number };

/** The `error` code of a failed admin request, which the back office turns into a message. */
async function failure(response: Response): Promise<ApiError> {
  return new ApiError((await errorCode(response)) ?? `http_${response.status}`, response.status);
}

function isCountChanged(body: unknown): body is { count: number } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    body.error === "count_changed" &&
    "count" in body &&
    typeof body.count === "number"
  );
}

/**
 * The back office routes (`/admin/*`). Never signs in as a guest: without a session the back office
 * asks to sign in, and the server checks the admin role on every route.
 */
export function adminRoutes(http: Http) {
  const { send } = http;

  async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const response = await send(path);
    if (!response.ok) throw await failure(response);
    return parse(response, schema);
  }

  async function postJson(
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const response = await send(path, json("POST", body, headers));
    if (!response.ok) throw await failure(response);
    return response;
  }

  const player = (id: string, rest = "") => `/admin/players/${segment(id)}${rest}`;
  const campaign = (id: string, rest = "") => `/admin/campaigns/${segment(id)}${rest}`;

  return {
    /** Who is browsing, as the server checks it on every admin route (role read fresh). */
    async fetchAdminAccess(): Promise<AdminAccess> {
      const response = await send("/admin/me");
      if (response.status === 401) return { kind: "signed_out" };
      if (response.status === 403) return { kind: "denied" };
      if (!response.ok) throw await failure(response);
      return { kind: "admin", email: (await parse(response, adminMeSchema)).email };
    },

    fetchOverview: (): Promise<AdminOverview> => getJson("/admin/overview", adminOverviewSchema),

    fetchPlayers: (query: {
      q?: string;
      kind: AdminPlayerKind;
      cursor?: string;
    }): Promise<AdminPlayersResponse> =>
      getJson(withQuery("/admin/players", query), adminPlayersResponseSchema),

    fetchPlayer: (id: string): Promise<AdminPlayerDetail> =>
      getJson(player(id), adminPlayerDetailSchema),

    /** The caller keeps `idempotencyKey` until it gets an answer: a retry never gives twice. */
    async grantBonus(
      id: string,
      amount: number,
      reason: string,
      idempotencyKey: string,
    ): Promise<AdminGrantBonusResponse> {
      const response = await postJson(
        player(id, "/bonus"),
        { amount, reason },
        { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
      );
      return parse(response, adminGrantBonusResponseSchema);
    },

    async banPlayer(id: string, request: AdminBanRequest): Promise<void> {
      await postJson(player(id, "/ban"), request);
    },

    async unbanPlayer(id: string): Promise<void> {
      await postJson(player(id, "/unban"), {});
    },

    fetchWaitlist: (cursor?: string): Promise<AdminWaitlistResponse> =>
      getJson(withQuery("/admin/waitlist", { cursor }), adminWaitlistResponseSchema),

    /** The CSV of the whole list, as a file to save. */
    async downloadWaitlist(): Promise<Blob> {
      const response = await send("/admin/waitlist/export");
      if (!response.ok) throw await failure(response);
      return response.blob();
    },

    fetchTrades: (query: { status?: TradeStatus; cursor?: string }): Promise<AdminTradesResponse> =>
      getJson(withQuery("/admin/trades", query), adminTradesResponseSchema),

    async cancelTrade(id: string, reason: string): Promise<void> {
      await postJson(`/admin/trades/${segment(id)}/cancel`, { reason });
    },

    fetchCatalog: (): Promise<AdminCatalog> => getJson("/admin/catalog", adminCatalogSchema),

    /** null when the server does not know the card (catalogue not yet applied to its database). */
    async fetchCardStats(id: string): Promise<AdminCardStats | null> {
      const response = await send(`/admin/cards/${segment(id)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw await failure(response);
      return parse(response, adminCardStatsSchema);
    },

    async fetchCampaigns(): Promise<readonly AdminCampaignSummary[]> {
      return (await getJson("/admin/campaigns", adminCampaignsResponseSchema)).campaigns;
    },

    fetchCampaign: (id: string): Promise<AdminCampaign> =>
      getJson(campaign(id), adminCampaignSchema),

    /** Creates a draft (no id) or saves an existing one. */
    async saveCampaign(id: string | null, input: AdminCampaignInput): Promise<AdminCampaign> {
      const path = id === null ? "/admin/campaigns" : campaign(id);
      return parse(await postJson(path, input), adminCampaignSchema);
    },

    async previewCampaign(content: AdminCampaignContent): Promise<AdminCampaignPreview> {
      return parse(await postJson("/admin/campaigns/preview", content), adminCampaignPreviewSchema);
    },

    /** Sends the e-mail to the signed-in admin's own address. */
    async sendCampaignTest(content: AdminCampaignContent): Promise<void> {
      await postJson("/admin/campaigns/test", content);
    },

    async fetchCampaignAudience(id: string): Promise<number> {
      return (await getJson(campaign(id, "/audience"), adminCampaignAudienceSchema)).recipients;
    },

    /** The caller keeps `idempotencyKey` until it gets an answer: a retry never launches twice. */
    async launchCampaign(
      id: string,
      request: { expectedRecipients: number; scheduledAt: string | null },
      idempotencyKey: string,
    ): Promise<LaunchResult> {
      const response = await send(
        campaign(id, "/launch"),
        json("POST", request, { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
      );
      if (response.status === 409) {
        const body: unknown = await response
          .clone()
          .json()
          .catch(() => null);
        const changed = adminCampaignCountChangedSchema.safeParse(body);
        if (changed.success) return { kind: "count_changed", recipients: changed.data.recipients };
      }
      if (!response.ok) throw await failure(response);
      return { kind: "launched", campaign: await parse(response, adminCampaignSchema) };
    },

    async controlCampaign(
      id: string,
      control: "pause" | "resume" | "cancel",
    ): Promise<AdminCampaign> {
      return parse(await postJson(campaign(id, `/${control}`), {}), adminCampaignSchema);
    },

    async eraseWaitlist(expectedCount: number): Promise<EraseResult> {
      const response = await send("/admin/waitlist/erase", json("POST", { expectedCount }));
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      if (response.status === 409 && isCountChanged(body)) {
        return { kind: "count_changed", count: body.count };
      }
      if (!response.ok) throw await failure(response);
      return { kind: "erased", erased: expectedCount };
    },

    fetchActions: (cursor?: string): Promise<AdminActionsResponse> =>
      getJson(withQuery("/admin/actions", { cursor }), adminActionsResponseSchema),

    async fetchInvites(): Promise<readonly AdminInvite[]> {
      return (await getJson("/admin/invites", adminInvitesResponseSchema)).invites;
    },

    async createInvite(request: AdminCreateInviteRequest): Promise<AdminInvite> {
      return parse(await postJson("/admin/invites", request), adminInviteSchema);
    },

    async revokeInvite(id: string): Promise<AdminInvite> {
      return parse(await postJson(`/admin/invites/${segment(id)}/revoke`, {}), adminInviteSchema);
    },

    fetchMeasures: (): Promise<AdminMeasures> => getJson("/admin/measures", adminMeasuresSchema),

    fetchTesters: (cursor?: string): Promise<AdminTestersResponse> =>
      getJson(withQuery("/admin/testers", { cursor }), adminTestersResponseSchema),

    fetchFeedback: (cursor?: string): Promise<AdminFeedbackResponse> =>
      getJson(withQuery("/admin/feedback", { cursor }), adminFeedbackResponseSchema),

    async markFeedbackRead(id: string): Promise<void> {
      await postJson(`/admin/feedback/${segment(id)}/read`, {});
    },

    fetchReports: (): Promise<AdminReportsResponse> =>
      getJson("/admin/reports", adminReportsResponseSchema),

    async dismissReport(id: string): Promise<void> {
      await postJson(`/admin/reports/${segment(id)}/dismiss`, {});
    },

    /** The caller keeps `idempotencyKey` until it gets an answer: a retry sanctions once. */
    async createSanction(request: CreateSanctionRequest, idempotencyKey: string): Promise<void> {
      await postJson("/admin/sanctions", request, { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey });
    },

    fetchContests: (): Promise<AdminContestsResponse> =>
      getJson("/admin/contests", adminContestsResponseSchema),

    async resolveContest(id: string, outcome: "upheld" | "revoked"): Promise<void> {
      await postJson(`/admin/sanctions/${segment(id)}/contest`, { outcome });
    },
  };
}
