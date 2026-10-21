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
  type AdminGrantBonusResponse,
  type AdminMe,
  type AdminOverview,
  type AdminPlayerDetail,
  type AdminPlayerKind,
  type AdminPlayersResponse,
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
  adminGrantBonusResponseSchema,
  adminMeSchema,
  adminOverviewSchema,
  adminPlayerDetailSchema,
  adminPlayersResponseSchema,
  adminTradesResponseSchema,
  adminWaitlistResponseSchema,
  errorResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  type TradeStatus,
} from "@leximon/contract";
import type { z } from "zod";
import { ApiError, parse, send } from "@/lib/api";

/**
 * Client of the back office routes (`/admin/*`). Never signs in as a guest: without a session the
 * shell asks to sign in, and the server checks the admin role on every route.
 */

export type AdminAccess =
  | { readonly kind: "admin"; readonly email: string }
  | { readonly kind: "signed_out" }
  | { readonly kind: "denied" };

/** Who is browsing, as the server checks it on every admin route (role read fresh). */
export async function fetchAdminAccess(): Promise<AdminAccess> {
  const response = await send("/admin/me");
  if (response.status === 401) return { kind: "signed_out" };
  if (response.status === 403) return { kind: "denied" };
  if (!response.ok) throw new ApiError(await errorCode(response), response.status);
  const me: AdminMe = await parse(response, adminMeSchema);
  return { kind: "admin", email: me.email };
}

async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await send(path);
  if (!response.ok) throw new ApiError(await errorCode(response), response.status);
  return parse(response, schema);
}

async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await send(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(await errorCode(response), response.status);
  return response;
}

async function errorCode(response: Response): Promise<string> {
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  return errorResponseSchema.safeParse(body).data?.error ?? `http_${response.status}`;
}

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const text = params.toString();
  return text === "" ? path : `${path}?${text}`;
}

export const fetchOverview = (): Promise<AdminOverview> =>
  getJson("/admin/overview", adminOverviewSchema);

export const fetchPlayers = (query: {
  q?: string;
  kind: AdminPlayerKind;
  cursor?: string;
}): Promise<AdminPlayersResponse> =>
  getJson(withQuery("/admin/players", query), adminPlayersResponseSchema);

export const fetchPlayer = (id: string): Promise<AdminPlayerDetail> =>
  getJson(`/admin/players/${encodeURIComponent(id)}`, adminPlayerDetailSchema);

/** The caller keeps `idempotencyKey` until it gets an answer: a retry never gives twice. */
export async function grantBonus(
  id: string,
  amount: number,
  reason: string,
  idempotencyKey: string,
): Promise<AdminGrantBonusResponse> {
  const response = await postJson(
    `/admin/players/${encodeURIComponent(id)}/bonus`,
    { amount, reason },
    { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
  );
  return parse(response, adminGrantBonusResponseSchema);
}

export async function banPlayer(id: string, request: AdminBanRequest): Promise<void> {
  await postJson(`/admin/players/${encodeURIComponent(id)}/ban`, request);
}

export async function unbanPlayer(id: string): Promise<void> {
  await postJson(`/admin/players/${encodeURIComponent(id)}/unban`, {});
}

export const fetchWaitlist = (cursor?: string): Promise<AdminWaitlistResponse> =>
  getJson(withQuery("/admin/waitlist", { cursor }), adminWaitlistResponseSchema);

/** The CSV of the whole list, as a file to save. */
export async function downloadWaitlist(): Promise<Blob> {
  const response = await send("/admin/waitlist/export");
  if (!response.ok) throw new ApiError(await errorCode(response), response.status);
  return response.blob();
}

export const fetchTrades = (query: {
  status?: TradeStatus;
  cursor?: string;
}): Promise<AdminTradesResponse> =>
  getJson(withQuery("/admin/trades", query), adminTradesResponseSchema);

export async function cancelTrade(id: string, reason: string): Promise<void> {
  await postJson(`/admin/trades/${encodeURIComponent(id)}/cancel`, { reason });
}

export const fetchCatalog = (): Promise<AdminCatalog> =>
  getJson("/admin/catalog", adminCatalogSchema);

/** null when the server does not know the card (catalogue not yet applied to its database). */
export async function fetchCardStats(id: string): Promise<AdminCardStats | null> {
  const response = await send(`/admin/cards/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError(await errorCode(response), response.status);
  return parse(response, adminCardStatsSchema);
}

export async function fetchCampaigns(): Promise<readonly AdminCampaignSummary[]> {
  return (await getJson("/admin/campaigns", adminCampaignsResponseSchema)).campaigns;
}

export const fetchCampaign = (id: string): Promise<AdminCampaign> =>
  getJson(`/admin/campaigns/${encodeURIComponent(id)}`, adminCampaignSchema);

/** Creates a draft (no id) or saves an existing one. */
export async function saveCampaign(
  id: string | null,
  campaign: AdminCampaignInput,
): Promise<AdminCampaign> {
  const path = id === null ? "/admin/campaigns" : `/admin/campaigns/${encodeURIComponent(id)}`;
  return parse(await postJson(path, campaign), adminCampaignSchema);
}

export async function previewCampaign(
  content: AdminCampaignContent,
): Promise<AdminCampaignPreview> {
  return parse(await postJson("/admin/campaigns/preview", content), adminCampaignPreviewSchema);
}

/** Sends the e-mail to the signed-in admin's own address. */
export async function sendCampaignTest(content: AdminCampaignContent): Promise<void> {
  await postJson("/admin/campaigns/test", content);
}

export async function fetchCampaignAudience(id: string): Promise<number> {
  const audience = await getJson(
    `/admin/campaigns/${encodeURIComponent(id)}/audience`,
    adminCampaignAudienceSchema,
  );
  return audience.recipients;
}

export type LaunchResult =
  | { readonly kind: "launched"; readonly campaign: AdminCampaign }
  /** The audience moved since it was counted: the admin confirms the new number. */
  | { readonly kind: "count_changed"; readonly recipients: number };

/** The caller keeps `idempotencyKey` until it gets an answer: a retry never launches twice. */
export async function launchCampaign(
  id: string,
  request: { expectedRecipients: number; scheduledAt: string | null },
  idempotencyKey: string,
): Promise<LaunchResult> {
  const response = await send(`/admin/campaigns/${encodeURIComponent(id)}/launch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    body: JSON.stringify(request),
  });
  if (response.status === 409) {
    const changed = adminCampaignCountChangedSchema.safeParse(
      await response
        .clone()
        .json()
        .catch(() => null),
    );
    if (changed.success) return { kind: "count_changed", recipients: changed.data.recipients };
  }
  if (!response.ok) throw new ApiError(await errorCode(response), response.status);
  return { kind: "launched", campaign: await parse(response, adminCampaignSchema) };
}

