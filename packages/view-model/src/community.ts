import type { ClanSort, PlayerSort, ProfileResponse } from "@leximon/contract";

/** The community tab: the player's clan, their friends, the public profiles and the clans. */

export const COMMUNITY_TITLE = "Communauté";

export type CommunitySection = "clan" | "amis" | "joueurs" | "clans";

export const COMMUNITY_PATH = "/communaute";
export const CLANS_PATH = `${COMMUNITY_PATH}?onglet=clans`;

export const COMMUNITY_SECTIONS: readonly {
  readonly id: CommunitySection;
  readonly label: string;
  readonly href: string;
}[] = [
  { id: "clan", label: "Mon clan", href: "/clan" },
  { id: "amis", label: "Amis", href: "/amis" },
  { id: "joueurs", label: "Joueurs", href: COMMUNITY_PATH },
  { id: "clans", label: "Clans", href: CLANS_PATH },
];

/** The section of an address. A clan seen from outside belongs to the list of clans. */
export function communitySectionOf(
  pathname: string,
  tab: string | null | undefined,
): CommunitySection {
  if (pathname === "/clan") return "clan";
  if (pathname.startsWith("/clan/")) return "clans";
  if (pathname === "/amis") return "amis";
  return tab === "clans" ? "clans" : "joueurs";
}

/** The section a link names; without one, the player's clan. */
export function communitySectionFrom(value: string | null | undefined): CommunitySection {
  return COMMUNITY_SECTIONS.find((section) => section.id === value)?.id ?? "clan";
}

export const PLAYER_SORTS: readonly { readonly id: PlayerSort; readonly label: string }[] = [
  { id: "active", label: "Actifs" },
  { id: "new", label: "Nouveaux" },
  { id: "near", label: "Proches de mon niveau" },
];

export const CLANLESS_LABEL = "Sans clan";

export const CLAN_SORTS: readonly { readonly id: ClanSort; readonly label: string }[] = [
  { id: "big", label: "Les plus grands" },
  { id: "new", label: "Les plus récents" },
];

export const PLAYERS_TITLE = "Joueurs";
export const CLANS_TITLE = "Clans";
export const PLAYER_SEARCH_LABEL = "Début du pseudo";

export const NO_PLAYER_FOUND = "Aucun joueur à ce nom, ou son profil n'est pas public.";
export const NO_PLAYER_FOR_FILTER = "Aucun joueur ne correspond à ce choix pour l'instant.";

/** The list before anyone is in it. */
export function noPlayerYet(publicFromLevel: number): string {
  return `Personne ici pour l'instant. Les joueurs y apparaissent au niveau ${publicFromLevel}.`;
}

/** Above the list: why the player is not in it, or `null` when other players see them there. */
export function playerListNote(
  profile: Pick<
    ProfileResponse,
    "member" | "pseudo" | "level" | "publicFromLevel" | "profilePublic"
  >,
): string | null {
  if (!profile.member) return "Crée un compte pour apparaître dans cette liste.";
  if (profile.level < profile.publicFromLevel) {
    return `Tu apparaîtras dans cette liste au niveau ${profile.publicFromLevel}.`;
  }
  if (profile.pseudo === null) return "Choisis un pseudo pour apparaître dans cette liste.";
  if (!profile.profilePublic) {
    return "Ton profil est caché, donc tu n'es pas dans cette liste. Tu peux le rendre public dans les réglages.";
  }
  return null;
}

/** Under the « Profil public » switch. */
export function publicProfileDetail(
  profile: Pick<ProfileResponse, "level" | "publicFromLevel">,
): string {
  return profile.level < profile.publicFromLevel
    ? `Visible dans la liste des joueurs et par un lien dès le niveau ${profile.publicFromLevel}`
    : "Visible dans la liste des joueurs et par un lien";
}

export const ALREADY_IN_CLAN = "Tu es déjà dans un clan. Quitte-le pour rejoindre celui-ci.";
export const CLAN_GONE = "Ce clan n'existe plus.";
export const REPORT_CLAN_LABEL = "Signaler le nom de ce clan";
