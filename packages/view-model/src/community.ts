import type { ProfileResponse } from "@leximon/contract";

/** The community: the public profiles and the clans, open to every player. */

export const COMMUNITY_TITLE = "Communauté";

export type CommunityTab = "joueurs" | "clans";

export const COMMUNITY_TABS: readonly { readonly id: CommunityTab; readonly label: string }[] = [
  { id: "joueurs", label: "Joueurs" },
  { id: "clans", label: "Clans" },
];

export const COMMUNITY_PATH = "/communaute";
export const CLANS_PATH = `${COMMUNITY_PATH}?onglet=clans`;

/** The tab named by the address; an unknown one falls back on the players. */
export function communityTabOf(value: string | null | undefined): CommunityTab {
  return value === "clans" ? "clans" : "joueurs";
}

export const PLAYER_SEARCH_LABEL = "Début du pseudo";
export const ALL_PLAYERS_LABEL = "Voir tous les joueurs";
export const ALL_CLANS_LABEL = "Voir les clans";

export const NO_PLAYER_FOUND = "Aucun joueur à ce nom, ou son profil n'est pas public.";

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
