import { describe, expect, it } from "vitest";
// Vite reads the file as text: the pipeline's list stays the only copy of the slurs.
import exclusions from "../../../../content/pipeline/src/leximon_content/exclusions.py?raw";
import { PSEUDO_SCHEDULE } from "../rules";
import { checkPseudo, nextPseudoChange, pseudoKey, pseudoRulesAt } from "./pseudo";

const rules = pseudoRulesAt(PSEUDO_SCHEDULE, Date.UTC(2026, 9, 21));
const check = (raw: string) => checkPseudo(rules, raw);
const reason = (raw: string) => {
  const result = check(raw);
  return result.ok ? "ok" : result.reason;
};

describe("checkPseudo", () => {
  it("keeps the pseudo as written, trimmed, with single spaces", () => {
    expect(check("  Raph   le  Grand ")).toEqual({
      ok: true,
      pseudo: "Raph le Grand",
      key: "raphlegrand",
    });
  });

  it("accepts accents, digits and separators between letters", () => {
    for (const pseudo of ["Éloïse", "Jean-Kévin", "d'Artagnan", "plume_42", "M.Jourdain"]) {
      expect(reason(pseudo)).toBe("ok");
    }
  });

  it("refuses pseudos too short or too long", () => {
    expect(reason("Al")).toBe("too_short");
    expect(reason("a.b")).toBe("too_short");
    expect(reason("a".repeat(21))).toBe("too_long");
    expect(reason("a".repeat(20))).toBe("ok");
  });

  it("refuses other scripts, symbols and separators at the ends", () => {
    for (const pseudo of ["Rаph", "Raph!", "-Raph", "Raph_", "Ra--ph", "🦊Raph", "<b>Raph"]) {
      expect(reason(pseudo)).toBe("invalid_characters");
    }
  });

  it("gives one key to pseudos that read the same", () => {
    expect(pseudoKey("Râph")).toBe(pseudoKey("raph"));
    expect(pseudoKey("R.a-p_h")).toBe("raph");
    expect(pseudoKey("Jean Kévin")).toBe(pseudoKey("jean-kevin"));
  });
});

describe("pseudo filter", () => {
  it("refuses insults, hate and the staff's names, also in leetspeak", () => {
    for (const pseudo of [
      "Connard",
      "gros_con",
      "PD_42",
      "s4lope",
      "Hitler88",
      "Admin",
      "Leximon_officiel",
      "le.modo",
      "Putes",
    ]) {
      expect(reason(pseudo)).toBe("refused");
    }
  });

  it("lets through ordinary words that hold a refused one", () => {
    for (const pseudo of ["Technique", "Badminton", "Piédestal", "Conan", "Violette", "Dispute"]) {
      expect(reason(pseudo)).toBe("ok");
    }
  });

  it("refuses every slur the content pipeline never makes into a card", () => {
    const block = exclusions.slice(
      exclusions.indexOf("SLURS"),
      exclusions.indexOf("def is_excluded"),
    );
    const slurs = [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
    expect(slurs.length).toBeGreaterThan(30);
    for (const slur of slurs) expect(reason(slur), slur).toBe("refused");
  });
});

describe("nextPseudoChange", () => {
  it("leaves the first choice free, then waits a month", () => {
    expect(nextPseudoChange(rules, null)).toBeNull();
    const changedAt = Date.UTC(2026, 9, 1);
    expect(nextPseudoChange(rules, changedAt)).toBe(Date.UTC(2026, 9, 31));
  });
});
