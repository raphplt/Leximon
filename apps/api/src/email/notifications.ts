import type { RecipientLinks } from "../campaigns/render";
import {
  buttonHtml,
  EMAIL_COLORS,
  escapeHtml,
  type RenderedEmail,
  renderHtmlLayout,
  renderTextLayout,
  SITE_URL,
} from "./layout";

/**
 * The e-mails that tell a player about their game. One action each, the subject in five words
 * at most (`docs/voix.md`). Every one carries the unsubscribe link and the one-click header of
 * its kind: they are not codes, the player may want them to stop.
 */

export interface NotificationEmail extends RenderedEmail {
  /** `List-Unsubscribe` and `List-Unsubscribe-Post`. */
  readonly headers: Readonly<Record<string, string>>;
}

/** A letter as the e-mail names it: the mail's own title, and a quote for a mention. */
export interface NewsLine {
  readonly title: string;
  readonly quote: string | null;
}

export interface NewsContent {
  readonly lines: readonly NewsLine[];
  /** Letters waiting beyond the lines shown. */
  readonly more: number;
  readonly button: { readonly label: string; readonly url: string };
}

/** At most this many letters named in an e-mail; the others are counted. */
export const NEWS_LINES = 4;

/** Letters wait in the mail: the first ones named, one button to answer. */
export function renderNewsEmail(content: NewsContent, links: RecipientLinks): NotificationEmail {
  const [first] = content.lines;
  const total = content.lines.length + content.more;
  const subject = total === 1 && first !== undefined ? first.title : `${total} lettres t'attendent`;
  const lines = content.lines.map((line) =>
    line.quote === null ? `${line.title}.` : `${line.title} : « ${line.quote} »`,
  );
  if (content.more > 0)
    lines.push(content.more === 1 ? "Et une autre." : `Et ${content.more} autres.`);
  return notificationEmail({
    subject,
    paragraphs: lines,
    button: content.button,
    links,
    stopLabel: "Plus d'e-mail quand on m'écrit",
  });
}

export interface ReminderContent {
  /** Sachets waiting in the free stock. */
  readonly stock: number;
  /** The most overdue word to review, and how many others. */
  readonly slipping: { readonly word: string; readonly others: number } | null;
  /** Letters unread in the mail. */
  readonly letters: number;
  /** No reminder follows this one. */
  readonly last: boolean;
}

/** The player stays away while their sachets are full. */
export function renderReminderEmail(
  content: ReminderContent,
  links: RecipientLinks,
): NotificationEmail {
  const paragraphs = [
    `Tu as ${content.stock} sachets prêts à être ouverts. Ton stock est plein : ouvre-les pour que la recharge reprenne.`,
  ];
  if (content.slipping !== null) {
    const { word, others } = content.slipping;
    paragraphs.push(
      others === 0
        ? `${capitalize(word)} attend d'être révisé.`
        : `${capitalize(word)} et ${others === 1 ? "un autre mot attendent" : `${others} autres mots attendent`} d'être révisés.`,
    );
  }
  if (content.letters > 0) {
    paragraphs.push(
      content.letters === 1
        ? "Une lettre t'attend au courrier."
        : `${content.letters} lettres t'attendent au courrier.`,
    );
  }
  if (content.last) paragraphs.push("Dernier rappel. On ne t'écrira plus pour tes sachets.");
  return notificationEmail({
    subject: `Tes ${content.stock} sachets t'attendent`,
    paragraphs,
    button: { label: "Ouvrir mes sachets", url: `${SITE_URL}/jouer` },
    links,
    stopLabel: "Plus de rappel pour mes sachets",
  });
}

function notificationEmail(input: {
  readonly subject: string;
  readonly paragraphs: readonly string[];
  readonly button: { readonly label: string; readonly url: string };
  readonly links: RecipientLinks;
  readonly stopLabel: string;
}): NotificationEmail {
  const { subject, paragraphs, button, links, stopLabel } = input;
  const c = EMAIL_COLORS;
  const bodyHtml = [
    ...paragraphs.map((text) => `<p style="margin:0 0 16px;">${escapeHtml(text)}</p>`),
    buttonHtml(button),
  ].join("\n");
  const footerHtml = `Leximon · <a href="${SITE_URL}" style="color:${c.muted};">leximon.fr</a><br><a href="${escapeHtml(links.unsubscribePage)}" style="color:${c.muted};">${escapeHtml(stopLabel)}</a>`;
  const bodyText = `${paragraphs.join("\n\n")}\n\n${button.label} : ${button.url}`;
  const footerText = `Leximon · leximon.fr\n${stopLabel} : ${links.unsubscribePage}`;
  return {
    subject,
    html: renderHtmlLayout({
      title: subject,
      preheader: paragraphs[0] ?? subject,
      bodyHtml,
      footerHtml,
    }),
    text: renderTextLayout(bodyText, footerText),
    headers: {
      "List-Unsubscribe": `<${links.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase("fr") + word.slice(1);
}
