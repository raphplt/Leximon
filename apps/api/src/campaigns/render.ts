import {
  buttonHtml,
  footerLinkHtml,
  type RenderedEmail,
  renderHtmlLayout,
  renderTextLayout,
  siteLinkHtml,
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
    const footerHtml = `${siteLinkHtml()}<br>${footerLinkHtml({ label: "Ne plus recevoir ces e-mails", url: links.unsubscribePage })}`;
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
