import { describe, expect, it } from "vitest";
import { firstParagraphText, markdownToHtml, markdownToText } from "./markdown";
import { prepareCampaignEmail } from "./render";

describe("campaign Markdown", () => {
  it("renders paragraphs, titles, lists and inline marks", () => {
    const markdown =
      "## Ça ouvre\n\nLe jeu est **ouvert**.\nViens *voir*.\n\n- un mot\n- deux mots";
    expect(markdownToHtml(markdown)).toBe(
      [
        '<h2 style="margin:24px 0 12px;font-size:20px;line-height:1.3;">Ça ouvre</h2>',
        '<p style="margin:0 0 16px;">Le jeu est <strong>ouvert</strong>.<br>Viens <em>voir</em>.</p>',
        '<ul style="margin:0 0 16px;padding-left:24px;"><li style="margin:0 0 6px;">un mot</li><li style="margin:0 0 6px;">deux mots</li></ul>',
      ].join("\n"),
    );
    expect(markdownToText(markdown)).toBe(
      "Ça ouvre\n\nLe jeu est ouvert.\nViens voir.\n\n- un mot\n- deux mots",
    );
  });

  it("links https only, and writes the address out in the text version", () => {
    const markdown =
      "[Le jeu](https://leximon.fr/jouer) et [ça](javascript:alert(1)) et [ftp](http://x.fr)";
    const html = markdownToHtml(markdown);
    expect(html).toContain('<a href="https://leximon.fr/jouer"');
    expect(html).not.toContain('href="javascript');
    expect(html).not.toContain('href="http://');
    expect(markdownToText("[Le jeu](https://leximon.fr/jouer)")).toBe(
      "Le jeu (https://leximon.fr/jouer)",
    );
  });

  it("escapes raw HTML instead of passing it through", () => {
    const html = markdownToHtml('<img src="x" onerror="alert(1)"> & <script>');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img src=&quot;x&quot;");
  });

  it("takes the first paragraph as the inbox line, cut at a word", () => {
    expect(firstParagraphText("## Titre\n\nPremière **phrase**.\n\nSeconde.")).toBe(
      "Première phrase.",
    );
    expect(firstParagraphText("a".repeat(200), 20)).toHaveLength(20);
  });
});

describe("campaign e-mail", () => {
  const content = {
    subject: "Leximon ouvre",
    bodyMarkdown: "Le jeu est ouvert.",
    buttonLabel: "Ouvrir un pli",
    buttonUrl: "https://leximon.fr/jouer",
  };
  const links = {
    unsubscribePage: "https://leximon.fr/desinscription/abc.def",
    oneClick: "https://api.leximon.fr/email/unsubscribe/abc.def",
  };

  it("carries the one-click unsubscribe headers of RFC 8058", () => {
    const email = prepareCampaignEmail(content)(links);
    expect(email.headers).toEqual({
      "List-Unsubscribe": "<https://api.leximon.fr/email/unsubscribe/abc.def>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("puts the unsubscribe link in both versions, and the button", () => {
    const email = prepareCampaignEmail(content)(links);
    expect(email.subject).toBe("Leximon ouvre");
    expect(email.html).toContain('href="https://leximon.fr/desinscription/abc.def"');
    expect(email.html).toContain("Ne plus recevoir ces e-mails");
    expect(email.html).toContain(">Ouvrir un pli</a>");
    expect(email.text).toContain("Ouvrir un pli : https://leximon.fr/jouer");
    expect(email.text).toContain(
      "Ne plus recevoir ces e-mails : https://leximon.fr/desinscription/abc.def",
    );
  });

  it("has no image and no button when none is given", () => {
    const email = prepareCampaignEmail({ ...content, buttonLabel: null, buttonUrl: null })(links);
    expect(email.html).not.toContain("<img");
    expect(email.html).not.toContain("border-radius:999px");
  });

  it("changes only the links from one recipient to the next", () => {
    const render = prepareCampaignEmail(content);
    const other = {
      unsubscribePage: "https://leximon.fr/desinscription/x.y",
      oneClick: "https://api/x.y",
    };
    const a = render(links);
    const b = render(other);
    expect(a.html.replaceAll(links.unsubscribePage, "")).toBe(
      b.html.replaceAll(other.unsubscribePage, ""),
    );
  });
});
