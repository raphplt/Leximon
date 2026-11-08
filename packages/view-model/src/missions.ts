import type {
  ChangeMissionRefusal,
  ClaimMissionsResponse,
  MissionsResponse,
  MissionView,
} from "@leximon/contract";
import {
  type EpochMs,
  MISSION_KINDS,
  MISSION_SCHEDULE,
  type MissionKind,
  missionRulesAt,
} from "@leximon/core";
import { formatCount, plural, shortName } from "./format";

/** The missions of the day: their card on the Jouer screen, their claim and their change. */

export const MISSIONS_TITLE = "Missions du jour";
export const MISSION_CHANGE = "Changer";
/** The name of the small change button, which shows only an icon. */
export const MISSION_CHANGE_LABEL = "Changer cette mission";
export const MISSION_CHANGE_BUSY = "Changement…";
export const MISSIONS_CLAIM_BUSY = "Récompenses…";
export const MISSIONS_FAILED = "Les missions n'ont pas pu être chargées. Réessaie.";
export const MISSIONS_CLAIM_FAILED = "Les récompenses n'ont pas été prises. Réessaie.";
export const MISSION_CHANGE_FAILED = "La mission n'a pas été changée. Réessaie.";

function isMissionKind(kind: string): kind is MissionKind {
  return (MISSION_KINDS as readonly string[]).includes(kind);
}

/** Where a mission is done: each platform maps it to its screen. */
export type MissionPlace = "play" | "challenges" | "riddle" | "trades" | "album" | "jousts";

export interface MissionLine {
  /** « Ouvre 3 sachets ». */
  readonly text: string;
  /** « 2 / 3 ». */
  readonly figure: string;
  /** From 0 to 1. */
  readonly ratio: number;
  readonly state: "todo" | "done" | "claimed";
  readonly place: MissionPlace | null;
  /** « Ouvre 3 sachets, 2 sur 3 », for screen readers. */
  readonly label: string;
}

/** A mission as the screen shows it; `collectionName` names the collection of a review. */
export function missionLine(
  mission: MissionView,
  collectionName: (id: string) => string | null,
): MissionLine {
  const { text, place } = missionText(mission, collectionName);
  const progress = Math.min(mission.progress, mission.target);
  const state = mission.claimed ? "claimed" : progress >= mission.target ? "done" : "todo";
  const said =
    state === "claimed"
      ? "récompense prise"
      : state === "done"
        ? "faite"
        : `${formatCount(progress)} sur ${formatCount(mission.target)}`;
  return {
    text,
    figure: `${formatCount(progress)} / ${formatCount(mission.target)}`,
    ratio: mission.target === 0 ? 1 : progress / mission.target,
    state,
    place,
    label: `${text}, ${said}`,
  };
}

function missionText(
  mission: MissionView,
  collectionName: (id: string) => string | null,
): { text: string; place: MissionPlace | null } {
  const { target } = mission;
  if (!isMissionKind(mission.kind)) {
    return { text: "Mets Leximon à jour pour découvrir cette mission.", place: null };
  }
  switch (mission.kind) {
    case "open_sachets":
      return { text: `Ouvre ${plural(target, "sachet", "sachets")}`, place: "play" };
    case "good_answers":
      return {
        text: `Donne ${plural(target, "bonne réponse", "bonnes réponses")} aux défis`,
        place: "challenges",
      };
    case "write_words":
      return {
        text: `Écris juste ${plural(target, "mot", "mots")} de mémoire`,
        place: "challenges",
      };
    case "review_collection": {
      const name = mission.collectionId === undefined ? null : collectionName(mission.collectionId);
      const words = plural(target, "mot", "mots");
      return {
        text:
          name === null
            ? `Révise juste ${words} d'une collection`
            : `Révise juste ${words} de ${shortName(name)}`,
        place: "challenges",
      };
    }
    case "riddle":
      return { text: "Trouve l'énigme du jour", place: "riddle" };
    case "trade":
      return {
        text: target > 1 ? `Conclus ${formatCount(target)} échanges` : "Conclus un échange",
        place: "trades",
      };
    case "recycle":
      return { text: "Recycle des doubles en écus", place: "album" };
    case "joust":
      return {
        text: target > 1 ? `Joue ${formatCount(target)} joutes` : "Joue une joute",
        place: "jousts",
      };
  }
}

/** One line of the missions' help: who wins and what, drawn with the reward icons. */
export interface MissionsHelpLine {
  /** « Chaque mission », « Les 3 missions faites ». */
  readonly label: string;
  readonly xp: number;
  readonly ecus: number;
  readonly boosters: number;
}

