/** What changed in the game, told to the players: the pop-up once, and the « Nouveautés » page. */
export interface ChangelogEntry {
  /** The day it went live, `YYYY-MM-DD`: entries are compared by it. */
  readonly date: string;
  readonly title: string;
  readonly items: readonly string[];
}

/** Newest first. An entry is added the day a change players can see goes live. */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    date: "2026-10-31",
    title: "L'énigme du jour",
    items: [
      "La page Défis propose chaque jour un nouveau mot à deviner, le même pour tout le monde, en 7 essais.",
      "Chaque mauvaise réponse dévoile un indice, puis une lettre. Tu peux aussi demander un indice, au prix d'un essai.",
      "Trouver le mot rapporte 50 XP, et la carte si tu ne l'as pas.",
      "Tu peux partager ton résultat sans dévoiler le mot.",
    ],
  },
  {
    date: "2026-10-30",
    title: "Révise ce que tu veux",
    items: [
      "La page Défis a une nouvelle section, S'entraîner : lance une série de 10 questions sur une collection, tes mots ratés ou tes mots récents.",
      "Dès le niveau 3, tu peux aussi réviser un thème, ou les mots d'un filtre de l'album avec le bouton Réviser ces mots.",
      "Les mots à revoir passent en premier et comptent pour ta mémoire. Les autres servent à t'entraîner : 5 XP par bonne réponse, 100 XP par jour au plus.",
    ],
  },
  {
    date: "2026-10-29",
    title: "Des défis plus vivants",
    items: [
      "Les défis ont du son : deux notes quand tu as juste, un son sourd quand tu te trompes, un carillon quand un mot monte de palier. Le réglage du son les coupe.",
      "La page Défis dit ce qui t'attend : combien de mots sont à revoir, combien peuvent monter de palier, et lesquels.",
      "Après ton dernier sachet, un bouton te ramène à l'accueil, et l'attente du prochain sachet s'affiche au-dessus.",
      "Une question ne donne plus sa réponse : les mots de la même famille sont masqués, préfixes compris, et dix définitions ont été réécrites.",
    ],
  },
];

/**
 * Below this level, a player who has never seen the pop-up is new: the news of the past means
 * nothing to them, and the first sachets come first.
 */
const NEWS_FROM_LEVEL = 5;

/** At most this many entries in the pop-up; the page has the rest. */
const NEWS_AT_ONCE = 3;

export interface NewsToShow {
  /** Entries to show now, newest first; empty for nothing. */
  readonly entries: readonly ChangelogEntry[];
  /** What to remember as seen once the pop-up is closed, or right away when nothing shows. */
  readonly seen: string | null;
}

/** The entries a player has not seen yet, given the last one they saw on this device. */
export function newsToShow(
  lastSeen: string | null,
  level: number,
  changelog: readonly ChangelogEntry[] = CHANGELOG,
): NewsToShow {
  const latest = changelog[0]?.date ?? null;
  if (lastSeen === null && level < NEWS_FROM_LEVEL) return { entries: [], seen: latest };
  const entries = changelog
    .filter((entry) => lastSeen === null || entry.date > lastSeen)
    .slice(0, NEWS_AT_ONCE);
  return { entries, seen: latest };
}

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « 29 octobre 2026 », « 1er novembre 2026 » */
export function changelogDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return date;
  return `${day === 1 ? "1er" : day} ${MONTHS[month - 1] ?? ""} ${year}`;
}
