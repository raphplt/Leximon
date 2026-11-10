import { z } from "zod";

/** Whether a domain receives e-mail; `unknown` when DNS gave no clear answer. */
export type MailDomainVerdict = "deliverable" | "undeliverable" | "unknown";

/** Looks up whether an address's domain receives e-mail. Tests pass one without network. */
export type MailDomainResolver = (domain: string) => Promise<MailDomainVerdict>;

/** DNS record types, as numbered in the JSON answers. */
const RECORD_TYPE = { A: 1, MX: 15, AAAA: 28 } as const;
type RecordType = keyof typeof RECORD_TYPE;

const RCODE_NOERROR = 0;
const RCODE_NXDOMAIN = 3;

const DOH_URL = "https://cloudflare-dns.com/dns-query";

/** Past this, the code leaves anyway: a slow resolver must not hold sign-ins back. */
const LOOKUP_TIMEOUT_MS = 1500;

const dnsAnswerSchema = z.object({
  Status: z.number().int(),
  Answer: z.array(z.object({ type: z.number().int(), data: z.string() })).optional(),
});
export type DnsAnswer = z.infer<typeof dnsAnswerSchema>;

/** The domain of an address, in the ASCII form DNS reads; `null` when there is none to look up. */
export function mailDomainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).trim();
  if (domain === "" || domain.startsWith("[")) return null;
  try {
    // Punycode for internationalised names: the URL parser does the IDNA conversion.
    const ascii = new URL(`http://${domain}`).hostname;
    return ascii.includes(".") ? ascii : null;
  } catch {
    return null;
  }
}

/** Domains whose mailboxes ignore the dots of the local part. */
const DOTLESS_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * The mailbox an address is delivered to, as far as it can be told without asking: lowercase,
 * without the `+tag` most providers ignore, and without Gmail's dots. Only for counting what one
 * mailbox receives; never to compare accounts, since some domain may deliver `a+b` apart from `a`.
 */
export function mailboxOf(email: string): string {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 1) return address;
  const domain = address.slice(at + 1);
  const plus = address.indexOf("+");
  const local = address.slice(0, plus > 0 && plus < at ? plus : at);
  if (!DOTLESS_DOMAINS.has(domain)) return `${local}@${domain}`;
  return `${local.replaceAll(".", "")}@gmail.com`;
}

/**
 * What the MX answer says. A domain that publishes only the null MX (`0 .`) declares it takes no
 * mail; a domain without MX may still take mail on its own address, so `null` asks for A/AAAA.
 */
export function verdictFromMx(answer: DnsAnswer): MailDomainVerdict | null {
  if (answer.Status === RCODE_NXDOMAIN) return "undeliverable";
  if (answer.Status !== RCODE_NOERROR) return "unknown";
  const hosts = (answer.Answer ?? [])
    .filter((record) => record.type === RECORD_TYPE.MX)
    .map((record) => record.data.trim().split(/\s+/)[1] ?? "");
  if (hosts.length === 0) return null;
  return hosts.some((host) => host !== "." && host !== "") ? "deliverable" : "undeliverable";
}

/** Without MX, mail goes to the domain's own address (RFC 5321, § 5.1). */
export function verdictFromAddresses(answers: readonly DnsAnswer[]): MailDomainVerdict {
  if (answers.some((answer) => answer.Status !== RCODE_NOERROR)) return "unknown";
  const found = answers.some((answer) =>
    (answer.Answer ?? []).some(
      (record) => record.type === RECORD_TYPE.A || record.type === RECORD_TYPE.AAAA,
    ),
  );
  return found ? "deliverable" : "undeliverable";
}

/**
 * Cloudflare's DNS over HTTPS, from the Worker: no dependency, a few milliseconds. Only the domain
 * leaves, never the address. Any failure reads as `unknown`, and the code is sent.
 */
export const dnsOverHttpsResolver: MailDomainResolver = async (domain) => {
  try {
    const signal = AbortSignal.timeout(LOOKUP_TIMEOUT_MS);
    const mx = verdictFromMx(await queryDns(domain, "MX", signal));
    if (mx !== null) return mx;
    const addresses = await Promise.all([
      queryDns(domain, "A", signal),
      queryDns(domain, "AAAA", signal),
    ]);
    return verdictFromAddresses(addresses);
  } catch {
    return "unknown";
  }
};

async function queryDns(domain: string, type: RecordType, signal: AbortSignal): Promise<DnsAnswer> {
  const url = `${DOH_URL}?name=${encodeURIComponent(domain)}&type=${type}`;
  const response = await fetch(url, { headers: { accept: "application/dns-json" }, signal });
  if (!response.ok) throw new Error(`DNS over HTTPS answered ${response.status}`);
  return dnsAnswerSchema.parse(await response.json());
}
