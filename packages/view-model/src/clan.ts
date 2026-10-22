import type {
  ClaimableGoal,
  ClanEntryMode,
  ClanEvent,
  ClanGoal,
  ClanMember,
  ClanRefusal,
  ClanRole,
  GoalTier,
} from "@leximon/contract";
import { CLAN_SCHEDULE, clanRulesAt, type EpochMs } from "@leximon/core";
import { formatCount, formatWait, plural } from "./format";
import { playerName } from "./trades";

/**
 * Pure rules and words of the clan screens: the server decides, these explain.
 * Shared by the web and the mobile app.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// --- Header -------------------------------------------------------------------------------

const ENTRY_LABELS: Readonly<Record<ClanEntryMode, string>> = {
  open: "entrée libre",
  request: "entrée sur demande",
  invite: "sur invitation",
};

export function entryModeLabel(mode: ClanEntryMode): string {
  return ENTRY_LABELS[mode];
}

/** « 34 membres · entrée sur demande · « On collectionne… » ». */
export function clanSubline(clan: {
  readonly memberCount: number;
  readonly entryMode: ClanEntryMode;
  readonly motto: string;
}): string {
  const parts = [plural(clan.memberCount, "membre", "membres"), entryModeLabel(clan.entryMode)];
  if (clan.motto !== "") parts.push(`« ${clan.motto} »`);
  return parts.join(" · ");
}

/** The colour names of the emblem lists. */
const COLOR_NAMES: Readonly<Record<string, string>> = {
  sang: "sang",
  or: "or",
  indigo: "indigo",
  "vert-de-gris": "vert-de-gris",
  ocre: "ocre",
  prune: "prune",
  craie: "craie",
  encre: "encre",
  vermillon: "vermillon",
  turquoise: "turquoise",
  argent: "argent",
  safran: "safran",
};

export function emblemColorName(key: string): string {
  return COLOR_NAMES[key] ?? key;
}

/** What the next gold goal adds: « la couleur vermillon », « la gravure du brisoir ». */
export function unlockLabel(
  item: { readonly kind: "engraving" | "color"; readonly id: string },
  wordOf: (cardId: string) => string,
): string {
  return item.kind === "color"
    ? `la couleur ${emblemColorName(item.id)}`
    : `la gravure ${wordOf(item.id)}`;
}

/** The invitation link a member shares: the code opens any clan, whatever its mode. */
export function inviteText(clanName: string, code: string, origin: string): string {
  return `Rejoins ${clanName} sur Leximon : ${origin}/clan?code=${code}`;
}

// --- Members ------------------------------------------------------------------------------

const ROLE_LABELS: Readonly<Record<ClanRole, string | null>> = {
  chief: "Chef",
  deputy: "Adjoint",
  member: null,
};

export function roleLabel(role: ClanRole): string | null {
  return ROLE_LABELS[role];
}

/** « en ligne », « vu il y a 3 h », « vu hier », « vu il y a 12 j ». */
export function seenLabel(member: Pick<ClanMember, "online" | "lastSeenAt">, now: EpochMs): string {
  if (member.online) return "en ligne";
  if (member.lastSeenAt === null) return "pas encore passé";
  const ago = Math.max(0, now - Date.parse(member.lastSeenAt));
  if (ago < HOUR) return `vu il y a ${Math.max(1, Math.floor(ago / MINUTE))} min`;
  if (ago < DAY) return `vu il y a ${Math.floor(ago / HOUR)} h`;
  if (ago < 2 * DAY) return "vu hier";
  return `vu il y a ${Math.floor(ago / DAY)} j`;
}

export function memberLine(member: ClanMember, now: EpochMs): string {
  return `niv. ${member.player.level} · ${seenLabel(member, now)}`;
}

export function weekWordsLabel(words: number): string {
  return plural(words, "mot", "mots");
}

/** « Voir les 27 autres ». */
export function moreMembersLabel(total: number, shown: number): string | null {
  const rest = total - shown;
  return rest > 0 ? `Voir ${rest > 1 ? `les ${formatCount(rest)} autres` : "l'autre"}` : null;
}

export function onlineCountLabel(members: readonly Pick<ClanMember, "online">[]): string {
  return `${formatCount(members.filter((member) => member.online).length)} en ligne`;
}

