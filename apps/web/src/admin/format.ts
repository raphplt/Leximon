import { RARITY_LABELS } from "@leximon/contract";
import { RARITIES, type Rarity } from "@leximon/core";

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const NUMBER = new Intl.NumberFormat("fr-FR");

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

/** "12 Courante · 3 Rare…", rarest last, only the rarities present. */
export function rarityBreakdown(counts: Partial<Record<Rarity, number>>): string {
  const parts = RARITIES.flatMap((rarity) => {
    const n = counts[rarity] ?? 0;
    return n > 0 ? [`${formatNumber(n)} ${RARITY_LABELS[rarity]}`] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : "aucune";
}

/** Labels of the actions logged in `admin_actions`. */
export const ACTION_LABELS: Readonly<Record<string, string>> = {
  grant_bonus: "Plis bonus offerts",
  ban: "Bannissement",
  unban: "Levée du bannissement",
  cancel_trade: "Échange annulé",
  export_waitlist: "Export de la liste d'attente",
  launch_campaign: "Campagne lancée",
  pause_campaign: "Campagne en pause",
  resume_campaign: "Campagne reprise",
  cancel_campaign: "Campagne annulée",
  erase_waitlist: "Liste d'attente effacée",
};

/** A short readable summary of an action's details. */
export function actionSummary(details: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof details["added"] === "number") parts.push(`+${details["added"]} pli(s)`);
  if (typeof details["days"] === "number") parts.push(`${details["days"]} jour(s)`);
  if (details["days"] === null) parts.push("sans limite");
  if (typeof details["reason"] === "string") parts.push(`« ${details["reason"]} »`);
  if (typeof details["name"] === "string") parts.push(`« ${details["name"]} »`);
  if (typeof details["recipients"] === "number") {
    parts.push(`${formatNumber(details["recipients"])} destinataire(s)`);
  }
  if (typeof details["erased"] === "number") {
    parts.push(`${formatNumber(details["erased"])} adresse(s)`);
  }
  return parts.join(" · ");
}
