import { describe, expect, it } from "vitest";
import { decideGuestLink } from "./guest-link";

describe("decideGuestLink", () => {
  it("transfers everything to an account without any game", () => {
    expect(decideGuestLink({ accountHasGame: false, guestHasCollection: true })).toEqual({
      outcome: "transfer",
      losesCollection: false,
    });
    expect(decideGuestLink({ accountHasGame: false, guestHasCollection: false })).toEqual({
      outcome: "transfer",
      losesCollection: false,
    });
  });

  it("abandons a guest that owns something when the account already plays", () => {
    expect(decideGuestLink({ accountHasGame: true, guestHasCollection: true })).toEqual({
      outcome: "abandon",
      losesCollection: true,
    });
  });

  it("abandons an empty guest without any loss to warn about", () => {
    expect(decideGuestLink({ accountHasGame: true, guestHasCollection: false })).toEqual({
      outcome: "abandon",
      losesCollection: false,
    });
  });
});
