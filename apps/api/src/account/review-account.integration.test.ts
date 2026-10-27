import { testDatabaseUrl } from "@leximon/db/testing";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { testEnv } from "../test-env";
import { anyMailDomain, createOutbox, requestCode, signInWithCode } from "../test-support";

const REVIEW_CODE = "604217";
const reviewEmail = `examen-${crypto.randomUUID().slice(0, 8)}@example.com`;
const env: Env = {
  ...testEnv(testDatabaseUrl()),
  REVIEW_ACCOUNT_EMAIL: reviewEmail,
  REVIEW_ACCOUNT_CODE: REVIEW_CODE,
};
const outbox = createOutbox();
const app = createApp({ emailSender: outbox.emailSender, mailDomain: anyMailDomain });

describe("store reviewers' account", () => {
  it("signs in with the fixed code, and no e-mail leaves", async () => {
    expect((await requestCode(app, env, reviewEmail)).status).toBe(200);
    expect(outbox.hasCodeFor(reviewEmail)).toBe(false);

    const signIn = await signInWithCode(app, env, {
      email: reviewEmail,
      code: REVIEW_CODE,
      cookie: null,
      ageConfirmed: true,
    });
    expect(signIn.status).toBe(200);
  });

  it("still allows only a few wrong attempts", async () => {
    expect((await requestCode(app, env, reviewEmail)).status).toBe(200);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wrong = await signInWithCode(app, env, {
        email: reviewEmail,
        code: "000000",
        cookie: null,
      });
      expect(wrong.status).not.toBe(200);
    }
    const late = await signInWithCode(app, env, {
      email: reviewEmail,
      code: REVIEW_CODE,
      cookie: null,
    });
    expect(late.status).not.toBe(200);
  });

  it("gives any other address its own random code", async () => {
    const email = `joueur-${crypto.randomUUID().slice(0, 8)}@example.com`;
    expect((await requestCode(app, env, email)).status).toBe(200);
    expect(outbox.codeFor(email)).toMatch(/^\d{6}$/);
    expect(outbox.codeFor(email)).not.toBe(REVIEW_CODE);
  });
});