export const MISSIONS_HELP_TITLE = "Ce que rapportent les missions";
export const MISSIONS_HELP_OPEN = "Comment marchent les missions";
export const MISSIONS_HELP_CHANGE = "1 changement de mission par jour";

/** Behind the « ? » of the card: each mission's gain, then the gain of all of them done. */
export function missionsHelp(missions: MissionsResponse): readonly MissionsHelpLine[] {
  const { xp, ecus, allDoneBoosters } = missions.rewards;
  const count = missions.missions.length;
  const each = { label: "Chaque mission", xp, ecus, boosters: 0 };
  if (allDoneBoosters === 0 || count === 0) return [each];
  const all = count === 1 ? "La mission faite" : `Les ${formatCount(count)} missions faites`;
  return [each, { label: all, xp: 0, ecus: 0, boosters: allDoneBoosters }];
}

function sachetsPhrase(count: number): string {
  return count === 1 ? "un sachet bonus" : plural(count, "sachet bonus", "sachets bonus");
}

/** « 1 mission faite sur 3 », the title of the card. */
export function missionsHeadline(missions: MissionsResponse): string {
  const done = missions.missions.filter(
    (mission) => mission.claimed || mission.progress >= mission.target,
  ).length;
  return `${plural(done, "mission faite", "missions faites")} sur ${formatCount(missions.missions.length)}`;
}

/** Said by the closed tile, before the level that opens missions. */
export function missionsLockedToast(now: EpochMs): string {
  return `Les missions du jour commencent au niveau ${missionRulesAt(MISSION_SCHEDULE, now).opensAtLevel}.`;
}

/** Under the missions, before a level opens them. */
export function missionsLockedLine(missions: MissionsResponse): string | null {
  if (missions.day !== null) return null;
  return `Les missions du jour commencent au niveau ${missions.opensAtLevel}.`;
}

/** The claim button: « Prendre 30 XP et 10 écus »; `null` when nothing waits. */
export function missionsClaimAction(missions: MissionsResponse): string | null {
  const { missions: done, bonus } = missions.claimable;
  if (done === 0 && bonus === 0) return null;
  const parts: string[] = [];
  if (done > 0) {
    parts.push(`${formatCount(done * missions.rewards.xp)} XP`);
    parts.push(plural(done * missions.rewards.ecus, "écu", "écus"));
  }
  if (bonus > 0) parts.push(sachetsPhrase(bonus));
  return `Prendre ${listOf(parts)}`;
}

/** Once every mission of the day is claimed. */
export function missionsDoneLine(missions: MissionsResponse): string | null {
  if (missions.missions.length === 0 || !missions.missions.every((mission) => mission.claimed)) {
    return null;
  }
  return "Nouvelles missions demain";
}

export const MISSION_CHANGE_TITLE = "Changer cette mission ?";
export const MISSION_CHANGE_KEEP = "La garder";

/** The confirmation before the one change of the day. */
export function missionChangeConfirm(line: Pick<MissionLine, "text">): string {
  return `« ${line.text} » laisse place à une autre mission, tirée au sort. Tu ne peux changer qu'une mission par jour.`;
}

/** The toast after a claim. */
export function missionsClaimedToast(claim: ClaimMissionsResponse): string {
  const parts: string[] = [];
  if (claim.progress.xpGained > 0) parts.push(`${formatCount(claim.progress.xpGained)} XP`);
  if (claim.ecus > 0) parts.push(plural(claim.ecus, "écu", "écus"));
  if (claim.boosters > 0) parts.push(sachetsPhrase(claim.boosters));
  const waiting = claim.bonusWaiting
    ? " Ta réserve de sachets bonus est pleine. Le sachet des missions t'attend ici."
    : "";
  if (parts.length === 0) {
    return claim.bonusWaiting
      ? "Ta réserve de sachets bonus est pleine. Ouvre un sachet bonus pour prendre celui des missions."
      : "Tes récompenses étaient déjà prises.";
  }
  return `Tu as gagné ${listOf(parts)} !${waiting}`;
}

export function changeMissionRefusalMessage(reason: ChangeMissionRefusal): string {
  switch (reason) {
    case "already_changed":
      return "Tu as déjà changé une mission aujourd'hui.";
    case "mission_done":
      return "Cette mission est déjà faite.";
    case "no_other":
      return "Aucune autre mission n'est possible pour toi aujourd'hui.";
    case "no_missions":
      return "Tu n'as pas de missions aujourd'hui.";
  }
}

function listOf(items: readonly string[]): string {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}
