import type { WelcomeRefusal, WelcomeWeekResponse } from "@leximon/contract";
import { plural } from "./format";
import { givesSachets, rewardItem, rewardsPhrase } from "./rewards";

/** The welcome week: its dialog and its line in the mail. */

export const WELCOME_TITLE = "Semaine de bienvenue";
export const WELCOME_OPEN = "Ouvrir la case du jour";
export const WELCOME_TAKE = "Prendre les récompenses";
/** Under tomorrow's case, in place of its number. */
export const WELCOME_TOMORROW = "Demain";
export const WELCOME_RULE =
  "Une case s'ouvre chaque jour où tu viens jouer. Les jours n'ont pas besoin de se suivre.";

export type WelcomeCaseStatus = "claimed" | "today" | "tomorrow" | "later";

export interface WelcomeCase {
  readonly day: number;
  readonly status: WelcomeCaseStatus;
  /** « Jour 3 ». */
  readonly label: string;
  /** « 2 sachets bonus ». */
  readonly phrase: string;
  /** The icon of its main reward. */
  readonly icon: ReturnType<typeof rewardItem>["icon"];
  /** The last day, drawn bigger. */
  readonly last: boolean;
}

export interface WelcomeView {
  readonly cases: readonly WelcomeCase[];
  /** The day to claim now; `null` when none waits today. */
  readonly today: number | null;
  /** All days claimed. */
  readonly done: boolean;
}

export function welcomeView(week: WelcomeWeekResponse): WelcomeView {
  const total = week.days.length;
  const next = week.claimed + 1;
  const today = week.account && week.open && next <= total ? next : null;
  return {
    cases: week.days.map((rewards, index) => {
      const day = index + 1;
      const status: WelcomeCaseStatus =
        day <= week.claimed
          ? "claimed"
          : day === today
            ? "today"
            : day === next && week.account
              ? "tomorrow"
              : "later";
      const [first] = rewards;
      return {
        day,
        status,
        label: `Jour ${day}`,
        phrase: rewardsPhrase(rewards),
        icon: first === undefined ? "sachet" : rewardItem(first).icon,
        last: day === total,
      };
    }),
    today,
    done: week.claimed >= total,
  };
}

/** The day of the welcome week to claim now; `null` when none waits. */
export function welcomeToday(week: WelcomeWeekResponse | null): WelcomeCase | null {
  if (week === null) return null;
  return welcomeView(week).cases.find((day) => day.status === "today") ?? null;
}

/** A day of the welcome week waits to be claimed now. */
export function welcomeWaits(week: WelcomeWeekResponse | null): boolean {
  return welcomeToday(week) !== null;
}

/** « Jour 3 sur 7 », above the dialog. */
export function welcomeKicker(day: number, total: number): string {
  return `Jour ${day} sur ${total}`;
}

/** « Semaine de bienvenue, jour 3 », the mail's entry. */
export function welcomeMailTitle(day: number): string {
  return `${WELCOME_TITLE}, jour ${day}`;
}

/** In the e-mail that says the sachets are full: today's day, if one waits. */
export function welcomeReminderLine(week: WelcomeWeekResponse | null): string | null {
  const today = welcomeToday(week);
  if (today === null) return null;
  return `Le jour ${today.day} de ta semaine de bienvenue t'attend aussi, avec ${today.phrase}.`;
}

/**
 * Under an opened day, only on the last one: the week is over. The other days show the row of
 * the week instead, tomorrow's case lit.
 */
export function welcomeAfterClaim(week: WelcomeWeekResponse | null, day: number): string | null {
  if (week === null || day < week.days.length) return null;
  return "C'était le dernier jour de ta semaine de bienvenue. Ton carnet de pointage prend le relais, une case par jour où tu joues.";
}

/** For a guest, on the wall that asks for an account: what the week gives, counted. */
export function welcomeGuestLine(week: WelcomeWeekResponse | null): string | null {
  if (week === null || week.account) return null;
  const sachets = week.days.flat().filter(givesSachets).length;
  return `Ton compte t'offre aussi une semaine de bienvenue, avec ${plural(sachets, "sachet", "sachets")} en ${plural(week.days.length, "jour", "jours")}.`;
}

/** Why a day stays closed, and what to do. */
export function welcomeRefusalMessage(reason: WelcomeRefusal): string {
  switch (reason) {
    case "not_open":
      return "Cette case s'ouvre demain.";
    case "reserve_full":
      return "Ta réserve de sachets bonus est pleine. Ouvre un sachet bonus pour pouvoir prendre cette case.";
    case "account_required":
      return "Crée ton compte pour recevoir ta semaine de bienvenue.";
  }
}
