import { afterEach, describe, expect, it, vi } from "vitest";
import { testEnv } from "../test-env";
import {
  cloudflareEmailSender,
  createEmailSender,
  EmailSendError,
  EmailSenderNotConfiguredError,
  isLocalDevelopment,
  maskEmail,
} from "./email-sender";

afterEach(() => {
  vi.restoreAllMocks();
});

const message = { to: "raphael@example.com", code: "123456", validMinutes: 10 } as const;

/** A `send_email` binding that records what it receives, or throws the given error. */
function fakeBinding(failure?: unknown) {
  const sent: EmailMessageBuilder[] = [];
  const binding: SendEmail = {
    send: async (input: EmailMessage | EmailMessageBuilder) => {
      if (failure !== undefined) throw failure;
      sent.push(input as EmailMessageBuilder);
      return { messageId: "msg-1" };
    },
  };
  return { binding, sent };
}

/** The binding's errors: a standard `Error` with a `code` property. */
function bindingError(code: string, text: string): Error {
  return Object.assign(new Error(text), { code });
}

describe("maskEmail", () => {
  it("keeps only the first letters and the top-level domain", () => {
    expect(maskEmail("raphael@example.com")).toBe("r•••@e•••.com");
    expect(maskEmail("a@b.co.uk")).toBe("a•••@b•••.uk");
  });

  it("never returns the address when it is malformed", () => {
    expect(maskEmail("no-at-sign")).toBe("•••");
    expect(maskEmail("@example.com")).toBe("•••");
  });
});

describe("createEmailSender", () => {
  it("prints the code with a masked address in local development", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const env = { ...testEnv(), APP_ENV: "development" };

    await createEmailSender(env).sendSignInCode(message);

    expect(info).toHaveBeenCalledOnce();
    const line = String(info.mock.calls[0]?.[0]);
    expect(line).toContain("123456");
    expect(line).not.toContain("raphael@example.com");
  });

  it("fails closed outside local development when no sender is configured", async () => {
    const env = { ...testEnv(), APP_ENV: "production", EMAIL_CODE_FROM: " " };
    await expect(createEmailSender(env).sendSignInCode(message)).rejects.toBeInstanceOf(
      EmailSenderNotConfiguredError,
    );
  });

  it("sends through the binding once a sender is configured", async () => {
    const { binding, sent } = fakeBinding();
    const env = {
      ...testEnv(),
      APP_ENV: "production",
      EMAIL: binding,
      EMAIL_CODE_FROM: "Leximon <code@mail.leximon.fr>",
    };

    await createEmailSender(env).sendSignInCode(message);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.from).toBe("Leximon <code@mail.leximon.fr>");
    expect(sent[0]?.replyTo).toBe("contact@leximon.fr");
  });

  it("does not trust a development flag on a deployed address", () => {
    expect(
      isLocalDevelopment({ APP_ENV: "development", BETTER_AUTH_URL: "http://localhost:8787" }),
    ).toBe(true);
    expect(
      isLocalDevelopment({ APP_ENV: "development", BETTER_AUTH_URL: "https://api.leximon.fr" }),
    ).toBe(false);
    expect(isLocalDevelopment({ APP_ENV: "test", BETTER_AUTH_URL: "http://localhost:8787" })).toBe(
      false,
    );
  });
});

describe("cloudflareEmailSender", () => {
  const options = { from: "Leximon <code@mail.leximon.fr>", replyTo: null };

  it("sends the rendered code e-mail, without any unsubscribe header", async () => {
    const { binding, sent } = fakeBinding();

    await cloudflareEmailSender(binding, options).sendSignInCode(message);

    const email = sent[0];
    expect(email?.to).toBe("raphael@example.com");
    expect(email?.subject).toBe("123456, ton code Leximon");
    expect(email?.text).toContain("123456");
    expect(email?.html).toContain("123456");
    expect(email?.headers).toEqual({
      "Auto-Submitted": "auto-generated",
      "Content-Language": "fr",
    });
    expect(email).not.toHaveProperty("replyTo");
  });

  it("classes limits and outages as temporary", async () => {
    for (const code of [
      "E_RATE_LIMIT_EXCEEDED",
      "E_DAILY_LIMIT_EXCEEDED",
      "E_INTERNAL_SERVER_ERROR",
    ]) {
      const { binding } = fakeBinding(bindingError(code, "try later"));
      const failure = await cloudflareEmailSender(binding, options)
        .sendSignInCode(message)
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(EmailSendError);
      expect(failure).toMatchObject({ kind: "temporary", code });
    }
  });

  it("classes a refused recipient or sender as rejected", async () => {
    const { binding } = fakeBinding(bindingError("E_RECIPIENT_SUPPRESSED", "suppressed"));
    await expect(
      cloudflareEmailSender(binding, options).sendSignInCode(message),
    ).rejects.toMatchObject({ kind: "rejected", code: "E_RECIPIENT_SUPPRESSED" });
  });

  it("treats an error without a code as a temporary outage", async () => {
    const { binding } = fakeBinding(new TypeError("network"));
    await expect(
      cloudflareEmailSender(binding, options).sendSignInCode(message),
    ).rejects.toMatchObject({ kind: "temporary", code: "E_UNKNOWN" });
  });

  it("never carries the provider's message, which may quote the address", async () => {
    const { binding } = fakeBinding(
      bindingError("E_VALIDATION_ERROR", "Invalid recipient raphael@example.com"),
    );
    const failure = await cloudflareEmailSender(binding, options)
      .sendSignInCode(message)
      .catch((error: unknown) => error);
    expect(String((failure as Error).message)).not.toContain("raphael@example.com");
    expect(JSON.stringify(failure)).not.toContain("raphael@example.com");
  });
});
