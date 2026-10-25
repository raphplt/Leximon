import { ACCOUNT_ERROR_CODES, type LinkPreviewResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  ageBracketLabel,
  cardCount,
  codeErrorMessage,
  confirmStep,
  needsConfirmation,
  needsNewCode,
} from "./account";
import { DEFAULT_PACK_NOUN } from "./pack";

function preview(overrides: Partial<LinkPreviewResponse> = {}): LinkPreviewResponse {
  return {
    accountExists: false,
    outcome: "transfer",
    guestCards: 12,
    inviteRequired: false,
    ...overrides,
  };
}

describe("cardCount", () => {
  it("agrees with the number", () => {
    expect(cardCount(0)).toBe("aucune carte");
    expect(cardCount(1)).toBe("1 carte");
    expect(cardCount(30)).toBe("30 cartes");
  });
});

describe("confirmStep", () => {
  it("offers no account to create when the beta needs an invitation the player lacks", () => {
    const step = confirmStep(preview({ outcome: "none", inviteRequired: true }), DEFAULT_PACK_NOUN);
    expect(step).toMatchObject({ closed: true, needsAge: false });
  });

  it("asks for the age declaration only when an account is created", () => {
    const signUp = confirmStep(preview(), DEFAULT_PACK_NOUN);
    expect(signUp).toMatchObject({ needsAge: true, acceptsLoss: false, warning: null });
    expect(signUp.text).toContain("12 cartes");

    const emptyAccount = confirmStep(preview({ accountExists: true }), DEFAULT_PACK_NOUN);
    expect(emptyAccount.needsAge).toBe(false);
  });

  it("warns that the guest's cards stay behind when the account already plays", () => {
    const step = confirmStep(
      preview({ accountExists: true, outcome: "abandon", guestCards: 5 }),
      DEFAULT_PACK_NOUN,
    );
    expect(step).toMatchObject({ needsAge: false, acceptsLoss: true });
    expect(step.warning).toContain("les 5 cartes jouées ici seront perdues");

    const one = confirmStep(
      preview({ accountExists: true, outcome: "abandon", guestCards: 1 }),
      DEFAULT_PACK_NOUN,
    );
    expect(one.warning).toContain("la carte jouée ici sera perdue");
  });
});

describe("needsConfirmation", () => {
  it("signs in at once when nothing of the guest is at stake", () => {
    expect(
      needsConfirmation(preview({ accountExists: true, outcome: "none", guestCards: 0 })),
    ).toBe(false);
  });

  it("asks before creating an account or abandoning a guest", () => {
    expect(needsConfirmation(preview())).toBe(true);
    expect(needsConfirmation(preview({ outcome: "none", guestCards: 0 }))).toBe(true);
    expect(needsConfirmation(preview({ accountExists: true, outcome: "abandon" }))).toBe(true);
  });
});

describe("code errors", () => {
  it("keeps the code after a typo, asks for a new one when it is used up", () => {
    expect(needsNewCode("invalid_code")).toBe(false);
    expect(needsNewCode("INVALID_OTP")).toBe(false);
    expect(needsNewCode("TOO_MANY_ATTEMPTS")).toBe(true);
    expect(needsNewCode(ACCOUNT_ERROR_CODES.accountLinkFailed)).toBe(true);
  });

  it("says the cards stayed when the transfer failed", () => {
    expect(codeErrorMessage(ACCOUNT_ERROR_CODES.accountLinkFailed)).toContain(
      "Tes cartes n'ont pas bougé",
    );
  });
});

describe("ageBracketLabel", () => {
  it("reads the bracket as words", () => {
    expect(ageBracketLabel("15-17")).toBe("15 à 17 ans");
    expect(ageBracketLabel("50+")).toBe("50 ans et plus");
  });
});
