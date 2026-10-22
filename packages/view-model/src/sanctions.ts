import type { Sanction, SanctionKind } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";

/** Words of a sanction as the player reads it (R-08, P68): what, why, until when, how to contest. */

const TITLES: Readonly<Record<SanctionKind, string>> = {
  hide_message: "Un de tes messages est masqué",
  reset_pseudo: "Ton pseudo est retiré",
  reset_clan_name: "Le nom de ton clan est retiré",
  mute: "Tu ne peux plus écrire pour l'instant",
  trade_ban: "Tes échanges sont suspendus",
  suspend: "Ton compte est suspendu",
  close: "Ton compte est fermé",
};

export function sanctionTitle(kind: SanctionKind): string {
  return TITLES[kind];
}

/** « Jusqu'au 29 octobre à 14:00 », « Définitive », or null for a one-off measure. */
export function sanctionUntil(
  sanction: Pick<Sanction, "kind" | "until">,
  now: EpochMs,
  timeZone?: string,
): string | null {
  if (sanction.until === null) {
    return sanction.kind === "close" || sanction.kind === "trade_ban" ? "Définitive" : null;
  }
  const until = Date.parse(sanction.until);
  if (until <= now) return "Terminée";
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(until);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `Jusqu'au ${part("day")} ${part("month")} à ${part("hour")}:${part("minute")}`;
}

/** Where a contest stands, or null while none was sent. */
export function contestState(
  sanction: Pick<Sanction, "contestedAt" | "contestOutcome" | "revokedAt">,
): string | null {
  if (sanction.revokedAt !== null || sanction.contestOutcome === "revoked") {
    return "Contestation acceptée : la sanction est levée.";
  }
  if (sanction.contestOutcome === "upheld")
    return "Contestation examinée : la sanction est maintenue.";
  if (sanction.contestedAt !== null) return "Contestation reçue. Un humain la relit.";
  return null;
}

export const CONTEST_HINT =
  "Tu n'es pas d'accord ? Explique pourquoi. Un membre de l'équipe relit, pas une machine.";

const WRITE_BLOCKING: readonly SanctionKind[] = ["mute", "suspend", "close"];

/** Said under the message field while a sanction forbids writing, else null. */
export function writingBlock(
  sanctions: readonly Pick<Sanction, "kind" | "until" | "revokedAt">[],
  now: EpochMs,
): string | null {
  const active = sanctions.find(
    (sanction) =>
      WRITE_BLOCKING.includes(sanction.kind) &&
      sanction.revokedAt === null &&
      (sanction.until === null || Date.parse(sanction.until) > now),
  );
  if (active === undefined) return null;
  const until = sanctionUntil(active, now);
  return until === null
    ? "Une sanction t'empêche d'écrire."
    : `Une sanction t'empêche d'écrire. ${until}.`;
}
