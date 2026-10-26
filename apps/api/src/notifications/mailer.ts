import { isLocalDevelopment, maskEmail, toSendError } from "../account/email-sender";
import type { NotificationEmail } from "../email/notifications";

/**
 * Sends notification e-mails through Cloudflare Email Service, on their own binding and
 * subdomain: a complaint about a reminder never touches the reputation of sign-in codes.
 */
export interface NotificationMailer {
  /** Resolves once the provider accepted the message; throws an `EmailSendError` otherwise. */
  send(to: string, email: NotificationEmail): Promise<void>;
}

/**
 * The mailer of this environment, or `null` when none is configured: nothing is claimed then, so
 * that setting the sender later loses no e-mail of the day.
 */
export function createNotificationMailer(env: Env): NotificationMailer | null {
  if (isLocalDevelopment(env)) return consoleMailer;
  const from = env.EMAIL_NOTIFY_FROM.trim();
  if (from === "") return null;
  const replyTo = env.EMAIL_REPLY_TO.trim();
  return {
    async send(to, email) {
      try {
        await env.NOTIFY_EMAIL.send({
          from,
          to,
          ...(replyTo === "" ? {} : { replyTo }),
          subject: email.subject,
          text: email.text,
          html: email.html,
          headers: {
            ...email.headers,
            "Auto-Submitted": "auto-generated",
            "Content-Language": "fr",
          },
        });
      } catch (error) {
        throw toSendError(error);
      }
    },
  };
}

const consoleMailer: NotificationMailer = {
  async send(to, email) {
    // The address is masked even here: logs must never hold personal data.
    console.info(`[dev] E-mail pour ${maskEmail(to)} : ${email.subject}\n${email.text}`);
  },
};
