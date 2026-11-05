import { colors, room, toy, toyMatters } from "@leximon/tokens";

/**
 * The shell shared by every e-mail Leximon sends: a cream leaf on the dark wood of the room, in a
 * 560 px column of table cells with inline styles, which is what Outlook, Gmail and Apple Mail
 * all read. Plain colours only: no remote image and no tracked link, so nothing is blocked and
 * nothing follows the reader.
 */

/** An e-mail as it leaves our code, before the provider. */
export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Colours of the room and of its paper, from the shared tokens. */
export const EMAIL_COLORS = {
  /** The wood around the leaf. */
  wood: room.shelf.bottom,
  /** The line under the leaf, on the wood. */
  woodInk: colors.bindingInkMuted,
  paper: colors.paper,
  ink: colors.paperInk,
  muted: colors.paperInkMuted,
  /** The leaf's edge, and the frame of a code. */
  rule: toyMatters.paper.edge,
  /** The hollow of a code, a shade darker than the leaf. */
  well: toyMatters.paper.bottom,
  /** The gilt rule under the name. */
  gilt: room.shelf.gilt,
} as const;

/** System serif fonts only: web fonts are blocked or ignored by most mail clients. */
export const SERIF = "Georgia, 'Times New Roman', Times, serif";
export const MONOSPACE = "'Courier New', Courier, monospace";

export const SITE_URL = "https://leximon.fr";

/** Leximon's Discord, where the beta's invitations are given. */
export const DISCORD_URL = "https://discord.gg/WtrkBZKpJP";

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for an HTML element or a quoted attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

export interface LayoutInput {
  /** Document title: the subject, read by some clients and screen readers. */
  readonly title: string;
  /** Short line shown after the subject in the inbox list. Plain text. */
  readonly preheader: string;
  /** Body of the paper column, already rendered and escaped. */
  readonly bodyHtml: string;
  /** Line under the paper, already rendered and escaped. */
  readonly footerHtml: string;
}

export function renderHtmlLayout({ title, preheader, bodyHtml, footerHtml }: LayoutInput): string {
  const c = EMAIL_COLORS;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${c.wood};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.wood};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${c.paper};border:2px solid ${c.rule};border-radius:16px;">
<tr><td style="padding:28px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 14px;border-bottom:2px solid ${c.gilt};font-family:${SERIF};font-size:24px;font-weight:bold;letter-spacing:0.5px;color:${c.ink};">Leximon</td></tr></table></td></tr>
<tr><td style="padding:22px 32px 30px;font-family:${SERIF};font-size:17px;line-height:1.55;color:${c.ink};">
${bodyHtml}
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td align="center" style="padding:18px 32px;font-family:${SERIF};font-size:13px;line-height:1.6;color:${c.woodInk};">${footerHtml}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

/** The plain-text part: the body, then the footer after a signature separator. */
export function renderTextLayout(bodyText: string, footerText: string): string {
  return `${bodyText.trim()}\n\n-- \n${footerText.trim()}\n`;
}

/** Footer link to the site, without tracking parameters. */
export function siteLinkHtml(): string {
  return `Leximon · ${footerLinkHtml({ label: "leximon.fr", url: SITE_URL })}`;
}

/** A link of the footer, on the wood. */
export function footerLinkHtml({
  label,
  url,
}: {
  readonly label: string;
  readonly url: string;
}): string {
  return `<a href="${escapeHtml(url)}" style="color:${EMAIL_COLORS.woodInk};">${escapeHtml(label)}</a>`;
}

/**
 * The main action as the game draws it: old gold outlined in ink, its thickness under it. Made of
 * table cells, since Outlook ignores the padding of a styled link; a client without gradients or
 * rounded corners still shows a plain gold block.
 */
export function buttonHtml({
  label,
  url,
}: {
  readonly label: string;
  readonly url: string;
}): string {
  const gold = toyMatters.gold;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 8px;"><tr><td style="background-color:${gold.edge};border:2px solid ${toy.outline};border-radius:16px;padding:0 0 4px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 28px;background-color:${gold.bottom};background-image:linear-gradient(${gold.top},${gold.bottom});border-radius:14px;font-family:${SERIF};font-size:17px;font-weight:bold;color:${toy.outline};text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;
}
