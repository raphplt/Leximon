/**
 * Clans: names and texts, roles, membership, discussion. Pure functions: the
 * server checks uniqueness, locks and dates.
 */

import { pseudoKey } from "../account/pseudo";
import type { EpochMs } from "../booster/refill";
import {
  hasContactDetails,
  isRefusedName,
  isRefusedText,
  withoutInvisible,
} from "../moderation/text-filter";

export interface ClanRules {
  /** Period start; the rules in force at the time of each action apply. */
  readonly startsAt: EpochMs;
  readonly nameMinLength: number;
  readonly nameMaxLength: number;
  readonly mottoMaxLength: number;
  readonly messageMaxLength: number;
  /** Shortest time between two messages of a player. */
  readonly messageIntervalMs: number;
  /** A chief away this long hands the role over. */
  readonly chiefAbsenceMs: number;
  /** Silences a chief or deputy may give, shortest first. */
  readonly muteDurationsMs: readonly number[];
  /** Messages older than this are erased, unless reported and not yet handled. */
  readonly messageRetentionMs: number;
  /** Engravings (card ids) and colours every clan may use for its emblem; levels open more. */
  readonly emblemEngravings: readonly string[];
  readonly emblemColors: readonly string[];
}

export type ClanSchedule = readonly [ClanRules, ...ClanRules[]];

export function clanRulesAt(schedule: ClanSchedule, time: EpochMs): ClanRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

export type EmblemItem =
  | { readonly kind: "engraving"; readonly id: string }
  | { readonly kind: "color"; readonly id: string };

export const CLAN_ENTRY_MODES = ["open", "request", "invite"] as const;
export type ClanEntryMode = (typeof CLAN_ENTRY_MODES)[number];

export const CLAN_ROLES = ["chief", "deputy", "member"] as const;
export type ClanRole = (typeof CLAN_ROLES)[number];

// --- Texts ---------------------------------------------------------------------------------------

export type ClanNameRefusal = "too_short" | "too_long" | "invalid_characters" | "refused";

export type ClanNameCheck =
  | { readonly ok: true; readonly name: string; readonly key: string }
  | { readonly ok: false; readonly reason: ClanNameRefusal };

