import { describe, expect, it } from "vitest";
import { cleanPageUrl, cleanPayload, cleanReferrer } from "./clean-url";

const ORIGIN = "https://leximon.fr";

describe("cleanPageUrl", () => {
  it("keeps a public page as it is", () => {
    expect(cleanPageUrl("https://leximon.fr/carte/abajoue", ORIGIN)).toBe(
      "https://leximon.fr/carte/abajoue",
    );
  });

  it("masks the code of an invitation, a friend link and an unsubscription", () => {
    expect(cleanPageUrl("https://leximon.fr/invitation/K7Q2ZP", ORIGIN)).toBe(
      "https://leximon.fr/invitation/[code]",
    );
    expect(cleanPageUrl("https://leximon.fr/ami/AB12CD", ORIGIN)).toBe(
      "https://leximon.fr/ami/[code]",
    );
    expect(cleanPageUrl("https://leximon.fr/desinscription/eyJhbGc.sig", ORIGIN)).toBe(
      "https://leximon.fr/desinscription/[jeton]",
    );
  });

  it("leaves the invitation page without a code alone", () => {
    expect(cleanPageUrl("https://leximon.fr/invitation", ORIGIN)).toBe(
      "https://leximon.fr/invitation",
    );
  });

  it("keeps only the arrival source among the query parameters, and drops the hash", () => {
    expect(cleanPageUrl("https://leximon.fr/?src=tiktok-1&code=secret#top", ORIGIN)).toBe(
      "https://leximon.fr/?src=tiktok-1",
    );
    expect(cleanPageUrl("https://leximon.fr/echanges?offre=42", ORIGIN)).toBe(
      "https://leximon.fr/echanges",
    );
  });

  it("does not count the back-office", () => {
    expect(cleanPageUrl("https://leximon.fr/admin", ORIGIN)).toBeNull();
    expect(cleanPageUrl("https://leximon.fr/admin/joueurs/123", ORIGIN)).toBeNull();
  });
});

describe("cleanReferrer", () => {
  it("cleans a page of the site, given as a path", () => {
    expect(cleanReferrer("/invitation/K7Q2ZP?src=yt", ORIGIN)).toBe("/invitation/[code]?src=yt");
    expect(cleanReferrer("/admin/mesure", ORIGIN)).toBe("");
  });

  it("keeps only the origin of another site", () => {
    expect(cleanReferrer("https://www.google.com/search?q=gourgandine", ORIGIN)).toBe(
      "https://www.google.com",
    );
  });

  it("returns nothing for an empty or unreadable referrer", () => {
    expect(cleanReferrer("", ORIGIN)).toBe("");
    expect(cleanReferrer("http://", ORIGIN)).toBe("");
  });
});

describe("cleanPayload", () => {
  it("cleans both addresses and keeps the other fields", () => {
    expect(
      cleanPayload(
        {
          website: "id",
          url: "https://leximon.fr/ami/AB12CD",
          referrer: "https://discord.com/channels/1/2",
        },
        ORIGIN,
      ),
    ).toEqual({
      website: "id",
      url: "https://leximon.fr/ami/[code]",
      referrer: "https://discord.com",
    });
  });

  it("cancels an event from the back-office", () => {
    expect(cleanPayload({ url: "https://leximon.fr/admin", referrer: "" }, ORIGIN)).toBeNull();
  });
});
