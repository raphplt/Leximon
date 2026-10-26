import type {
  BlockRefusal,
  ProfileRefusal,
  ProfileResponse,
  ProfileStats,
} from "@leximon/contract";
import {
  type EpochMs,
  LEVEL_REWARD_SCHEDULE,
  type LevelRewardRules,
  levelRewardRulesAt,
} from "@leximon/core";
import { formatCount, plural } from "./format";
import { formatPlayerCode } from "./trades";

/**
 * The profile, the atelier and the profile settings.
 * The server decides what may be worn or pinned; these only name and explain.
 */

/** Names of the engraved avatars, by card id. */
const AVATAR_NAMES: Readonly<Record<string, string>> = {
  metaphraste: "Le Métaphraste",
  bachelette: "La Bachelette",
  grimelin: "Le Grimelin",
  cassandre: "Cassandre",
  preopinant: "Le Préopinant",
  ricanerie: "La Ricanerie",
  metoposcope: "Le Métoposcope",
  fanfreluche: "La Fanfreluche",
  cuistre: "Le Cuistre",
  fluteau: "Le Flûteau",
  chatieur: "Le Châtieur",
  soupette: "La Soupette",
  encaveur: "L'Encaveur",
  bequillard: "Le Béquillard",
  zani: "Le Zani",
  pochon: "Le Pochon",
};

const FRAME_NAMES: Readonly<Record<string, string>> = {
  simple: "Filet simple",
  gilded: "Filet doré",
  ink: "Encre qui coule",
  pearls: "Filet perlé",
  verdigris: "Vert-de-gris",
  twist: "Torsade",
  lace: "Dentelle",
  indigo: "Indigo",
  wax: "Sceau de cire",
  rays: "Gloire",
  "bright-gold": "Or vif",
  iridescent: "Irisé",
  "royal-sun": "Soleil royal",
};

