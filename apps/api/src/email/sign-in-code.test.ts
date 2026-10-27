import { describe, expect, it } from "vitest";
import { escapeHtml } from "./layout";
import { renderSignInCodeEmail } from "./sign-in-code";

describe("renderSignInCodeEmail", () => {
  const email = renderSignInCodeEmail({ code: "482913", validMinutes: 10 });

  it("puts the code in a subject of five words at most", () => {
    expect(email.subject).toBe("482913, ton code Leximon");
    expect(email.subject.split(/\s+/).length).toBeLessThanOrEqual(5);
  });

  it("writes the approved text, code first", () => {
    expect(email.text).toBe(
      "482913\n\nVoici ton code de connexion Leximon, valable 10 minutes.\n\n" +
        "Si tu n'as pas demandé ce code, ignore simplement cet e-mail.\n\n-- \nLeximon · leximon.fr\n",
    );
  });

  it("shows the code and the same sentences in the HTML part", () => {
    expect(email.html).toContain(">482913</span>");
    expect(email.html).toContain("valable 10 minutes.");
    expect(email.html).toContain(
      "Si tu n&#39;as pas demandé ce code, ignore simplement cet e-mail.",
    );
    expect(email.html).toContain('<html lang="fr">');
  });

  it("has no unsubscribe link, no image and no tracked link", () => {
    expect(email.html.toLowerCase()).not.toContain("désinscri");
    expect(email.html).not.toMatch(/<img/i);
    const links = [...email.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(links).toEqual(["https://leximon.fr"]);
  });

  it("escapes what it is given", () => {
    const hostile = renderSignInCodeEmail({ code: "<b>1</b>", validMinutes: 10 });
    expect(hostile.html).not.toContain("<b>1</b>");
    expect(hostile.html).toContain("&lt;b&gt;1&lt;/b&gt;");
  });
});

describe("escapeHtml", () => {
  it("escapes markup and both quotes", () => {
    expect(escapeHtml(`<a href="x">l'é & co</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;l&#39;é &amp; co&lt;/a&gt;",
    );
  });
});
