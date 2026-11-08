import { ACCOUNT_ERROR_CODES, type LinkPreviewResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  ageBracketLabel,
  cardCount,
  codeErrorMessage,
  confirmStep,
  emailStep,
  GOOGLE_LINKED_TOAST,
  googleLinkError,
  googleReturn,
  needsConfirmation,
  needsNewCode,
  SIGNED_IN_TOAST,
  signedInToast,
  signedInWay,
  WELCOME_TOAST,
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

describe("emailStep", () => {
  it("asks about news only when an account is created", () => {
    expect(emailStep("signup")).toMatchObject({ title: "Crée ton compte", asksNews: true });
    expect(emailStep("signin")).toMatchObject({ title: "Connecte-toi", asksNews: false });
  });
});

describe("confirmStep", () => {
  it("tells a player come to sign in that the address has no account yet", () => {
    const step = confirmStep(preview({ outcome: "none" }), DEFAULT_PACK_NOUN, "signin");
    expect(step).toMatchObject({ title: "Pas encore de compte", needsAge: true });
    expect(step.text).toContain("Aucun compte n'utilise encore cette adresse.");

    const known = confirmStep(preview({ accountExists: true }), DEFAULT_PACK_NOUN, "signin");
    expect(known.title).toBe("Connecte-toi");
  });

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
    expect(step.warning).toContain("les 5 cartes obtenues ici seront perdues");

    const one = confirmStep(
      preview({ accountExists: true, outcome: "abandon", guestCards: 1 }),
      DEFAULT_PACK_NOUN,
    );
    expect(one.warning).toContain("la carte obtenue ici sera perdue");
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
      "tes cartes sont toujours là",
    );
  });
});

describe("ageBracketLabel", () => {
  it("reads the bracket as words", () => {
    expect(ageBracketLabel("15-17")).toBe("15 à 17 ans");
    expect(ageBracketLabel("50+")).toBe("50 ans et plus");
  });
});

describe("googleReturn", () => {
  it("says nothing when the player turned back at Google's", () => {
    expect(googleReturn("access_denied", null)).toEqual({ kind: "cancelled" });
  });

  it("sends a Google account without an account here to « Créer un compte »", () => {
    expect(googleReturn("signup_disabled", null).kind).toBe("no_account");
  });

  it("warns with the count of cards the guest would lose", () => {
    const back = googleReturn(ACCOUNT_ERROR_CODES.guestLossNotAcknowledged, "12");
    expect(back.kind === "guest_loss" && back.step.warning).toBe(
      "Si tu te connectes, les 12 cartes obtenues ici seront perdues.",
    );
    const one = googleReturn(ACCOUNT_ERROR_CODES.guestLossNotAcknowledged, "1");
    expect(one.kind === "guest_loss" && one.step.warning).toBe(
      "Si tu te connectes, la carte obtenue ici sera perdue.",
    );
    const none = googleReturn(ACCOUNT_ERROR_CODES.guestLossNotAcknowledged, null);
    expect(none.kind === "guest_loss" && none.step.warning).toBe(
      "Si tu te connectes, la progression de cette partie sera perdue.",
    );
  });

  it("explains a suspension, an unverified address, and anything else", () => {
    expect(googleReturn("BANNED_USER", null)).toEqual({
      kind: "error",
      message: "Ce compte a été suspendu. Écris à contact@leximon.fr pour en savoir plus.",
    });
    expect(googleReturn("account_not_linked", null)).toMatchObject({
      message: "Google n'a pas vérifié cette adresse. Connecte-toi plutôt avec un code par e-mail.",
    });
    expect(googleReturn("state_mismatch", null)).toMatchObject({
      message: "La connexion avec Google a échoué. Réessaie.",
    });
  });
});

describe("signedInWay", () => {
  const account = (justJoined: boolean, googleJustLinked: boolean) => ({
    justJoined,
    googleJustLinked,
  });

  it("welcomes a new account, even one made with Google", () => {
    expect(signedInToast(signedInWay(account(true, false), true))).toBe(WELCOME_TOAST);
    expect(signedInToast(signedInWay(account(true, false), false))).toBe(WELCOME_TOAST);
  });

  it("says Google was added only on the way back from Google", () => {
    expect(signedInToast(signedInWay(account(false, true), true))).toBe(GOOGLE_LINKED_TOAST);
    expect(signedInToast(signedInWay(account(false, true), false))).toBe(SIGNED_IN_TOAST);
  });

  it("greets a returning player", () => {
    expect(signedInToast(signedInWay(account(false, false), true))).toBe(SIGNED_IN_TOAST);
  });
});

describe("googleLinkError", () => {
  it("says nothing when the player turned back at Google's", () => {
    expect(googleLinkError("access_denied", "a@b.fr")).toBeNull();
  });

  it("names the address the Google account must have", () => {
    expect(googleLinkError("email_does_not_match", "a@b.fr")).toContain("a@b.fr");
  });

  it("falls back to a retry for an unknown reason", () => {
    expect(googleLinkError("whatever", "a@b.fr")).toBe(
      "L'association avec Google a échoué. Réessaie.",
    );
  });
});
