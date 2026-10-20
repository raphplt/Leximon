import { describe, expect, it } from "vitest";
import { planTransfers } from "./transfers";

describe("planTransfers", () => {
  it("moves given cards to the recipient and wanted cards to the proposer, sorted", () => {
    expect(
      planTransfers({ proposerId: "p", recipientId: "r", give: ["b", "a"], want: ["c"] }),
    ).toEqual({
      debits: [
        { userId: "p", cardId: "a" },
        { userId: "p", cardId: "b" },
        { userId: "r", cardId: "c" },
      ],
      credits: [
        { userId: "p", cardId: "c" },
        { userId: "r", cardId: "a" },
        { userId: "r", cardId: "b" },
      ],
    });
  });

  it("cancels out a card on both sides, so no row is written twice", () => {
    expect(
      planTransfers({ proposerId: "p", recipientId: "r", give: ["a", "x"], want: ["x"] }),
    ).toEqual({
      debits: [{ userId: "p", cardId: "a" }],
      credits: [{ userId: "r", cardId: "a" }],
    });
    expect(planTransfers({ proposerId: "p", recipientId: "r", give: ["x"], want: ["x"] })).toEqual({
      debits: [],
      credits: [],
    });
  });
});
