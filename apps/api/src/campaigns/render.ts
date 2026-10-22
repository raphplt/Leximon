import {
  EMAIL_COLORS,
  escapeHtml,
  type RenderedEmail,
  renderHtmlLayout,
  renderTextLayout,
  SERIF,
  SITE_URL,
} from "../email/layout";
import { firstParagraphText, markdownToHtml, markdownToText } from "./markdown";

/** What an admin writes for a campaign. */
export interface CampaignContent {
  readonly subject: string;
  readonly bodyMarkdown: string;
  readonly buttonLabel: string | null;
  readonly buttonUrl: string | null;
}

/** Per-recipient links: the unsubscribe page, and the one-click address for mail clients. */
export interface RecipientLinks {
  /** Page of the web app with a confirmation button. */
  readonly unsubscribePage: string;
  /** API address that unsubscribes on `POST` (RFC 8058). */
  readonly oneClick: string;
}

export interface CampaignEmail extends RenderedEmail {
  /** `List-Unsubscribe` and `List-Unsubscribe-Post`, which Gmail and Yahoo require in bulk. */
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Renders the body once, then builds each recipient's e-mail from it: only the footer and the
 * headers change, so a batch of 100 costs one Markdown conversion.
 */
export function prepareCampaignEmail(
  content: CampaignContent,
): (links: RecipientLinks) => CampaignEmail {
  const button =
    content.buttonLabel !== null && content.buttonUrl !== null
      ? { label: content.buttonLabel, url: content.buttonUrl }
      : null;
  const bodyHtml = markdownToHtml(content.bodyMarkdown) + (button ? `\n${buttonHtml(button)}` : "");
  const bodyText =
    markdownToText(content.bodyMarkdown) + (button ? `\n\n${button.label} : ${button.url}` : "");
  const preheader = firstParagraphText(content.bodyMarkdown);

  return (links) => {
    const footerHtml = `Leximon · <a href="${SITE_URL}" style="color:${EMAIL_COLORS.muted};">leximon.fr</a><br><a href="${escapeHtml(links.unsubscribePage)}" style="color:${EMAIL_COLORS.muted};">Ne plus recevoir ces e-mails</a>`;
    const footerText = `Leximon · leximon.fr\nNe plus recevoir ces e-mails : ${links.unsubscribePage}`;
    return {
      subject: content.subject,
      html: renderHtmlLayout({ title: content.subject, preheader, bodyHtml, footerHtml }),
      text: renderTextLayout(bodyText, footerText),
      headers: {
        "List-Unsubscribe": `<${links.oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  };
}

/** A button made of a table cell: Outlook ignores the padding of a styled link. */
function buttonHtml({ label, url }: { readonly label: string; readonly url: string }): string {
  const c = EMAIL_COLORS;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px;"><tr><td style="background-color:${c.ink};border-radius:999px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;font-family:${SERIF};font-size:17px;font-weight:bold;color:${c.paper};text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;
}