function fallbackName(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function avatarName(id: string): string {
  return AVATAR_NAMES[id] ?? fallbackName(id);
}

export function frameName(id: string): string {
  return FRAME_NAMES[id] ?? fallbackName(id);
}

/** URL path of a public profile. */
export function profilePath(pseudo: string): string {
  return `/joueur/${encodeURIComponent(pseudo)}`;
}

/** « Fine plume · niveau 16 », under the pseudo. */
export function profileHeadline(title: string | null, level: number): string {
  return title === null ? `Niveau ${level}` : `${title} · niveau ${level}`;
}

/** « membre depuis novembre 2026 ». `timeZone` is only there for tests. */
export function memberSinceLabel(memberSince: string, timeZone?: string): string {
  const month = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(Date.parse(memberSince));
  return `membre depuis ${month}`;
}

/** « Code joueur K7QP 2MXA · membre depuis novembre 2026 ». */
export function profileSubline(code: string, memberSince: string, timeZone?: string): string {
  return `Code joueur ${formatPlayerCode(code)} · ${memberSinceLabel(memberSince, timeZone)}`;
}

/**
 * What the player's own profile says about who sees it, or `null` once others do. A guest sees
 * what an account would have.
 */
export function visibilityNote(
  profile: Pick<
    ProfileResponse,
    "member" | "pseudo" | "level" | "publicFromLevel" | "profilePublic"
  >,
): string | null {
  if (!profile.member) return "Pas de compte, pas de profil. Crée-le, ta partie suit.";
  if (profile.level < profile.publicFromLevel) {
    return `Ton profil devient public au niveau ${profile.publicFromLevel}.`;
  }
  if (profile.pseudo === null) return "Choisis un pseudo. Il fera l'adresse de ton profil.";
  if (!profile.profilePublic) return "Profil caché.";
  return null;
}

/** The profile can be shared: an account, a pseudo, the level, and not hidden. */
export function canShareProfile(
  profile: Pick<
    ProfileResponse,
    "member" | "pseudo" | "level" | "publicFromLevel" | "profilePublic"
  >,
): boolean {
  return visibilityNote(profile) === null;
}

export interface StatTile {
  readonly value: string;
  readonly label: string;
}

/** The « En chiffres » panel. `totalWords` comes from the catalogue, when loaded. */
export function statTiles(stats: ProfileStats, totalWords: number | null): StatTile[] {
  return [
    {
      value: formatCount(stats.words),
      label: totalWords === null ? "mots" : `mots sur ${formatCount(totalWords)}`,
    },
    {
      value: formatCount(stats.legendaries),
      label: stats.legendaries > 1 ? "Légendaires" : "Légendaire",
    },
    {
      value: formatCount(stats.gilded),
      label: stats.gilded > 1 ? "mots à la Dorure" : "mot à la Dorure",
    },
    {
      value: formatCount(stats.tradesCompleted),
      label: stats.tradesCompleted > 1 ? "échanges conclus" : "échange conclu",
    },
    {
      value: formatCount(stats.completeCollections),
      label: stats.completeCollections > 1 ? "collections complètes" : "collection complète",
    },
    { value: `${formatCount(stats.daysPlayed)} j`, label: "de jeu" },
  ];
}

export type AtelierTab = "avatars" | "frames" | "titles";

export const ATELIER_TABS: readonly { readonly tab: AtelierTab; readonly label: string }[] = [
  { tab: "avatars", label: "Avatars" },
  { tab: "frames", label: "Cadres" },
  { tab: "titles", label: "Titres" },
];

/** `locked`: not reached yet; `in_coffret`: reached, waiting in an unopened coffret. */
export type CosmeticState = "worn" | "owned" | "in_coffret" | "locked";

export interface AtelierItem {
  /** Avatar card id, frame id, or the title itself. */
  readonly id: string;
  readonly name: string;
  readonly state: CosmeticState;
  /** Level that gives it; 1 for the starting set. */
  readonly level: number;
}

interface Cosmetic {
  readonly id: string;
  readonly level: number;
}

function byLevel(map: Readonly<Record<number, string>>): Cosmetic[] {
  return Object.entries(map).map(([level, id]) => ({ id, level: Number(level) }));
}

function cosmeticsOf(rules: LevelRewardRules, tab: AtelierTab): Cosmetic[] {
  switch (tab) {
    case "avatars":
      return [...rules.startingAvatars.map((id) => ({ id, level: 1 })), ...byLevel(rules.avatars)];
    case "frames":
      return [{ id: rules.startingFrame, level: 1 }, ...byLevel(rules.frames)];
    case "titles":
      return byLevel(rules.titles);
  }
}

/**
 * Everything a tab of the atelier shows, by level: what the rules in force give, plus anything
 * the player already owns from older rules (never taken back).
 */
export function atelierItems(
  tab: AtelierTab,
  profile: Pick<ProfileResponse, "avatar" | "frame" | "title" | "level" | "wardrobe">,
  now: EpochMs,
): AtelierItem[] {
  const owned = new Set(
    tab === "avatars"
      ? profile.wardrobe.avatars
      : tab === "frames"
        ? profile.wardrobe.frames
        : profile.wardrobe.titles,
  );
  const worn =
    tab === "avatars" ? profile.avatar : tab === "frames" ? profile.frame : profile.title;
  const known = cosmeticsOf(levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now), tab);
  const extra = [...owned]
    .filter((id) => !known.some((item) => item.id === id))
    .map((id) => ({ id, level: 1 }));
  return [...known, ...extra]
    .sort((a, b) => a.level - b.level)
    .map(({ id, level }) => ({
      id,
      level,
      name: tab === "avatars" ? avatarName(id) : tab === "frames" ? frameName(id) : id,
      state:
        id === worn
          ? "worn"
          : owned.has(id)
            ? "owned"
            : profile.level >= level
              ? "in_coffret"
              : "locked",
    }));
}

/** The label of an atelier item's button or state. */
export function cosmeticStateLabel(item: AtelierItem): string {
  switch (item.state) {
    case "worn":
      return "Porté";
    case "owned":
      return "Mettre";
    case "in_coffret":
      return "Au coffret";
    case "locked":
      return `Niveau ${item.level}`;
  }
}

