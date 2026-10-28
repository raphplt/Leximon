import { RARITY_LABELS, type SanctionKind } from "@leximon/contract";
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
  invite_waitlist: "Liste d'attente invitée",
  dismiss_report: "Signalement classé",
  sanction: "Sanction",
  resolve_contest: "Contestation tranchée",
  invite_create: "Invitation créée",
  invite_revoke: "Invitation retirée",
  invite_places: "Places d'une invitation",
};

/** What the team does, as the sanction form and the contests name it. */
export const SANCTION_LABELS: Readonly<Record<SanctionKind, string>> = {
  hide_message: "Masquer le message",
  reset_pseudo: "Retirer le pseudo",
  reset_clan_name: "Retirer le nom du clan",
  mute: "Rendre muet",
  trade_ban: "Interdire les échanges",
  suspend: "Suspendre le compte",
  close: "Fermer le compte",
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
  if (typeof details["maxUses"] === "number") {
    const from = typeof details["from"] === "number" ? `${formatNumber(details["from"])} → ` : "";
    parts.push(`${from}${formatNumber(details["maxUses"])} place(s)`);
  }
  if (typeof details["invited"] === "number") {
    parts.push(`${formatNumber(details["invited"])} adresse(s) invitée(s)`);
  }
  if (typeof details["erased"] === "number") {
    parts.push(`${formatNumber(details["erased"])} adresse(s)`);
  }
  return parts.join(" · ");
}
