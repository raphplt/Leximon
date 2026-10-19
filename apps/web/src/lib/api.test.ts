import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOwnedCards, fetchWallet } from "./api";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guest sign-in", () => {
  it("signs in once when parallel requests find no session", async () => {
    let signedIn = false;
    const signIns: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/api/auth/sign-in/anonymous")) {
          signIns.push(url);
          await new Promise((resolve) => setTimeout(resolve, 5));
          signedIn = true;
          return json(200, {});
        }
        if (!signedIn) return json(401, { error: "unauthorized" });
        if (url.includes("/me/wallet")) return json(200, { stored: 6, nextRefillAt: null });
        return json(200, { cards: [], nextCursor: null });
      }),
    );

    const [wallet, cards] = await Promise.all([fetchWallet(), fetchOwnedCards()]);

    expect(wallet).toEqual({ stored: 6, nextRefillAt: null });
    expect(cards).toEqual([]);
    expect(signIns).toHaveLength(1);
  });

  it("rejects a response that breaks the contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(200, { stored: -1, nextRefillAt: null })),
    );
    await expect(fetchWallet()).rejects.toMatchObject({ message: "unexpected_response" });
  });
});
