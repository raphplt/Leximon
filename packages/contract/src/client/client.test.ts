import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_ERROR_CODES } from "../account";
import { withQuery } from "./http";
import { type ApiTransport, BetaClosedError, createApiClient } from "./index";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const WALLET = {
  stored: 6,
  nextRefillAt: null,
  bonus: 0,
  garni: 0,
  bonusCap: 10,
  capacity: 6,
  ecus: 0,
};

describe("guest sign-in", () => {
  it("signs in once when parallel requests find no session", async () => {
    let signedIn = false;
    const signIns: string[] = [];
    const transport: ApiTransport = async (path) => {
      if (path === "/api/auth/sign-in/anonymous") {
        signIns.push(path);
        await new Promise((resolve) => setTimeout(resolve, 5));
        signedIn = true;
        return json(200, {});
      }
      if (!signedIn) return json(401, { error: "unauthorized" });
      if (path === "/me/wallet") return json(200, WALLET);
      return json(200, { cards: [], nextCursor: null });
    };
    const api = createApiClient({ transport });

    const [wallet, cards] = await Promise.all([api.fetchWallet(), api.fetchOwnedCards()]);

    expect(wallet).toEqual(WALLET);
    expect(cards).toEqual([]);
    expect(signIns).toHaveLength(1);
  });

  it("brings the arrival headers, then forgets them once a player exists", async () => {
    const seen: Record<string, string>[] = [];
    let signedIn = false;
    const forget = vi.fn();
    const transport: ApiTransport = async (path, init) => {
      if (path === "/api/auth/sign-in/anonymous") {
        seen.push(init.headers as Record<string, string>);
        signedIn = true;
        return json(200, {});
      }
      return signedIn ? json(200, WALLET) : json(401, {});
    };
    const api = createApiClient({
      transport,
      arrival: { headers: () => ({ "X-Invite": "abc" }), forget },
    });

    await api.fetchWallet();

    expect(seen[0]).toMatchObject({ "X-Invite": "abc" });
    expect(forget).toHaveBeenCalledOnce();
  });

  it("tells the platform when the closed beta refuses a guest", async () => {
    const onBetaClosed = vi.fn();
    const transport: ApiTransport = async (path) =>
      path === "/api/auth/sign-in/anonymous"
        ? json(403, { code: ACCOUNT_ERROR_CODES.inviteRequired })
        : json(401, {});
    const api = createApiClient({ transport, onBetaClosed });

    await expect(api.fetchWallet()).rejects.toBeInstanceOf(BetaClosedError);
    expect(onBetaClosed).toHaveBeenCalledWith("invite_required");
  });
});

describe("responses", () => {
  it("rejects a response that breaks the contract", async () => {
    const api = createApiClient({ transport: async () => json(200, { ...WALLET, stored: -1 }) });
    await expect(api.fetchWallet()).rejects.toMatchObject({ message: "unexpected_response" });
  });

  it("turns a failed connection into a network error", async () => {
    const api = createApiClient({
      transport: async () => {
        throw new TypeError("Network request failed");
      },
    });
    await expect(api.fetchWallet()).rejects.toMatchObject({
      message: "network_error",
      status: null,
    });
  });

  it("reads a known refusal as a result", async () => {
    const api = createApiClient({
      transport: async () => json(409, { error: "reserve_full" }),
    });
    expect(await api.claimLevelReward(3)).toEqual({ kind: "refused", reason: "reserve_full" });
  });
});

describe("withQuery", () => {
  it("leaves out empty values and encodes the rest", () => {
    expect(withQuery("/clans", { q: "l'ours & co", entry: undefined, cursor: null })).toBe(
      "/clans?q=l'ours%20%26%20co",
    );
    expect(withQuery("/me/mail", { before: undefined })).toBe("/me/mail");
    expect(withQuery("/me/cards", { limit: 500, cursor: "" })).toBe("/me/cards?limit=500");
  });
});