/** Silences a chief or deputy may give, with their label. */
export function muteChoices(
  now: EpochMs,
): { readonly durationMs: number; readonly label: string }[] {
  return clanRulesAt(CLAN_SCHEDULE, now).muteDurationsMs.map((durationMs) => ({
    durationMs,
    label:
      durationMs >= 2 * DAY
        ? plural(Math.round(durationMs / DAY), "jour", "jours")
        : plural(Math.round(durationMs / HOUR), "heure", "heures"),
  }));
}

export function mutedUntilLabel(mutedUntil: string, now: EpochMs): string {
  return `Muet encore ${formatWait(Date.parse(mutedUntil) - now)}`;
}

// --- Weekly goal --------------------------------------------------------------------------

const TIER_NAMES: Readonly<Record<GoalTier, string>> = {
  bronze: "bronze",
  silver: "argent",
  gold: "or",
};

export function tierName(tier: GoalTier): string {
  return TIER_NAMES[tier];
}

/** « 300 mots nouveaux, ensemble »: the gold target is the week's goal. */
export function goalTitle(goal: Pick<ClanGoal, "targets">): string {
  return `${plural(goal.targets.gold, "mot nouveau", "mots nouveaux")}, ensemble`;
}

/** « reste 3 j », « reste 5 h ». */
export function goalTimeLeft(endsAt: string, now: EpochMs): string {
  const left = Math.max(0, Date.parse(endsAt) - now);
  if (left >= 2 * DAY) return `reste ${Math.floor(left / DAY)} j`;
  return `reste ${formatWait(left)}`;
}

export interface GoalBar {
  /** Share of the gold target reached, 0 to 100. */
  readonly percent: number;
  readonly tiers: readonly {
    readonly tier: GoalTier;
    readonly label: string;
    /** Position on the bar, 0 to 100. */
    readonly left: number;
    readonly reached: boolean;
  }[];
}

export function goalBar(goal: Pick<ClanGoal, "targets" | "words">): GoalBar {
  const gold = Math.max(1, goal.targets.gold);
  return {
    percent: Math.min(100, (goal.words / gold) * 100),
    tiers: (["bronze", "silver", "gold"] as const).map((tier) => ({
      tier,
      label: `${tierName(tier)[0]?.toUpperCase()}${tierName(tier).slice(1)} : ${formatCount(goal.targets[tier])} mots`,
      left: (goal.targets[tier] / gold) * 100,
      reached: goal.words >= goal.targets[tier],
    })),
  };
}

/** « 214 / 300 · ta part : 23 ». */
export function goalCountLine(goal: Pick<ClanGoal, "targets" | "words" | "myWords">): string {
  return `${formatCount(goal.words)} / ${formatCount(goal.targets.gold)} · ta part : ${formatCount(goal.myWords)}`;
}

/** What the tiers give, with the emblem item the gold adds if any is left. */
export function goalRewardLine(unlock: string | null): string {
  return unlock === null
    ? "Argent et or : un sachet bonus chacun"
    : `Argent et or : un sachet bonus chacun. L'or ajoute ${unlock} à l'emblème.`;
}

/** Under the minimum, the member shares no booster: said once, plainly. */
export function contributionHint(
  goal: Pick<ClanGoal, "myWords" | "minContribution">,
): string | null {
  const missing = goal.minContribution - goal.myWords;
  if (missing <= 0) return null;
  return `Encore ${plural(missing, "mot nouveau", "mots nouveaux")} de ta part pour toucher les sachets.`;
}

/** « Prendre le sachet de l'or ». */
export function claimLabel(claim: Pick<ClaimableGoal, "tier">): string {
  return `Prendre le sachet de l'${tierName(claim.tier)}`;
}

export function goalClaimedToast(claim: Pick<ClaimableGoal, "tier">): string {
  return `Un sachet bonus pour l'${tierName(claim.tier)} !`;
}

/** The mail's line: boosters of a weekly goal waiting. */
export function claimableMailTitle(count: number): string {
  return count > 1 ? `${count} sachets d'objectif à prendre` : "Un sachet d'objectif à prendre";
}

