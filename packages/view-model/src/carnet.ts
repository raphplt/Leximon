import type { CarnetRefusal, CarnetResponse } from "@leximon/contract";
import { changelogDate } from "./changelog";
import { plural } from "./format";
import { rewardItem, rewardsPhrase } from "./rewards";

/** The carnet de pointage: its dialog, and its line in the rewards. */

export const CARNET_TITLE = "Carnet de pointage";
export const CARNET_TAKE = "Prendre la case";
export const CARNET_BUSY = "Ouverture…";
export const CARNET_FAILED = "La case n'a pas été prise. Réessaie.";
export const CARNET_RULE =
  "Chaque jour où tu joues remplit une case, même si tu sautes des jours. Une case que tu n'as pas prise t'attend, même après la fin du carnet.";

export type CarnetCaseStatus = "claimed" | "waiting" | "later";

export interface CarnetCase {
  readonly number: number;
  readonly status: CarnetCaseStatus;
  /** « 2 sachets bonus ». */
  readonly phrase: string;
  readonly icon: ReturnType<typeof rewardItem>["icon"];
  /** Drawn bigger: the cases that give more than écus. */
  readonly big: boolean;
  readonly last: boolean;
  /** « Case 7, un sachet garni, prise ». */
  readonly label: string;
}

export interface CarnetView {
  readonly cases: readonly CarnetCase[];
  /** « Du 9 novembre au 6 décembre 2026 ». */
  readonly dates: string;
  /** « 5 cases remplies sur 28 ». */
  readonly filled: string;
}

/** The current period's carnet. */
export function carnetView(carnet: CarnetResponse): CarnetView {
  const total = carnet.cases.length;
  return {
    cases: carnet.cases.map((rewards, index) => {
      const number = index + 1;
      const status: CarnetCaseStatus =
        number <= carnet.claimed ? "claimed" : number <= carnet.earned ? "waiting" : "later";
      const [first] = rewards;
      const phrase = rewardsPhrase(rewards);
      const said = status === "claimed" ? "prise" : status === "waiting" ? "à prendre" : "à venir";
      return {
        number,
        status,
        phrase,
        icon: first === undefined ? "ecu" : rewardItem(first).icon,
        big: rewards.some((reward) => reward.kind !== "ecus"),
        last: number === total,
        label: `Case ${number}, ${phrase}, ${said}`,
      };
    }),
    dates: carnetDates(carnet.period.firstDay, carnet.period.lastDay),
    filled: `${plural(carnet.earned, "case remplie", "cases remplies")} sur ${total}`,
  };
}

function carnetDates(first: string, last: string): string {
  const [from, to] = [changelogDate(first), changelogDate(last)];
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  return `Du ${sameYear ? from.replace(/ \d{4}$/, "") : from} au ${to}`;
}

/** A case waits to be claimed. */
export function carnetWaits(carnet: CarnetResponse | null): boolean {
  return carnet !== null && carnet.next !== null;
}

/** The button: « Prendre la case 5 », or the case of an earlier carnet first. */
export function carnetAction(carnet: CarnetResponse): string | null {
  const { next } = carnet;
  if (next === null) return null;
  return next.period < carnet.period.index
    ? `Prendre la case ${next.case} du carnet précédent`
    : `Prendre la case ${next.case}`;
}

/** « 10 écus », what a case gives. */
export function carnetCasePhrase(carnet: CarnetResponse | null, caseNumber: number): string {
  const rewards = carnet?.cases[caseNumber - 1];
  return rewards === undefined ? "" : rewardsPhrase(rewards);
}

/** What the next case gives, said before it is claimed. */
export function carnetNextLine(carnet: CarnetResponse): string | null {
  const { next } = carnet;
  if (next === null) return null;
  const rewards = carnet.cases[next.case - 1];
  if (rewards === undefined) return null;
  return `La case ${next.case} t'offre ${rewardsPhrase(rewards)}.`;
}

/** Once every case earned is claimed: what tomorrow fills. */
export function carnetTomorrowLine(carnet: CarnetResponse): string | null {
  if (!carnet.started || carnet.next !== null) return null;
  const number = carnet.earned + 1;
  const rewards = carnet.cases[number - 1];
  if (rewards === undefined) {
    return "Ton carnet est rempli. Un nouveau carnet commence à la fin de celui-ci.";
  }
  return `Joue un autre jour pour remplir la case ${number}, qui t'offre ${rewardsPhrase(rewards)}.`;
}

/** Before the carnet starts. */
export function carnetNotStartedLine(carnet: CarnetResponse): string | null {
  if (carnet.started) return null;
  return carnet.account
    ? "Ton carnet de pointage commence le jour où tu joues après ta semaine de bienvenue."
    : "Crée ton compte pour recevoir ta semaine de bienvenue, puis ton carnet de pointage.";
}

/** In the rewards and the mail: the cases that wait. */
export function carnetWaitingLine(carnet: CarnetResponse | null): string | null {
  if (carnet === null || carnet.waiting === 0) return null;
  return carnet.waiting === 1
    ? "Une case de ton carnet de pointage t'attend."
    : `${plural(carnet.waiting, "case", "cases")} de ton carnet de pointage t'attendent.`;
}

export function carnetRefusalMessage(reason: CarnetRefusal): string {
  switch (reason) {
    case "not_open":
      return "Cette case n'est pas encore remplie. Joue un autre jour pour la remplir.";
    case "reserve_full":
      return "Ta réserve de sachets bonus est pleine. Ouvre un sachet bonus pour pouvoir prendre cette case.";
    case "account_required":
      return "Crée ton compte pour recevoir ton carnet de pointage.";
  }
}
