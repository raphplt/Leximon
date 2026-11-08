import { accountRoutes } from "./account";
import { adminRoutes } from "./admin";
import { clanRoutes } from "./clans";
import { friendRoutes } from "./friends";
import { gameRoutes } from "./game";
import { type ApiClientOptions, createHttp } from "./http";
import { joustRoutes } from "./jousts";
import { adminPatronRoutes, patronRoutes } from "./patron";
import { wishRoutes } from "./wishes";

/**
 * Client of the game API, shared by the web and the mobile app. Every response is validated
 * against the contract; an expected refusal is a result, anything else an `ApiError`.
 */
export function createApiClient(options: ApiClientOptions) {
  const http = createHttp(options);
  return {
    ...gameRoutes(http),
    ...accountRoutes(http),
    ...friendRoutes(http),
    ...clanRoutes(http),
    ...joustRoutes(http),
    ...wishRoutes(http),
    ...patronRoutes(http),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Client of the back office, on the same session as the game. */
export function createAdminClient(options: ApiClientOptions) {
  const http = createHttp(options);
  return { ...adminRoutes(http), ...adminPatronRoutes(http) };
}

export type AdminClient = ReturnType<typeof createAdminClient>;

export type { JoinWaitlistResult, PreviewResult, SendCodeResult, SignInResult } from "./account";
export type { AdminAccess, EraseResult, LaunchResult } from "./admin";
export * from "./catalog";
export type { ClanResult } from "./clans";
export type { ClaimReferralResult, FriendResult } from "./friends";
export type {
  AnswerResult,
  BannerPurchaseResult,
  BlockResult,
  CarnetClaimResult,
  ChangeMissionResult,
  ClaimResult,
  DeleteAccountResult,
  MissingWordResult,
  OpenBoosterResult,
  ProfileResult,
  RecycleCopyResult,
  TradeResult,
} from "./game";
export {
  type ApiClientOptions,
  ApiError,
  type ApiTransport,
  type Arrival,
  BetaClosedError,
  type BetaClosedReason,
} from "./http";
export type {
  JoustAnswerResult,
  JoustQuestionResult,
  LaunchJoustResult,
  LeagueClaimResult,
  SaveDeckResult,
} from "./jousts";
export type {
  EditionResult,
  FindResult,
  PatronClaimResult,
  PatronRedirectResult,
} from "./patron";
