import type { CabinetCitation, CabinetRelation, CatalogCabinet } from "@leximon/contract";
import { romanNumeral } from "./format";

export type CabinetUsage = NonNullable<CatalogCabinet["usage"]>;

export const CABINET_TITLE = "Cabinet du mot";
export const CABINET_OPEN = "Ouvrir le cabinet du mot";
export const CABINET_LOCKED = "Le cabinet du mot est réservé aux mécènes abonnés.";
export const CABINET_LOCKED_ACTION = "Voir l'abonnement mécène";
export const CABINET_MISSING = "Ce mot n'a pas encore de cabinet.";
export const CABINET_FAILED = "Le cabinet ne s'est pas chargé. Réessaie.";
export const CABINET_USAGE_TITLE = "L'usage du mot depuis 1800";
export const CABINET_USAGE_NOTE =
  "Emplois pour un milliard de mots, par décennie, dans les livres en français numérisés par Google.";
export const CABINET_LITTRE_TITLE = "Dans le Littré";
export const CABINET_ETYMOLOGY_TITLE = "Étymologie";
export const CABINET_HISTORY_TITLE = "Historique";
export const CABINET_HISTORY_NOTE =
  "Les plus anciens emplois que relève le Littré, siècle par siècle.";
export const CABINET_FAMILY_TITLE = "La famille du mot";
export const CABINET_SOURCES =
  "Courbe tirée de Google Books Ngram, sous licence CC BY 3.0. Article du Littré, dans le domaine public.";

/** Below this share of its peak, a word has left the books; below the second, it is rare. */
const GONE_SHARE = 0.02;
const RARE_SHARE = 0.1;
/** At least this share of its peak in the last decade, a word is still in use. */
const IN_USE_SHARE = 0.5;

const yearAt = (usage: CabinetUsage, index: number) => usage.from + index * usage.step;

function lastIndexAbove(values: readonly number[], floor: number): number {
  for (let index = values.length - 1; index >= 0; index--) {
    if ((values[index] ?? 0) >= floor) return index;
  }
  return -1;
}

/** The curve read in one sentence: when the word peaks, and whether it has left the books. */
export function usageLine(usage: CabinetUsage | null): string {
  const values = usage?.perBillion ?? [];
  const peak = Math.max(0, ...values);
  if (usage === null || peak === 0) {
    return "Le mot est trop rare dans les livres numérisés pour tracer sa courbe.";
  }
  const peakIndex = values.indexOf(peak);
  const lastIndex = values.length - 1;
  const last = values[lastIndex] ?? 0;
  const opening =
    peakIndex === 0
      ? `Dès ${usage.from}, le mot est à son plus haut`
      : `Le mot culmine vers ${yearAt(usage, peakIndex)}`;
  if (last >= peak * IN_USE_SHARE) {
    if (peakIndex === lastIndex)
      return "Le mot n'a jamais été aussi présent dans les livres qu'aujourd'hui.";
    return `${opening} et reste employé aujourd'hui.`;
  }
  const gone = lastIndexAbove(values, peak * GONE_SHARE);
  if (gone < lastIndex) {
    return `${opening}, puis disparaît presque des livres après ${yearAt(usage, gone)}.`;
  }
  const rare = lastIndexAbove(values, peak * RARE_SHARE);
  if (rare < lastIndex) return `${opening}, puis se raréfie après ${yearAt(usage, rare)}.`;
  return `${opening}. Il est aujourd'hui ${Math.round(peak / last)} fois moins employé.`;
}

const RATE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const ROUND_RATE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** « 52 par milliard de mots », « 0,4 par milliard de mots ». */
export function usageRate(perBillion: number): string {
  const format = perBillion >= 10 ? ROUND_RATE : RATE;
  return `${format.format(perBillion)} par milliard de mots`;
}

export type UsagePoint = {
  readonly x: number;
  readonly y: number;
  /** « années 1880 » */
  readonly decade: string;
  readonly rate: string;
};

export type UsageChart = {
  /** SVG path of the 2 px line, then of the wash under it, closed on the baseline. */
  readonly line: string;
  readonly area: string;
  readonly points: readonly UsagePoint[];
  readonly peak: UsagePoint;
  /** Every half-century, at its place on the x axis. */
  readonly ticks: readonly { readonly x: number; readonly label: string }[];
};

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * The curve laid in a `width` × `height` box, the same on every screen. The top keeps a tenth of
 * air above the peak, so that its mark is not cut.
 */
export function usageChart(usage: CabinetUsage, width: number, height: number): UsageChart | null {
  const values = usage.perBillion;
  const peak = Math.max(0, ...values);
  if (values.length < 2 || peak === 0) return null;
  const top = peak * 1.1;
  const points = values.map((value, index) => ({
    x: round((index / (values.length - 1)) * width),
    y: round(height - (value / top) * height),
    decade: `années ${yearAt(usage, index)}`,
    rate: usageRate(value),
  }));
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  const ticks: { x: number; label: string }[] = [];
  for (let index = 0; index < values.length; index++) {
    const year = yearAt(usage, index);
    if (year % 50 === 0) ticks.push({ x: points[index]?.x ?? 0, label: String(year) });
  }
  const peakPoint = points[values.indexOf(peak)];
  if (peakPoint === undefined) return null;
  return {
    line,
    area: `${line} L${width} ${height} L0 ${height} Z`,
    points,
    peak: peakPoint,
    ticks,
  };
}

/** The point nearest to `x`, for the readout that follows the finger or the pointer. */
export function usagePointAt(chart: UsageChart, x: number): UsagePoint {
  let nearest = chart.peak;
  for (const point of chart.points) {
    if (Math.abs(point.x - x) < Math.abs(nearest.x - x)) nearest = point;
  }
  return nearest;
}

/** « XIIIe siècle », « Ier siècle ». */
export function centuryLabel(century: number): string {
  return `${romanNumeral(century)}${century === 1 ? "er" : "e"} siècle`;
}

/** « VOLT., Lett. 12 juin », as the Littré prints its sources; empty for an unsigned citation. */
export function citationSource(citation: CabinetCitation): string {
  return [citation.author, citation.reference].filter((part) => part.trim() !== "").join(", ");
}

const RELATION_LABELS: Record<CabinetRelation, string> = {
  base: "Vient de",
  derived: "A donné",
  sibling: "De la même famille",
};

export type FamilyGroup = {
  readonly relation: CabinetRelation;
  readonly label: string;
  readonly members: CatalogCabinet["family"];
};

/** The family by relation, in the order a reader follows it: where it comes from, then what it gave. */
export function familyGroups(family: CatalogCabinet["family"]): FamilyGroup[] {
  return (["base", "derived", "sibling"] as const)
    .map((relation) => ({
      relation,
      label: RELATION_LABELS[relation],
      members: family.filter((member) => member.relation === relation),
    }))
    .filter((group) => group.members.length > 0);
}
