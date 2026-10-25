import { describe, expect, it } from "vitest";
import { doorFrom } from "./invitation";

describe("doorFrom", () => {
  it("takes a code as an invitation, in lower case", () => {
    expect(doorFrom(" Bouquin-42 ")).toEqual({ kind: "invite", code: "bouquin-42" });
  });

  it("finds the code in a pasted invitation link", () => {
    expect(doorFrom("https://leximon.fr/invitation/abc123?src=discord")).toEqual({
      kind: "invite",
      code: "abc123",
    });
    expect(doorFrom("leximon://invitation/abc123")).toEqual({ kind: "invite", code: "abc123" });
  });

  it("finds the friend in a pasted friend link", () => {
    expect(doorFrom("https://leximon.fr/ami/7k3m-9q2x")).toEqual({
      kind: "friend",
      code: "7K3M9Q2X",
    });
  });

  it("refuses what holds no way in", () => {
    expect(doorFrom("")).toBeNull();
    expect(doorFrom("https://leximon.fr/jouer")).toBeNull();
    expect(doorFrom("https://leximon.fr/ami/nope")).toBeNull();
    expect(doorFrom("pas un code !")).toBeNull();
  });
});