export async function controlCampaign(
  id: string,
  control: "pause" | "resume" | "cancel",
): Promise<AdminCampaign> {
  const response = await postJson(`/admin/campaigns/${encodeURIComponent(id)}/${control}`, {});
  return parse(response, adminCampaignSchema);
}

export type EraseResult =
  | { readonly kind: "erased"; readonly erased: number }
  | { readonly kind: "count_changed"; readonly count: number };

export async function eraseWaitlist(expectedCount: number): Promise<EraseResult> {
  const response = await send("/admin/waitlist/erase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedCount }),
  });
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  if (response.status === 409 && isCountChanged(body)) {
    return { kind: "count_changed", count: body.count };
  }
  if (!response.ok) throw new ApiError(await errorCode(response), response.status);
  return { kind: "erased", erased: expectedCount };
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

export const fetchActions = (cursor?: string): Promise<AdminActionsResponse> =>
  getJson(withQuery("/admin/actions", { cursor }), adminActionsResponseSchema);

/** French message for a refusal the admin can act on. */
export function adminErrorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.message : "";
  switch (code) {
    case "network_error":
      return "Pas de connexion à l'API.";
    case "forbidden":
      return "Ce compte n'a plus le rôle admin.";
    case "player_not_found":
      return "Joueur introuvable.";
    case "guest_archived":
      return "Cet invité a été archivé : agis sur le compte qui a repris sa partie.";
    case "cannot_ban_admin":
      return "Un admin ne peut pas être banni. Retire d'abord son rôle (pnpm admin:grant --revoke).";
    case "trade_not_pending":
      return "Cet échange n'est plus en attente.";
    case "trade_not_found":
      return "Échange introuvable.";
    case "invalid_request":
      return "Valeurs refusées par le serveur.";
    case "campaign_not_found":
      return "Campagne introuvable.";
    case "not_a_draft":
      return "Cette campagne est déjà lancée : elle ne change plus.";
    case "waitlist_closed":
      return "La liste d'attente a déjà reçu son e-mail. Une seule fois (P55).";
    case "no_recipients":
      return "Personne à qui écrire.";
    case "invalid_state":
      return "Impossible dans l'état actuel de la campagne.";
    case "not_sent_yet":
      return "L'e-mail d'ouverture n'est pas fini d'envoyer.";
    case "email_not_configured":
      return "L'envoi d'e-mails n'est pas configuré sur ce serveur.";
    case "send_failed":
      return "Le fournisseur a refusé l'envoi.";
    default:
      return "Une erreur est survenue. Réessaie.";
  }
}
