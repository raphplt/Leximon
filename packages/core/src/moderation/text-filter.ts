/**
 * The deterministic floor of moderation: words refused in what players write (pseudo, clan name and motto,
 * clan messages). Not a judge: what passes can still be reported and moderated.
 *
 * It holds the slurs of the content pipeline (`content/pipeline/…/exclusions.py`, checked by a
 * test), common insults, and, for names only, words that would pass for the game's staff.
 */

const SEPARATORS = /[ '._-]/g;
/** Anything that is neither a letter nor a digit splits a message into words. */
const MESSAGE_SEPARATORS = /[^\p{L}\p{Nd}]+/u;

/** Found anywhere in a word: no ordinary word holds them. */
const CONTAINS = [
  // Slurs of the content pipeline.
  "bamboula",
  "bicot",
  "bougnoul",
  "boucaque",
  "chinetoque",
  "crouille",
  "meteque",
  "moricaud",
  "negre",
  "negresse",
  "negrillon",
  "negro",
  "niakoue",
  "rastaquouere",
  "youpin",
  "youtre",
  "encule",
  "fiotte",
  "gouine",
  "sodomite",
  "tantouze",
  "tarlouze",
  "petasse",
  "pouffiasse",
  "salope",
  "gogol",
  "mongol",
  // Insults and hate.
  "connard",
  "connasse",
  "enfoire",
  "batard",
  "salaud",
  "merde",
  "couille",
  "putain",
  "nazi",
  "hitler",
  "fuhrer",
  "pedophil",
  "porno",
  "fuck",
  "nigg",
  "bitch",
];

/** Names that would pass for the game's staff: refused in names, not in messages. */
const STAFF_CONTAINS = ["leximon"];

/** At the start of a word: "technique" holds "nique", "pedestre" holds "pede". */
const PREFIX = ["nique", "pute", "salop", "pedo", "bite", "rital"];

/** "badminton" holds "admin": staff roots only at the start of a word. */
const STAFF_PREFIX = ["admin", "moderat"];

/** A whole word, or the whole name: too short or too common to look inside words. */
const EXACT = [
  "con",
  "cul",
  "pd",
  "fdp",
  "ntm",
  "tg",
  "raton",
  "macaroni",
  "inverti",
  "pedale",
  "pede",
  "tapette",
  "viol",
  "kkk",
  "heil",
];

const STAFF_EXACT = ["modo", "staff", "support", "officiel"];

/**
 * In free text, swearing is not an insult: "merde" or "putain" pass, and reports do the rest.
 * Whole words that also mean something harmless ("raton", "pédale", "cul-de-sac") pass too.
 */
const TEXT_ALLOWED = new Set(["merde", "couille", "putain"]);
const TEXT_EXACT = ["pd", "fdp", "ntm", "kkk", "heil"];

/** Digits used as letters: "s4lope" is still refused. */
const LEET: Readonly<Record<string, string>> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
};

/** A pseudo or a clan name: its words, and the whole name with separators removed. */
export function isRefusedName(name: string): boolean {
  const words = plain(name)
    .split(SEPARATORS)
    .filter((word) => word.length > 0);
  for (const variant of [words, words.map(unLeet)]) {
    const joined = variant.join("");
    const contains = [...CONTAINS, ...STAFF_CONTAINS];
    if (contains.some((root) => joined.includes(root))) return true;
    const prefixes = [...PREFIX, ...STAFF_PREFIX];
    if (variant.some((word) => prefixes.some((root) => word.startsWith(root)))) return true;
    const exact = [...EXACT, ...STAFF_EXACT];
    if ([...variant, joined].some((word) => exact.includes(word))) return true;
  }
  return false;
}

/**
 * Free text (a clan message, a motto): word by word, so that two harmless words side by side never
 * make a refused one.
 */
export function isRefusedText(text: string): boolean {
  const words = plain(text)
    .split(MESSAGE_SEPARATORS)
    .filter((word) => word.length > 0);
  const contains = CONTAINS.filter((root) => !TEXT_ALLOWED.has(root));
  for (const variant of [words, words.map(unLeet)]) {
    if (variant.some((word) => contains.some((root) => word.includes(root)))) return true;
    if (variant.some((word) => PREFIX.some((root) => word.startsWith(root)))) return true;
    if (variant.some((word) => TEXT_EXACT.includes(word))) return true;
  }
  return false;
}

/**
 * Free text without its invisible characters (zero-width spaces, direction marks): they hide a
 * refused word inside harmless letters, or turn a line around. The joiner inside an emoji stays.
 */
export function withoutInvisible(text: string): string {
  return text
    .replaceAll(
      /(?<!\p{Extended_Pictographic}\uFE0F?)\u200D|\u200D(?!\p{Extended_Pictographic})/gu,
      "",
    )
    .replaceAll(/(?!\u200D)\p{Cf}/gu, "");
}

/** Domains that pass for words in French ("ça", "de", "me") are left out: a missing space is no link. */
const LINK =
  /\bhttps?:\/\/|\bwww\.|\b[a-z0-9][a-z0-9-]*\.(?:com|fr|net|org|io|gg|be|ch|eu|uk|tv|ly|app|xyz|info|link|site|live|gl)\b/;
const EMAIL =
  /[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]{2,}|@(?:gmail|hotmail|outlook|yahoo|icloud|orange|free|sfr|laposte|wanadoo)\b/;
/** Nine digits or more, a space, dot or dash between them: a phone number, not a date. */
const PHONE = /(?:\d[ .-]?){8,}\d/;

/**
 * A link, an e-mail address or a phone number. Players of 15 meet adults in the clans: no way out
 * of the game to reach one another, as the charter says.
 */
export function hasContactDetails(text: string): boolean {
  const flat = plain(text);
  return LINK.test(flat) || EMAIL.test(flat) || PHONE.test(flat);
}

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replaceAll(/[\p{M}\p{Cf}]/gu, "")
    .toLowerCase();
}

function unLeet(word: string): string {
  return [...word].map((char) => LEET[char] ?? char).join("");
}
