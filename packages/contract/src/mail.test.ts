import { describe, expect, it } from "vitest";
import { mailResponseSchema } from "./mail";

describe("the mail", () => {
  it("leaves out a letter of a kind this version does not know", () => {
    const letter = {
      kind: "joust_ended",
      id: 2,
      player: null,
      read: false,
      createdAt: "2026-11-09T08:00:00.000Z",
      joustId: "8da39c89-f2d7-4463-b15e-21ebc88c1739",
    };
    const mail = mailResponseSchema.parse({
      letters: [{ ...letter, id: 3, kind: "a_kind_from_later" }, letter],
      unread: 2,
      slipping: null,
      hasMore: false,
      referralRewards: [],
    });
    expect(mail.letters.map((kept) => kept.id)).toEqual([2]);
  });
});
