import { describe, expect, it } from "vitest";
import { reviewSignInCode } from "./review-account";

const env = { REVIEW_ACCOUNT_EMAIL: "Examen@Leximon.fr", REVIEW_ACCOUNT_CODE: "482913" };

describe("reviewSignInCode", () => {
  it("gives the fixed code to the review address, whatever its case", () => {
    expect(reviewSignInCode(env, "examen@leximon.fr", 6)).toBe("482913");
    expect(reviewSignInCode(env, " EXAMEN@leximon.fr ", 6)).toBe("482913");
  });

  it("leaves every other address to a random code", () => {
    expect(reviewSignInCode(env, "joueur@leximon.fr", 6)).toBeUndefined();
  });

  it("opens nothing while either secret is empty", () => {
    expect(reviewSignInCode({ ...env, REVIEW_ACCOUNT_CODE: "" }, "examen@leximon.fr", 6)).toBe(
      undefined,
    );
    expect(reviewSignInCode({ ...env, REVIEW_ACCOUNT_EMAIL: "" }, "", 6)).toBeUndefined();
  });

  it("ignores a code of the wrong shape", () => {
    for (const code of ["12345", "1234567", "12345a", "abcdef"]) {
      expect(reviewSignInCode({ ...env, REVIEW_ACCOUNT_CODE: code }, "examen@leximon.fr", 6)).toBe(
        undefined,
      );
    }
  });
});
