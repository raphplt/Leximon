import { rarityStyles } from "@leximon/tokens";

/**
 * The shell shared by every e-mail Leximon sends (D-036): a 560 px column of table cells with
 * inline styles, which is what Outlook, Gmail and Apple Mail all read. No remote image and no
 * tracked link: nothing is blocked, nothing follows the reader.
 */

/** An e-mail as it leaves our code, before the provider. */
export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const paper = rarityStyles.common;

/** Colors of the "Planche populaire" paper (D-022), from the shared tokens. */
export const EMAIL_COLORS = {
  page: paper.chip,
  paper: paper.paper,
  ink: paper.ink,
  muted: paper.muted,
  rule: "#D8CFBD",
} as const;

/** System serif fonts only: web fonts are blocked or ignored by most mail clients. */
export const SERIF = "Georgia, 'Times New Roman', Times, serif";
export const MONOSPACE = "'Courier New', Courier, monospace";

export const SITE_URL = "https://leximon.fr";

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
<body style="margin:0;padding:0;background-color:${c.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.page};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${c.paper};border:1px solid ${c.rule};border-radius:12px;">
<tr><td style="padding:28px 32px 0;font-family:${SERIF};font-size:22px;font-weight:bold;color:${c.ink};">Leximon</td></tr>
<tr><td style="padding:20px 32px 28px;font-family:${SERIF};font-size:17px;line-height:1.55;color:${c.ink};">
${bodyHtml}
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td align="center" style="padding:16px 32px;font-family:${SERIF};font-size:13px;line-height:1.5;color:${c.muted};">${footerHtml}</td></tr>
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
  return `Leximon · <a href="${SITE_URL}" style="color:${EMAIL_COLORS.muted};">leximon.fr</a>`;
}
