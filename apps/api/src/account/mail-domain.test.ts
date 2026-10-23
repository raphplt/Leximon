import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dnsOverHttpsResolver,
  mailDomainOf,
  verdictFromAddresses,
  verdictFromMx,
} from "./mail-domain";

const MX = 15;
const A = 1;
const CNAME = 5;

describe("mailDomainOf", () => {
  it("takes the part after the last @", () => {
    expect(mailDomainOf("joueur@gmail.com")).toBe("gmail.com");
    expect(mailDomainOf('"a@b"@laposte.net')).toBe("laposte.net");
  });

  it("converts internationalised domains to their ASCII form", () => {
    expect(mailDomainOf("joueur@café.fr")).toBe("xn--caf-dma.fr");
  });

  it("leaves nothing to look up when there is no usable domain", () => {
    expect(mailDomainOf("joueur")).toBeNull();
    expect(mailDomainOf("@gmail.com")).toBeNull();
    expect(mailDomainOf("joueur@localhost")).toBeNull();
    expect(mailDomainOf("joueur@[192.0.2.1]")).toBeNull();
    expect(mailDomainOf("joueur@exa mple.com")).toBeNull();
  });
});

describe("verdictFromMx", () => {
  it("reads a domain with a mail server as deliverable", () => {
    expect(verdictFromMx({ Status: 0, Answer: [{ type: MX, data: "10 mx.example.net." }] })).toBe(
      "deliverable",
    );
  });

  it("reads a domain that does not exist, or takes no mail, as undeliverable", () => {
    expect(verdictFromMx({ Status: 3 })).toBe("undeliverable");
    expect(verdictFromMx({ Status: 0, Answer: [{ type: MX, data: "0 ." }] })).toBe("undeliverable");
  });

  it("asks for the domain's own address when it has no MX", () => {
    expect(verdictFromMx({ Status: 0 })).toBeNull();
    expect(
      verdictFromMx({ Status: 0, Answer: [{ type: CNAME, data: "elsewhere.example." }] }),
    ).toBeNull();
  });

  it("does not decide on a DNS failure", () => {
    expect(verdictFromMx({ Status: 2 })).toBe("unknown");
  });
});

describe("verdictFromAddresses", () => {
  it("accepts a domain without MX that has an address", () => {
    expect(
      verdictFromAddresses([
        { Status: 0, Answer: [{ type: A, data: "192.0.2.1" }] },
        { Status: 0 },
      ]),
    ).toBe("deliverable");
  });

  it("refuses a domain with neither MX nor address", () => {
    expect(verdictFromAddresses([{ Status: 0 }, { Status: 0 }])).toBe("undeliverable");
  });

  it("does not decide when a lookup failed", () => {
    expect(verdictFromAddresses([{ Status: 2 }, { Status: 0 }])).toBe("unknown");
  });
});

describe("dnsOverHttpsResolver", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks Cloudflare for the domain only", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ Status: 0, Answer: [{ type: MX, data: "5 gmail-smtp-in.l.google.com." }] }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await dnsOverHttpsResolver("gmail.com")).toBe("deliverable");
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0]?.at(0))).toBe(
      "https://cloudflare-dns.com/dns-query?name=gmail.com&type=MX",
    );
  });

  it("lets the code go when DNS cannot be reached or answers nonsense", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("offline"))),
    );
    expect(await dnsOverHttpsResolver("gmail.com")).toBe("unknown");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>", { status: 200 })),
    );
    expect(await dnsOverHttpsResolver("gmail.com")).toBe("unknown");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 502 })),
    );
    expect(await dnsOverHttpsResolver("gmail.com")).toBe("unknown");
  });
});