// --- Library ------------------------------------------------------------------------------

export interface LibraryRow {
  readonly collectionId: string;
  readonly name: string;
  readonly owned: number;
  readonly mine: number;
  readonly total: number;
  readonly percent: number;
  readonly minePercent: number;
}

export function libraryRows(
  collections: readonly { readonly id: string; readonly name: string; readonly total: number }[],
  clanOwned: ReadonlyMap<string, number>,
  mine: ReadonlyMap<string, number>,
): LibraryRow[] {
  return collections.map((collection) => {
    const total = Math.max(1, collection.total);
    const owned = Math.min(total, clanOwned.get(collection.id) ?? 0);
    const own = Math.min(owned, mine.get(collection.id) ?? 0);
    return {
      collectionId: collection.id,
      name: collection.name,
      owned,
      mine: own,
      total: collection.total,
      percent: (owned / total) * 100,
      minePercent: (own / total) * 100,
    };
  });
}

/** « À vous tous, il vous manque 42 cartes de Caractères et travers. »: the nearest to complete. */
export function libraryHeadline(rows: readonly LibraryRow[]): string {
  const open = rows
    .map((row) => ({ row, missing: row.total - row.owned }))
    .filter((entry) => entry.missing > 0)
    .sort((a, b) => a.missing - b.missing)[0];
  if (open === undefined) return "Pas une carte ne vous manque. Chapeau.";
  return `À vous tous, il vous manque ${plural(open.missing, "carte", "cartes")} de ${open.row.name}.`;
}

// --- Discussion and journal ---------------------------------------------------------

/** One line of the journal. `wordOf` names a card from the catalogue. */
export function eventText(event: ClanEvent, wordOf: (cardId: string) => string): string {
  switch (event.type) {
    case "joined":
      return `${playerName(event.player)} entre dans le clan`;
    case "left":
      return `${playerName(event.player)} s'en va`;
    case "excluded":
      return `${playerName(event.player)} est exclu du clan`;
    case "role":
      if (event.role === "chief") return `${playerName(event.player)} prend la tête du clan`;
      if (event.role === "deputy") return `${playerName(event.player)} devient adjoint`;
      return `${playerName(event.player)} n'est plus adjoint`;
    case "legendary":
      return `${playerName(event.player)} trouve une Légendaire : ${wordOf(event.cardId)} !`;
    case "tier":
      return `Palier ${event.tier === "gold" ? "d'or" : event.tier === "silver" ? "d'argent" : "de bronze"} atteint !`;
    case "renamed":
      return `Le clan s'appelle maintenant ${event.name}`;
  }
}

/** « 14:32 » today, « hier », « 12 oct. » before. `timeZone` is only there for tests. */
export function messageTime(createdAt: string, now: EpochMs, timeZone?: string): string {
  const at = new Date(createdAt);
  const day = (time: Date | number) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone, dateStyle: "short" }).format(time);
  if (day(at) === day(now)) {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(at);
  }
  if (day(at) === day(now - DAY)) return "hier";
  return new Intl.DateTimeFormat("fr-FR", { timeZone, day: "numeric", month: "short" }).format(at);
}

export const REMOVED_MESSAGE: Readonly<Record<"deleted" | "hidden", string>> = {
  deleted: "Message effacé",
  hidden: "Message masqué par la modération",
};

export const EMPTY_DISCUSSION = "Silence de cathédrale. Lance la conversation.";
export const MESSAGE_PLACEHOLDER = "Écris au clan";

/** An "@" not inside a word, then words joined by single separators, the last one maybe begun. */
const MENTION_BEFORE_CARET =
  /(?:^|[^\p{L}\p{Nd}])@((?:[\p{L}\p{Nd}]+(?:[ '._-][\p{L}\p{Nd}]+){0,5}[ '._-]?)?)$/u;

/**
 * The name being typed after an "@", up to the caret: what to look up among the members.
 * Pseudos may hold spaces, so « @Jean P » still asks. `null` when the caret is not in a mention.
 */
export function mentionQuery(
  text: string,
  caret: number,
): { readonly start: number; readonly query: string } | null {
  const match = MENTION_BEFORE_CARET.exec(text.slice(0, caret));
  if (match?.[1] === undefined || match[1].length > 30) return null;
  return { start: caret - match[1].length - 1, query: match[1] };
}

/** Puts the chosen pseudo in place of what was typed after the "@", followed by a space. */
export function insertMention(
  text: string,
  mention: { readonly start: number },
  caret: number,
  pseudo: string,
): { readonly text: string; readonly caret: number } {
  const inserted = `@${pseudo} `;
  const after = text.slice(caret).replace(/^ /, "");
  return {
    text: text.slice(0, mention.start) + inserted + after,
    caret: mention.start + inserted.length,
  };
}

export type MessageSegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "mention"; readonly text: string; readonly me: boolean };

