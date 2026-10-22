import { isLocalDevelopment, maskEmail } from "../account/email-sender";
import { lettermintMailer } from "./lettermint";

/**
 * Sends campaign e-mails in batches (Lettermint, broadcast route). Sign-in codes never go
 * through here: they have their own sender and provider.
 */

export interface CampaignMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly headers: Readonly<Record<string, string>>;
  /** The send row id: the provider never sends the same key twice within 24 h. */
  readonly idempotencyKey: string;
  /** Echoed in the provider's webhooks to find the send row again. */
  readonly sendId: string;
}

/** What became of a batch. Expected refusals are results, not exceptions. */
export type BatchOutcome =
  /** Every message was accepted, ids in order (null when the provider did not give one). */
  | { readonly kind: "accepted"; readonly messageIds: readonly (string | null)[] }
  /**
   * Messages are accepted in order: those before `failedIndex` left, the one at `failedIndex` was
   * refused for good, and the ones after it were not tried.
   */
  | {
      readonly kind: "partial";
      readonly accepted: readonly { readonly index: number; readonly messageId: string | null }[];
      readonly failedIndex: number;
      readonly code: string;
    }
  /** Nothing was sent; the same batch may pass later. */
  | { readonly kind: "retry_later"; readonly code: string; readonly retryAfterS: number | null }
  /** Nothing was sent and nothing will until a person fixes the configuration (key, domain). */
  | { readonly kind: "blocked"; readonly code: string };

export interface CampaignMailer {
  sendBatch(messages: readonly CampaignMessage[]): Promise<BatchOutcome>;
}

/** No campaign provider is configured for this environment. */
export class CampaignMailerNotConfiguredError extends Error {
  constructor(readonly appEnv: string) {
    super(`No campaign e-mail provider is configured for the "${appEnv}" environment`);
    this.name = "CampaignMailerNotConfiguredError";
  }
}

export type CampaignMailerFactory = (env: Env) => CampaignMailer;

/** Lettermint once its key and sender are set; the console in local development; nothing else. */
export const createCampaignMailer: CampaignMailerFactory = (env) => {
  const token = env.LETTERMINT_SENDING_TOKEN?.trim() ?? "";
  const from = env.EMAIL_CAMPAIGN_FROM.trim();
  if (token !== "" && from !== "") {
    const replyTo = env.EMAIL_REPLY_TO.trim();
    return lettermintMailer({
      token,
      from,
      replyTo: replyTo === "" ? null : replyTo,
      route: env.LETTERMINT_BROADCAST_ROUTE.trim(),
    });
  }
  if (isLocalDevelopment(env)) return consoleMailer;
  return {
    async sendBatch() {
      throw new CampaignMailerNotConfiguredError(env.APP_ENV);
    },
  };
};

const consoleMailer: CampaignMailer = {
  async sendBatch(messages) {
    for (const message of messages) {
      // The text body too: it holds the unsubscribe link, to try `/desinscription` locally.
      console.info(
        `[dev] Campagne « ${message.subject} » pour ${maskEmail(message.to)}\n${message.text}`,
      );
    }
    return { kind: "accepted", messageIds: messages.map(() => null) };
  },
};
