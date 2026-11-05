import { describe, expect, it } from "vitest";
import { renderNewsEmail, renderReminderEmail } from "./notifications";

const links = {
  unsubscribePage: "https://leximon.fr/desinscription/abc.def",
  oneClick: "https://api.leximon.fr/email/unsubscribe/abc.def",
};
const button = { label: "Voir l'offre", url: "https://leximon.fr/echanges" };

describe("renderNewsEmail", () => {
  it("names a single letter in the subject", () => {
    const email = renderNewsEmail(
      { lines: [{ title: "Margot t'envoie une offre", quote: null }], more: 0, button },
      links,
    );
    expect(email.subject).toBe("Margot t'envoie une offre");
    expect(email.text).toContain("Voir l'offre : https://leximon.fr/echanges");
    expect(email.headers).toEqual({
      "List-Unsubscribe": "<https://api.leximon.fr/email/unsubscribe/abc.def>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(email.text).toContain(
      "Ne plus recevoir ces e-mails : https://leximon.fr/desinscription/abc.def",
    );
  });

  it("counts the letters it does not name", () => {
    const email = renderNewsEmail(
      {
        lines: [
          { title: "Margot te demande en ami", quote: null },
          { title: "Paul parle de toi", quote: "On attend @Lise" },
        ],
        more: 3,
        button,
      },
      links,
    );
    expect(email.subject).toBe("5 lettres t'attendent");
    expect(email.text).toContain("Paul parle de toi : « On attend @Lise »");
    expect(email.text).toContain("Et 3 autres lettres t'attendent.");
  });

  it("escapes what players wrote", () => {
    const email = renderNewsEmail(
      {
        lines: [{ title: "<b>Margot</b> parle de toi", quote: "<script>x</script>" }],
        more: 0,
        button,
      },
      links,
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;b&gt;Margot&lt;/b&gt;");
  });
});

describe("renderReminderEmail", () => {
  it("says the sachets wait, with the word slipping away and the letters", () => {
    const email = renderReminderEmail(
      {
        stock: 6,
        slipping: { word: "lucubrateur", others: 2 },
        letters: 1,
        welcome: null,
        last: false,
      },
      links,
    );
    expect(email.subject).toBe("Tes 6 sachets t'attendent");
    expect(email.text).toContain("Lucubrateur et 2 autres mots attendent d'être révisés.");
    expect(email.text).toContain("Une lettre t'attend au courrier.");
    expect(email.text).not.toContain("Dernier rappel");
    expect(email.text).toContain("Ne plus recevoir ces rappels");
  });

  it("adds the day of the welcome week that waits", () => {
    const line = "Le jour 2 de ta semaine de bienvenue t'attend aussi, avec un sachet garni.";
    const email = renderReminderEmail(
      { stock: 6, slipping: null, letters: 0, welcome: line, last: false },
      links,
    );
    expect(email.text).toContain(line);
  });

  it("says when it is the last one", () => {
    const email = renderReminderEmail(
      { stock: 6, slipping: null, letters: 0, welcome: null, last: true },
      links,
    );
    expect(email.text).toContain("Dernier rappel, on ne t'écrira plus pour tes sachets.");
    expect(email.text).not.toContain("courrier");
  });
});
