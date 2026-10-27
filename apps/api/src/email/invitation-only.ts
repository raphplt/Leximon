import {
  buttonHtml,
  DISCORD_URL,
  EMAIL_COLORS,
  escapeHtml,
  type RenderedEmail,
  renderHtmlLayout,
  renderTextLayout,
  siteLinkHtml,
} from "./layout";

/**
 * Sent instead of a code while the beta is on invitation, to an address without an account that
 * brings no invitation: a code would only lead to a refusal once typed. The request gets the same
 * answer as a code, so nobody learns from it whether an address has an account.
 */
export function renderInvitationOnlyEmail(): RenderedEmail {
  const subject = "Leximon, c'est sur invitation";
  const noAccount =
    "Tu as demandé un code pour entrer dans Leximon, mais on n'a aucun compte à cette adresse. " +
    "Et pendant la bêta, on n'entre que sur invitation.";
  const discord = "Tu peux en demander une sur notre Discord.";
  const button = "Rejoindre le Discord";
  const haveOne =
    "Quelqu'un t'a déjà envoyé un lien d'invitation ? Ouvre-le, puis redemande ton code.";
  const ignore = "Si tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail.";
  const c = EMAIL_COLORS;

  const bodyHtml = [
    `<p style="margin:0 0 16px;">${escapeHtml(noAccount)}</p>`,
    `<p style="margin:0 0 8px;">${escapeHtml(discord)}</p>`,
    buttonHtml({ label: button, url: DISCORD_URL }),
    `<p style="margin:16px 0 16px;">${escapeHtml(haveOne)}</p>`,
    `<p style="margin:0;color:${c.muted};">${escapeHtml(ignore)}</p>`,
  ].join("\n");

  return {
    subject,
    text: renderTextLayout(
      `${noAccount}\n\n${discord}\n${DISCORD_URL}\n\n${haveOne}\n\n${ignore}`,
      "Leximon · leximon.fr",
    ),
    html: renderHtmlLayout({
      title: subject,
      preheader: noAccount,
      bodyHtml,
      footerHtml: siteLinkHtml(),
    }),
  };
}
