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
    date: "2026-11-09",
    title: "La plus grande mise à jour de Leximon",
    items: [
      "Le jeu change d'allure. Tout se passe désormais dans une bibliothèque, les cartes ont du relief et les sachets se déchirent.",
      "Une quatrième collection arrive, Bêtes et plantes, avec 504 mots d'oiseaux, de poissons, de plantes et de chasse. Ses sachets s'ouvrent dès le niveau 3.",
      "Au niveau 8, les joutes s'ouvrent. Tu composes un deck de 10 cartes et tu affrontes un autre joueur sur vos mots, chacun à son heure. Chaque semaine, un tournoi te fait monter de ligue en ligue.",
      "Tes doubles se recyclent en écus, de 1 écu pour une carte Courante à 200 pour une Légendaire. Avec tes écus, tu choisis la collection et la rareté d'un mot qui te manque.",
      "Trois missions t'attendent chaque jour. Chacune rapporte 30 XP et 10 écus, et les trois faites te donnent un sachet bonus.",
      "Le carnet de pointage coche chaque jour où tu joues, sans obligation de jours d'affilée. Ses cases donnent des écus et des sachets.",
      "Leximon s'ouvre à tous, et tes amis peuvent entrer sans invitation.",
    ],
  },
  {
    date: "2026-11-01",
    title: "Tous les joueurs, tous les clans",
    items: [
      "Le nouvel onglet Communauté réunit ton clan, tes amis, les joueurs au profil public et tous les clans, même si tu as déjà un clan.",
      "Tu peux trier les joueurs, voir leurs cartes épinglées et ouvrir la page de n'importe quel clan pour voir ses membres.",
      "Si ton profil est public, tu apparais dans cette liste. Pour ne plus y figurer, cache ton profil dans les réglages.",
    ],
  },
  {
    date: "2026-10-31",
    title: "L'énigme du jour",
    items: [
      "La page Défis propose chaque jour un nouveau mot à deviner, le même pour tout le monde, en 7 essais.",
      "Chaque mauvaise réponse dévoile un indice, puis des lettres. Tu peux aussi demander un indice, au prix d'un essai.",
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
