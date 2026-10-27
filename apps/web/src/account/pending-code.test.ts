import { describe, expect, it } from "vitest";
import { parsePendingCode } from "./pending-code";

const SENT = 1_000_000;
const stored = (value: unknown) => JSON.stringify(value);

describe("parsePendingCode", () => {
  it("gives back the address and the consent while the code is valid", () => {
    const raw = stored({ email: "a@b.fr", newsOptIn: true, sentAt: SENT });
    expect(parsePendingCode(raw, SENT + 9 * 60_000)).toEqual({ email: "a@b.fr", newsOptIn: true });
  });

  it("forgets a code past its ten minutes", () => {
    const raw = stored({ email: "a@b.fr", newsOptIn: false, sentAt: SENT });
    expect(parsePendingCode(raw, SENT + 10 * 60_000 + 1)).toBeNull();
  });

  it("refuses a code sent in the future, or anything that is not ours", () => {
    expect(parsePendingCode(stored({ email: "a@b.fr", sentAt: SENT + 1 }), SENT)).toBeNull();
    expect(parsePendingCode(stored({ email: "nope", sentAt: SENT }), SENT)).toBeNull();
    expect(parsePendingCode("not json", SENT)).toBeNull();
    expect(parsePendingCode("null", SENT)).toBeNull();
  });

  it("never assumes consent", () => {
    const raw = stored({ email: "a@b.fr", newsOptIn: "yes", sentAt: SENT });
    expect(parsePendingCode(raw, SENT)?.newsOptIn).toBe(false);
  });
});
