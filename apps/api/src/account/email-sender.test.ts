import { afterEach, describe, expect, it, vi } from "vitest";
import { testEnv } from "../test-env";
import {
  createEmailSender,
  EmailSenderNotConfiguredError,
  isLocalDevelopment,
  maskEmail,
} from "./email-sender";

afterEach(() => {
  vi.restoreAllMocks();
});

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

    await createEmailSender(env).sendSignInCode({ to: "raphael@example.com", code: "123456" });

    expect(info).toHaveBeenCalledOnce();
    const line = String(info.mock.calls[0]?.[0]);
    expect(line).toContain("123456");
    expect(line).not.toContain("raphael@example.com");
  });

  it("fails closed outside local development", async () => {
    const env = { ...testEnv(), APP_ENV: "production" };
    await expect(
      createEmailSender(env).sendSignInCode({ to: "raphael@example.com", code: "123456" }),
    ).rejects.toBeInstanceOf(EmailSenderNotConfiguredError);
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
