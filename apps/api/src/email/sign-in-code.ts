import {
  EMAIL_COLORS,
  escapeHtml,
  MONOSPACE,
  type RenderedEmail,
  renderHtmlLayout,
  renderTextLayout,
  siteLinkHtml,
} from "./layout";

export interface SignInCodeContent {
  readonly code: string;
  /** How long the code stays valid, in minutes. */
  readonly validMinutes: number;
}

/**
 * The sign-in code e-mail (wording approved on 2026-10-21). Functional, so dry
 * (`docs/voix.md`): the code first, one sentence, nothing reassuring. The code is in the subject so
 * that it can be read from the notification. No unsubscribe link: it is not a campaign.
 */
export function renderSignInCodeEmail({ code, validMinutes }: SignInCodeContent): RenderedEmail {
  const subject = `${code}, ton code Leximon`;
  const sentence = `Voici ton code de connexion Leximon, valable ${validMinutes} minutes.`;
  const ignore = "Si tu n'as pas demandé ce code, ignore simplement cet e-mail.";
  const c = EMAIL_COLORS;

  const bodyHtml = [
    `<p style="margin:0 0 20px;"><span style="display:inline-block;padding:12px 20px;background-color:${c.page};border:1px solid ${c.rule};border-radius:8px;font-family:${MONOSPACE};font-size:32px;font-weight:bold;letter-spacing:8px;color:${c.ink};">${escapeHtml(code)}</span></p>`,
    `<p style="margin:0 0 16px;">${escapeHtml(sentence)}</p>`,
    `<p style="margin:0;color:${c.muted};">${escapeHtml(ignore)}</p>`,
  ].join("\n");

  return {
    subject,
    text: renderTextLayout(`${code}\n\n${sentence}\n\n${ignore}`, "Leximon · leximon.fr"),
    html: renderHtmlLayout({
      title: subject,
      preheader: sentence,
      bodyHtml,
      footerHtml: siteLinkHtml(),
    }),
  };
}
