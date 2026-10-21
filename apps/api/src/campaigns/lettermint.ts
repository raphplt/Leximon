import { z } from "zod";
import type { BatchOutcome, CampaignMailer, CampaignMessage } from "./mailer";

/**
 * Lettermint's batch endpoint (D-034): up to 500 e-mails per call, each with its own idempotency
 * key, kept 24 h. Called with `fetch`; tracking is off on the route (no pixel, no rewritten link).
 */

export const LETTERMINT_API = "https://api.lettermint.co/v1";
const TIMEOUT_MS = 30_000;
const ERROR_CODE = /^[A-Za-z0-9_.-]{1,64}$/;

export interface LettermintOptions {
  readonly token: string;
  readonly from: string;
  readonly replyTo: string | null;
  /** Slug of the broadcast route. */
  readonly route: string;
  /** Injected by tests. */
  readonly fetch?: typeof fetch;
}

const acceptedItem = z.object({ message_id: z.string().max(200).nullish() }).loose();
const acceptedBody = z.union([z.array(acceptedItem), z.object({ data: z.array(acceptedItem) })]);

const errorBody = z
  .object({
    error: z
      .object({
        code: z.string().max(100).optional(),
        details: z
          .object({
            accepted: z
              .array(
                z.object({
                  index: z.int().nonnegative(),
                  message_id: z.string().max(200).nullish(),
                }),
              )
              .optional(),
          })
          .loose()
          .optional(),
      })
      .loose()
      .optional(),
    code: z.string().max(100).optional(),
  })
  .loose();

export function lettermintMailer(options: LettermintOptions): CampaignMailer {
  const doFetch = options.fetch ?? fetch;
  return {
    async sendBatch(messages) {
      let response: Response;
      try {
        response = await doFetch(`${LETTERMINT_API}/send/batch`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            "x-lettermint-token": options.token,
          },
          body: JSON.stringify(messages.map((message) => toLettermintEmail(options, message))),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        // Network failure or timeout: the outcome is unknown, the same keys make a retry safe.
        return { kind: "retry_later", code: "network_error", retryAfterS: null };
      }
      return readOutcome(response, messages.length);
    },
  };
}

function toLettermintEmail(options: LettermintOptions, message: CampaignMessage) {
  return {
    from: options.from,
    to: [message.to],
    ...(options.replyTo === null ? {} : { reply_to: [options.replyTo] }),
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers: message.headers,
    ...(options.route === "" ? {} : { route: options.route }),
    metadata: { send_id: message.sendId },
    idempotency_key: message.idempotencyKey,
  };
}

async function readOutcome(response: Response, count: number): Promise<BatchOutcome> {
  const body: unknown = await response.json().catch(() => null);

  if (response.ok) {
    const parsed = acceptedBody.safeParse(body);
    const items = parsed.success
      ? Array.isArray(parsed.data)
        ? parsed.data
        : parsed.data.data
      : [];
    return {
      kind: "accepted",
      messageIds: Array.from({ length: count }, (_, index) => items[index]?.message_id ?? null),
    };
  }

  const error = errorBody.safeParse(body);
  const given = error.success ? (error.data.error?.code ?? error.data.code) : undefined;
  // Stored and logged: only a code-shaped value is kept, never free text that could hold an address.
  const code = given !== undefined && ERROR_CODE.test(given) ? given : `http_${response.status}`;

  if (response.status === 401 || response.status === 403) return { kind: "blocked", code };
  if (response.status === 429 || response.status === 409 || response.status >= 500) {
    // 409: a key of the batch is still being processed; nothing was sent, the same keys will
    // resolve once it is done.
    return { kind: "retry_later", code, retryAfterS: retryAfterSeconds(response) };
  }
  const accepted = error.success ? error.data.error?.details?.accepted : undefined;
  if (accepted !== undefined) {
    return {
      kind: "partial",
      accepted: accepted.map((item) => ({ index: item.index, messageId: item.message_id ?? null })),
      failedIndex: accepted.length,
      code,
    };
  }
  // Refused without saying which e-mail: tried again, each row counting an attempt.
  return { kind: "retry_later", code, retryAfterS: null };
}

function retryAfterSeconds(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (header === null) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 3600);
  const date = Date.parse(header);
  return Number.isNaN(date)
    ? null
    : Math.min(Math.max(0, Math.ceil((date - Date.now()) / 1000)), 3600);
}
