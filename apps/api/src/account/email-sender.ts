/**
 * Sends sign-in codes by e-mail (D-030). No provider is chosen yet (recommendation: Scaleway): a
 * provider is one more implementation of `EmailSender`, called with `fetch`.
 *
 * Fails closed: outside local development, without a provider, sending throws instead of
 * pretending the code left.
 */

export interface SignInCodeEmail {
  readonly to: string;
  readonly code: string;
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

/** Builds the sender for a request's environment. */
export type EmailSenderFactory = (env: Env) => EmailSender;

export const createEmailSender: EmailSenderFactory = (env) =>
  isLocalDevelopment(env) ? consoleEmailSender : notConfiguredSender(env.APP_ENV);

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
