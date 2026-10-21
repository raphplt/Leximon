import { renderSignInCodeEmail } from "../email/sign-in-code";

/**
 * Sends sign-in codes by e-mail (D-030), through Cloudflare Email Service (D-034): the
 * `send_email` binding of the Worker, no key and no `fetch`.
 *
 * Fails closed: outside local development, without a configured sender, sending throws instead of
 * pretending the code left.
 */

export interface SignInCodeEmail {
  readonly to: string;
  readonly code: string;
  /** How long the code stays valid, in minutes, written in the e-mail. */
  readonly validMinutes: number;
}

export interface EmailSender {
  /** Resolves once the provider accepted the message; throws otherwise. */
  sendSignInCode(email: SignInCodeEmail): Promise<void>;
}

/** No provider is configured for this environment: no code can be sent. */
export class EmailSenderNotConfiguredError extends Error {
  constructor(readonly appEnv: string) {
    super(`No e-mail provider is configured for the "${appEnv}" environment`);
    this.name = "EmailSenderNotConfiguredError";
  }
}

/**
 * The provider refused the message. `temporary` failures may pass later (rate or daily limit,
 * outage); `rejected` ones will not (suppressed or invalid recipient, unverified sender).
 *
 * Carries only the provider's error code: its message may quote the address.
 */
export class EmailSendError extends Error {
  constructor(
    readonly kind: "temporary" | "rejected",
    readonly code: string,
  ) {
    super(`The e-mail provider refused the message (${code})`);
    this.name = "EmailSendError";
  }
}

/** Codes of the `send_email` binding that may succeed on a later try. */
const TEMPORARY_CODES: ReadonlySet<string> = new Set([
  "E_RATE_LIMIT_EXCEEDED",
  "E_DAILY_LIMIT_EXCEEDED",
  "E_INTERNAL_SERVER_ERROR",
  "E_DELIVERY_FAILED",
]);

/** Builds the sender for a request's environment. */
export type EmailSenderFactory = (env: Env) => EmailSender;

export const createEmailSender: EmailSenderFactory = (env) => {
  if (isLocalDevelopment(env)) return consoleEmailSender;
  const from = env.EMAIL_CODE_FROM.trim();
  if (from === "") return notConfiguredSender(env.APP_ENV);
  const replyTo = env.EMAIL_REPLY_TO.trim();
  return cloudflareEmailSender(env.EMAIL, { from, replyTo: replyTo === "" ? null : replyTo });
};

/**
 * Local development only: the code is printed in the API console. Both conditions are required,
 * so that a deployment left with the default `APP_ENV` never writes codes to its logs.
 */
export function isLocalDevelopment(env: Pick<Env, "APP_ENV" | "BETTER_AUTH_URL">): boolean {
  if (env.APP_ENV !== "development") return false;
  try {
    const { hostname } = new URL(env.BETTER_AUTH_URL);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

const consoleEmailSender: EmailSender = {
  async sendSignInCode({ to, code }) {
    // The address is masked even here: logs must never hold personal data.
    console.info(`[dev] Code de connexion pour ${maskEmail(to)} : ${code}`);
  },
};

function notConfiguredSender(appEnv: string): EmailSender {
  return {
    async sendSignInCode() {
      throw new EmailSenderNotConfiguredError(appEnv);
    },
  };
}

export function cloudflareEmailSender(
  binding: SendEmail,
  options: { readonly from: string; readonly replyTo: string | null },
): EmailSender {
  return {
    async sendSignInCode({ to, code, validMinutes }) {
      const email = renderSignInCodeEmail({ code, validMinutes });
      try {
        await binding.send({
          from: options.from,
          to,
          ...(options.replyTo === null ? {} : { replyTo: options.replyTo }),
          subject: email.subject,
          text: email.text,
          html: email.html,
          // Tells mail servers not to answer with an out-of-office reply.
          headers: { "Auto-Submitted": "auto-generated", "Content-Language": "fr" },
        });
      } catch (error) {
        throw toSendError(error);
      }
    },
  };
}

/** The binding throws an `Error` with a `code` property. Anything else is an outage. */
function toSendError(error: unknown): EmailSendError {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^E_[A-Z_]+$/.test(error.code)
      ? error.code
      : "E_UNKNOWN";
  const temporary = code === "E_UNKNOWN" || TEMPORARY_CODES.has(code);
  return new EmailSendError(temporary ? "temporary" : "rejected", code);
}

/** "raphael@example.com" → "r•••@e•••.com": enough to tell two test addresses apart. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local.slice(0, 1)}•••@${host.slice(0, 1)}•••${tld}`;
}
