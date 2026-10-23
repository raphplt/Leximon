import type { AdminOverview } from "@leximon/contract";
import type { ErrorReport } from "./errors";

/** Discord refuses a message over 2,000 characters. */
const MAX_LENGTH = 2000;
const MAX_LINE = 140;

const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});
const numberFormat = new Intl.NumberFormat("fr-FR");

/** The morning summary posted to the team's channel: errors first, then the day's play. */
export function composeDigest(input: {
  readonly now: number;
  readonly errors: ErrorReport;
  readonly overview: AdminOverview;
}): string {
  const { errors, overview } = input;
  const n = (value: number) => numberFormat.format(value);
  const lines = [`**Leximon · ${dayFormat.format(input.now)}**`, ""];

  if (errors.kind === "unavailable") {
    const status = errors.status === null ? "pas de réponse" : `HTTP ${errors.status}`;
    lines.push(`Erreurs : lecture impossible (${status}). Vérifie le jeton d'observabilité.`);
  } else if (errors.total === 0) {
    lines.push("Aucune erreur sur 24 h.");
  } else {
    lines.push(`**${n(errors.total)} erreur${errors.total > 1 ? "s" : ""} sur 24 h**`);
    for (const group of errors.groups) {
      lines.push(clip(`· ${n(group.count)} × ${group.service} — ${plain(group.message)}`));
    }
  }

  const { players, boosters, answers, trades } = overview;
  lines.push(
    "",
    `Sur 24 h : ${n(boosters.last24h)} sachets ouverts, ${n(answers.last24h)} réponses aux défis.`,
    `Joueurs : ${n(players.members)} comptes (+${n(players.newMembers7d)} en 7 jours), ${n(players.guests)} invités.`,
    `Échanges conclus en 7 jours : ${n(trades.completed7d)}.`,
  );
  return lines.join("\n").slice(0, MAX_LENGTH);
}

/** Keeps a logged message from formatting the post or pinging anyone. */
function plain(text: string): string {
  return text
    .replace(/[`*_~|>@]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(line: string): string {
  return line.length <= MAX_LINE ? line : `${line.slice(0, MAX_LINE - 1)}…`;
}

/** Posts to a Discord webhook; mentions are disabled whatever the text holds. */
export async function postToDiscord(
  webhookUrl: string,
  content: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const response = await fetcher(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  }).catch(() => null);
  return response?.ok === true;
}
