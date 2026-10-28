import { type Database, schema } from "@leximon/db";
import { EmailSendError, type EmailSender } from "./email-sender";

type SignInEmailKind = "code" | "invitation_only";

/**
 * The same sender, which notes each e-mail it hands to the provider, sent or refused, so that the
 * back office follows the monthly quota. The address is never written.
 */
export function recordingEmailSender(sender: EmailSender, db: Database): EmailSender {
  const recorded = async (kind: SignInEmailKind, send: () => Promise<void>) => {
    try {
      await send();
    } catch (error) {
      if (error instanceof EmailSendError) await record(db, kind, error.code);
      throw error;
    }
    await record(db, kind, null);
  };
  return {
    sendSignInCode: (email) => recorded("code", () => sender.sendSignInCode(email)),
    sendInvitationOnly: (email) =>
      recorded("invitation_only", () => sender.sendInvitationOnly(email)),
  };
}

/** A line that could not be written costs a count, never the code the player waits for. */
async function record(db: Database, kind: SignInEmailKind, error: string | null): Promise<void> {
  try {
    await db.insert(schema.signInEmails).values({
      kind,
      status: error === null ? "sent" : "failed",
      lastError: error,
    });
  } catch (caught) {
    console.error("Sign-in e-mail not recorded", {
      kind,
      error: caught instanceof Error ? caught.name : "unknown",
    });
  }
}