/** A message cut around its mentions, for the highlight. Ranges out of the text are ignored. */
export function messageSegments(
  body: string,
  mentions: readonly { readonly start: number; readonly end: number; readonly me: boolean }[],
): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let index = 0;
  for (const mention of [...mentions].sort((a, b) => a.start - b.start)) {
    if (mention.start < index || mention.end > body.length || mention.end <= mention.start) {
      continue;
    }
    if (mention.start > index)
      segments.push({ kind: "text", text: body.slice(index, mention.start) });
    segments.push({
      kind: "mention",
      text: body.slice(mention.start, mention.end),
      me: mention.me,
    });
    index = mention.end;
  }
  if (index < body.length) segments.push({ kind: "text", text: body.slice(index) });
  return segments;
}

// --- Without a clan -----------------------------------------------------------

/** The button of a clan in the list. */
export function joinLabel(mode: ClanEntryMode, requested: boolean): string {
  if (requested) return "Demande envoyée";
  if (mode === "open") return "Rejoindre";
  if (mode === "request") return "Demander à entrer";
  return "Sur invitation";
}

export const NO_CLAN_FOUND = "Aucun clan à ce nom. Fonde le tien.";
export const NO_CLAN_YET = "Pas encore de clan ici. Sois le premier.";

/** the consequence in the button. */
export function leaveLabel(memberCount: number): string {
  return memberCount <= 1 ? "Quitter et dissoudre le clan" : "Quitter le clan";
}

// --- Refusals ------------------------------------------------------------------------------------

const REFUSALS: Readonly<Record<ClanRefusal, string>> = {
  account_required: "Il faut un compte pour entrer dans un clan.",
  pseudo_required: "Choisis d'abord un pseudo.",
  level_too_low: "Pas encore le niveau.",
  already_in_clan: "Tu es déjà dans un clan.",
  not_member: "Tu n'es plus dans ce clan.",
  not_allowed: "Ce n'est pas dans ton rôle.",
  clan_not_found: "Ce clan n'existe plus.",
  player_not_found: "Introuvable.",
  invite_only: "Ce clan n'entre que sur invitation.",
  name_taken: "Ce nom est déjà pris.",
  name_too_short: "Trois caractères au moins.",
  name_too_long: "Trente caractères au plus.",
  name_invalid_characters:
    "Lettres, chiffres, et une espace, un tiret ou une apostrophe entre eux.",
  name_refused: "Ce nom ne passe pas. Trouves-en un autre.",
  motto_too_long: "Quatre-vingts caractères au plus.",
  motto_refused: "Cette devise ne passe pas. Reformule.",
  emblem_not_allowed: "Cet emblème n'est pas encore à vous.",
  message_empty: "Rien à envoyer.",
  message_too_long: "Cinq cents caractères au plus.",
  message_refused: "Pas envoyé : un mot interdit. Reformule.",
  too_soon: "Doucement. Un message toutes les 2 secondes.",
  muted: "Tu es muet dans ce clan pour l'instant.",
  sanctioned: "Une sanction t'empêche d'écrire.",
  mute_duration: "Cette durée n'existe pas.",
  goal_not_reached: "Pas de sachet pour toi à ce palier.",
  already_claimed: "Déjà pris.",
  claim_expired: "Trop tard, la semaine est passée.",
  reserve_full: "Ta réserve est pleine. Ouvre un sachet d'abord.",
  self: "Pas sur toi-même.",
};

export function clanRefusalMessage(reason: ClanRefusal): string {
  return REFUSALS[reason];
}