/** Toast when a closed item is tapped. */
export function cosmeticLockedToast(item: AtelierItem): string {
  return item.state === "in_coffret"
    ? `Ouvre ton coffret du niveau ${item.level}, c'est dedans.`
    : `Ça se gagne au niveau ${item.level}.`;
}

export function wornToast(tab: AtelierTab): string {
  switch (tab) {
    case "avatars":
      return "Nouvel avatar porté.";
    case "frames":
      return "Nouveau cadre posé.";
    case "titles":
      return "Nouveau titre porté.";
  }
}

const PROFILE_REFUSALS: Readonly<Record<ProfileRefusal, string>> = {
  account_required: "Il faut un compte pour ça. Crée-le, ta partie suit.",
  pseudo_too_short: "Trop court. Trois caractères au moins.",
  pseudo_too_long: "Trop long. Vingt caractères au plus.",
  pseudo_invalid:
    "Lettres, chiffres, et un seul séparateur entre deux mots (espace, point, tiret).",
  pseudo_refused: "Pas ce pseudo-là. Trouve autre chose.",
  pseudo_taken: "Déjà pris. Un autre ?",
  pseudo_too_soon: "Un changement par mois, pas plus.",
  cosmetic_locked: "Pas encore à toi.",
  too_many_pins: "Plus de place sur ton profil. Retire une carte d'abord.",
  card_not_owned: "Cette carte n'est plus dans ton album.",
  duplicate_card: "Cette carte est déjà épinglée.",
};

export function profileRefusalMessage(reason: ProfileRefusal): string {
  return PROFILE_REFUSALS[reason];
}

/**
 * Under the pseudo field and in the settings: when the pseudo may change. `timeZone` is only
 * there for tests.
 */
export function pseudoHint(
  profile: Pick<ProfileResponse, "pseudo" | "pseudoChangeableFrom">,
  now: EpochMs,
  timeZone?: string,
): string {
  if (profile.pseudo === null) return "Il fait l'adresse de ton profil. Un changement par mois.";
  const from =
    profile.pseudoChangeableFrom === null ? null : Date.parse(profile.pseudoChangeableFrom);
  if (from === null || from <= now) return "Modifiable une fois par mois.";
  const day = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(from);
  return `Prochain changement possible le ${day}.`;
}

/** The pseudo row of the settings: « Raph · modifiable une fois par mois ». */
export function pseudoSettingLabel(pseudo: string | null): string {
  return pseudo === null ? "Pas encore choisi" : `${pseudo} · modifiable une fois par mois`;
}

export function blockedCountLabel(count: number): string {
  return count === 0 ? "Personne" : plural(count, "joueur", "joueurs");
}

const BLOCK_REFUSALS: Readonly<Record<BlockRefusal, string>> = {
  account_required: "Il faut un compte pour ça.",
  player_not_found: "Ce joueur n'existe pas, ou plus.",
  self: "Toi-même ? Non.",
};

export function blockRefusalMessage(reason: BlockRefusal): string {
  return BLOCK_REFUSALS[reason];
}

export const BLOCK_CONFIRM = "Plus de profil ni d'offre entre vous. Celles en cours tombent.";
export const BLOCKED_TOAST = "Bloqué.";
export const BLOCKED_NOTE = "Bloqué. Ça se défait dans Réglages, Joueurs bloqués.";
export const PROFILE_NOT_FOUND = "Personne à ce nom, ou son profil n'est pas encore public.";
export const UNBLOCKED_TOAST = "Débloqué.";
export const REPORTED_TOAST = "Signalé. On regarde ça.";
export const PROFILE_LINK_COPIED = "Lien du profil copié.";

/** The button that deletes the account: the consequence is in it. */
export function deleteAccountLabel(words: number): string {
  return words === 0
    ? "Supprimer mon compte"
    : `Supprimer mon compte et mes ${plural(words, "mot", "mots")}`;
}

export const DELETE_ACCOUNT_WARNING = "Tout part, sans retour.";
export const DELETE_ACCOUNT_CONFIRM = "Oui, tout effacer";
export const DELETE_ACCOUNT_CANCEL = "Pas encore";
export const DELETE_ACCOUNT_ADMIN = "Rends d'abord ton rôle d'admin. Écris-nous.";