/** Same shape as a pseudo: Latin letters and digits, single separators between them. */
const NAME_SHAPE = /^[\p{Script=Latin}\p{Nd}]+(?:[ '._-][\p{Script=Latin}\p{Nd}]+)*$/u;

export function checkClanName(rules: ClanRules, raw: string): ClanNameCheck {
  const name = collapse(raw);
  const length = [...name].length;
  if (length > rules.nameMaxLength) return { ok: false, reason: "too_long" };
  if (!NAME_SHAPE.test(name)) {
    return { ok: false, reason: length < rules.nameMinLength ? "too_short" : "invalid_characters" };
  }
  const key = pseudoKey(name);
  if (length < rules.nameMinLength || key.length < rules.nameMinLength) {
    return { ok: false, reason: "too_short" };
  }
  if (isRefusedName(name)) return { ok: false, reason: "refused" };
  return { ok: true, name, key };
}

/** `contact`: a link, an e-mail address or a phone number. */
export type TextRefusal = "empty" | "too_long" | "refused" | "contact";

export type TextCheck =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: TextRefusal };

/** A motto: optional, so empty is fine and comes back as "". */
export function checkClanMotto(rules: ClanRules, raw: string): TextCheck {
  const text = collapse(withoutInvisible(raw));
  if ([...text].length > rules.mottoMaxLength) return { ok: false, reason: "too_long" };
  return screened(text);
}

/** A message of the discussion. Line breaks are kept, three at most in a row. */
export function checkClanMessage(rules: ClanRules, raw: string): TextCheck {
  const text = withoutInvisible(raw)
    .normalize("NFC")
    .replaceAll(/[^\S\n]+/g, " ")
    .replaceAll(/ *\n */g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length === 0) return { ok: false, reason: "empty" };
  if ([...text].length > rules.messageMaxLength) return { ok: false, reason: "too_long" };
  return screened(text);
}

function screened(text: string): TextCheck {
  if (isRefusedText(text)) return { ok: false, reason: "refused" };
  if (hasContactDetails(text)) return { ok: false, reason: "contact" };
  return { ok: true, text };
}

function collapse(raw: string): string {
  return raw.normalize("NFC").trim().replaceAll(/\s+/g, " ");
}

// --- Emblem --------------------------------------------------------------------------------------

/** Engravings and colours a clan may choose: everyone's, then those its level opened. */
export function emblemChoices(
  rules: ClanRules,
  extra: readonly EmblemItem[],
): { readonly engravings: readonly string[]; readonly colors: readonly string[] } {
  return {
    engravings: [
      ...rules.emblemEngravings,
      ...extra.filter((item) => item.kind === "engraving").map((item) => item.id),
    ],
    colors: [
      ...rules.emblemColors,
      ...extra.filter((item) => item.kind === "color").map((item) => item.id),
    ],
  };
}

export interface Emblem {
  readonly engraving: string;
  readonly colors: readonly [string, string];
}

export function isEmblemAllowed(
  rules: ClanRules,
  extra: readonly EmblemItem[],
  emblem: Emblem,
): boolean {
  const choices = emblemChoices(rules, extra);
  return (
    choices.engravings.includes(emblem.engraving) &&
    emblem.colors.every((color) => choices.colors.includes(color)) &&
    emblem.colors[0] !== emblem.colors[1]
  );
}

// --- Roles ---------------------------------------------------------------------------------------

export type ClanAction =
  | "accept_request"
  | "renew_invite"
  | "delete_message"
  | "kick"
  | "mute"
  | "appoint_deputy"
  | "edit_clan"
  | "hand_over";

/** What a role may do. `target` is the role of the member the action falls on, if any. */
export function canAct(actor: ClanRole, action: ClanAction, target?: ClanRole): boolean {
  switch (action) {
    case "accept_request":
    case "delete_message":
      return actor !== "member";
    case "kick":
    case "mute":
      if (target === undefined || target === "chief") return false;
      return actor === "chief" || (actor === "deputy" && target === "member");
    case "appoint_deputy":
    case "edit_clan":
    case "renew_invite":
      return actor === "chief";
    case "hand_over":
      return actor === "chief" && target !== undefined && target !== "chief";
  }
}

export interface ClanMemberState {
  readonly userId: string;
  readonly role: ClanRole;
  readonly joinedAt: EpochMs;
}

/**
 * Who becomes chief when the chief leaves or stays away: the oldest deputy, else the oldest
 * member; `null` if nobody is left. Ties on the arrival date fall on the user id, to be stable.
 */
export function nextChief(members: readonly ClanMemberState[], leavingId: string): string | null {
  const others = members.filter((member) => member.userId !== leavingId);
  const byAge = (a: ClanMemberState, b: ClanMemberState) =>
    a.joinedAt - b.joinedAt || (a.userId < b.userId ? -1 : 1);
  const deputies = others.filter((member) => member.role === "deputy").sort(byAge);
  const rest = others.filter((member) => member.role === "member").sort(byAge);
  return deputies[0]?.userId ?? rest[0]?.userId ?? null;
}

export function isChiefAway(rules: ClanRules, chiefLastSeenAt: EpochMs, now: EpochMs): boolean {
  return now - chiefLastSeenAt >= rules.chiefAbsenceMs;
}

/** When the player may write again, given their last message; `null` if right away. */
export function nextMessageAt(
  rules: ClanRules,
  lastMessageAt: EpochMs | null,
  now: EpochMs,
): EpochMs | null {
  if (lastMessageAt === null) return null;
  const next = lastMessageAt + rules.messageIntervalMs;
  return next > now ? next : null;
}

export function isMuteDurationAllowed(rules: ClanRules, durationMs: number): boolean {
  return rules.muteDurationsMs.includes(durationMs);
}
