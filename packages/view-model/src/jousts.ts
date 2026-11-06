import type {
  DeckRefusal,
  JoustAccess,
  JoustSummary,
  JoustView,
  LaunchRefusal,
  PlayerBadge,
  RunScore,
} from "@leximon/contract";
import { type EpochMs, JOUST_SCHEDULE, joustRulesAt } from "@leximon/core";
import { plural } from "./format";
import { playerName } from "./trades";

/** The jousts' copy and the logic of their screens, the same on the web and the phone. */

export const JOUSTS_TITLE = "Joutes";
export const JOUSTS_RULES =
  "Tu réponds aux 5 mots tirés du deck de ton adversaire, puis il répond aux 5 mots du tien. Pour chaque mot, tu lis la définition et tu choisis le mot parmi 4, en 15 secondes. Le plus de bonnes réponses gagne, et le temps total départage une égalité.";
export const LAUNCH_RANKED = "Trouver un adversaire";
export const LAUNCH_FRIENDLY = "Défier un ami";
export const REVENGE = "Proposer une revanche";
export const EDIT_DECK = "Changer mon deck";
export const SAVE_DECK = "Garder ce deck";
export const PLAY_JOUST = "Jouer";
export const NO_JOUSTS = "Aucune joute pour l'instant. Lance la première.";
export const NO_FRIENDS_TO_DEFY =
  "Aucun ami ni membre de ton clan ne peut jouter pour l'instant. Ils doivent avoir un pseudo et le niveau des joutes.";

/** Why the player cannot joust, or `null` when they can. */
export function accessText(access: JoustAccess, level: number): string | null {
  switch (access) {
    case "open":
      return null;
    case "account_required":
      return "Crée un compte pour jouter contre d'autres joueurs.";
    case "pseudo_required":
      return "Choisis un pseudo pour que tes adversaires sachent contre qui ils joutent.";
    case "level_too_low":
      return `Les joutes ouvrent au niveau ${level}.`;
    case "not_yet":
      return "Les joutes s'ouvrent d'abord à quelques testeurs, le temps de régler le chrono. Elles arrivent bientôt pour tout le monde.";
  }
}

/** « 4 sur 5 en 31 s ». */
export function scoreText(score: RunScore, questions: number): string {
  return `${score.correct} sur ${questions} en ${Math.round(score.ms / 1000)} s`;
}

/** « demain 18 h 40 », « aujourd'hui 9 h 05 », in the player's time zone. */
export function deadlineText(at: string, now: EpochMs, timeZone?: string): string {
  const day = (time: number) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone, dateStyle: "short" }).format(time);
  const time = Date.parse(at);
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(time);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  const clock = `${hour} h ${minute}`;
  if (day(time) === day(now)) return `aujourd'hui ${clock}`;
  if (day(time) === day(now + 86_400_000)) return `demain ${clock}`;
  const date = new Intl.DateTimeFormat("fr-FR", { timeZone, day: "numeric", month: "long" }).format(
    time,
  );
  return `le ${date} à ${clock}`;
}

export interface JoustLine {
  readonly title: string;
  readonly detail: string;
  /** The player has a run to play in it. */
  readonly toPlay: boolean;
}

/** A joust in the player's list. */
export function joustLine(
  joust: JoustSummary,
  questions: number,
  now: EpochMs,
  timeZone?: string,
): JoustLine {
  const name = playerName(joust.opponent);
  const kind = joust.kind === "ranked" ? "Joute classée" : "Joute amicale";
  const title = `${kind} contre ${name}`;
  switch (joust.state) {
    case "play":
      return {
        title,
        detail:
          joust.launched || joust.replyBy === null
            ? "À toi de jouer."
            : `À toi de jouer, jusqu'à ${deadlineText(joust.replyBy, now, timeZone)}.`,
        toPlay: true,
      };
    case "waiting":
      return {
        title,
        detail:
          joust.replyBy === null
            ? `${name} joue sa partie.`
            : `${name} a jusqu'à ${deadlineText(joust.replyBy, now, timeZone)} pour jouer.`,
        toPlay: false,
      };
    case "ended":
      return { title, detail: endedDetail(joust, name, questions), toPlay: false };
  }
}

function endedDetail(joust: JoustSummary, name: string, questions: number): string {
  if (joust.forfeit) {
    return joust.launched
      ? `Gagnée. ${name} n'a pas joué à temps.`
      : "Perdue. Tu n'as pas joué à temps.";
  }
  const scores =
    joust.mine === null || joust.theirs === null
      ? ""
      : ` ${scoreText(joust.mine, questions)} contre ${scoreText(joust.theirs, questions)}.`;
  switch (joust.outcome) {
    case "won":
      return `Gagnée.${scores}`;
    case "lost":
      return `Perdue.${scores}`;
    default:
      return `Égalité.${scores}`;
  }
}

/** The title of the end screen. */
export function outcomeTitle(joust: JoustSummary): string {
  const name = playerName(joust.opponent);
  switch (joust.outcome) {
    case "won":
      return "Tu gagnes la joute !";
    case "lost":
      return `${name} gagne la joute`;
    default:
      return "Égalité parfaite";
  }
}

/** « 40 XP et 1 sachet bonus en réserve », or `null` when the joust gave nothing. */
export function rewardText(result: NonNullable<JoustView["result"]>): string | null {
  const parts = [
    ...(result.xp > 0 ? [`${result.xp} XP`] : []),
    ...(result.boosters > 0 ? [plural(result.boosters, "sachet bonus", "sachets bonus")] : []),
  ];
  if (parts.length === 0) return null;
  return `Tu gagnes ${parts.join(" et ")}${result.boosters > 0 ? " en réserve" : ""}.`;
}

/**
 * What the first player had at this point of their run, for the second player:
 * « À la 3e question, Alix en avait 2. »
 */
export function ghostLine(
  ghost: NonNullable<JoustView["ghost"]>,
  position: number,
  opponent: PlayerBadge | null,
): string {
  const name = playerName(opponent);
  const had = ghost.slice(0, position + 1).filter((answer) => answer.correct).length;
  const ordinal = position === 0 ? "1re" : `${position + 1}e`;
  return `À la ${ordinal} question, ${name} en avait ${had}.`;
}

/** Above the second player's run: they race the first player's recorded run. */
export function ghostTitle(opponent: PlayerBadge | null): string {
  return `Tu joues contre la partie enregistrée de ${playerName(opponent)}.`;
}

/** Seconds left on the question's clock. */
export function secondsLeft(deadline: EpochMs, now: EpochMs): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** The part of the clock left, between 0 and 1, for a clock of `totalMs`. */
export function clockShare(deadline: EpochMs, totalMs: number, now: EpochMs): number {
  if (totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, (deadline - now) / totalMs));
}

/** « Question 3 sur 5 ». */
export function questionCounter(position: number, questions: number): string {
  return `Question ${position + 1} sur ${questions}`;
}

export function joustAnswerFeedback(answer: { readonly correct: boolean; readonly late: boolean }) {
  if (answer.late) return "Le temps était écoulé. La question compte fausse.";
  return answer.correct ? "Bonne réponse" : "Mauvaise réponse";
}

/** The waiting line once the first run is over. */
export function firstRunDone(opponent: PlayerBadge | null, replyBy: string | null, now: EpochMs) {
  const name = playerName(opponent);
  return replyBy === null
    ? `Ta partie est jouée. ${name} va jouer la sienne.`
    : `Ta partie est jouée. ${name} a jusqu'à ${deadlineText(replyBy, now)} pour jouer la sienne.`;
}

export function launchRefusalText(reason: LaunchRefusal | "account_locked", level: number) {
  switch (reason) {
    case "not_open":
      return `Les joutes ouvrent au niveau ${level}, avec un compte et un pseudo.`;
    case "deck_too_small":
      return "Il te faut au moins 5 mots trouvés une fois pour faire un deck. Réponds à tes défis pour en trouver.";
    case "deck_not_saved":
      return "Compose ton deck avant ta première joute : ce sont tes mots que l'autre devra trouver.";
    case "too_many_waiting":
      return "Tu as déjà 5 joutes qui attendent leur adversaire. Lance la suivante quand l'une d'elles est finie.";
    case "no_opponent":
      return "Personne n'est disponible pour une joute classée en ce moment. Réessaie plus tard, ou défie un ami.";
    case "opponent_unavailable":
      return "Ce joueur ne peut pas jouter en ce moment.";
    case "not_friends":
      return "Tu peux défier tes amis et les membres de ton clan.";
    case "account_locked":
      return "Tu ne peux pas jouter tant que ton compte est suspendu.";
  }
}

export function deckRefusalText(reason: DeckRefusal | "account_locked"): string {
  switch (reason) {
    case "too_few":
      return "Un deck compte au moins 5 cartes.";
    case "too_many":
      return "Un deck compte 10 cartes au plus.";
    case "duplicate":
      return "Une carte ne peut entrer qu'une fois dans le deck.";
    case "not_eligible":
      return "Une de ces cartes ne peut plus entrer dans ton deck. Recharge la page.";
    case "over_budget":
      return "Ce deck dépasse ses points. Remplace une carte rare par une plus courante.";
    case "not_open":
      return "Les joutes ne te sont pas encore ouvertes.";
    case "account_locked":
      return "Tu ne peux pas changer ton deck tant que ton compte est suspendu.";
  }
}

/** « 8 cartes sur 10, 21 points sur 25 ». */
export function deckSummary(cards: number, size: number, cost: number, budget: number): string {
  return `${plural(cards, "carte", "cartes")} sur ${size}, ${plural(cost, "point", "points")} sur ${budget}`;
}

export const DECK_RULES =
  "Ton deck compte de 5 à 10 cartes, prises parmi tes mots trouvés au moins une fois. Chaque rareté coûte des points, de 1 pour une carte Courante à 6 pour une Légendaire, et le deck en dépense 25 au plus. Chaque joute en tire 5 au hasard.";

export const DECK_AUTO =
  "Le jeu a composé ce deck avec tes mots les plus rares. Change-le quand tu veux.";

/** Toggles a card in the deck being edited, refusing what would break its size or budget. */
export function toggleDeckCard(
  deck: readonly string[],
  cardId: string,
  costOf: (cardId: string) => number,
  limits: { readonly size: number; readonly budget: number },
): { readonly deck: readonly string[]; readonly refused: string | null } {
  if (deck.includes(cardId)) return { deck: deck.filter((id) => id !== cardId), refused: null };
  if (deck.length >= limits.size) {
    return { deck, refused: `Ton deck compte déjà ${limits.size} cartes, le maximum.` };
  }
  const cost = deck.reduce((total, id) => total + costOf(id), 0) + costOf(cardId);
  if (cost > limits.budget) {
    return {
      deck,
      refused: `Cette carte dépasserait les ${limits.budget} points du deck. Retire une carte plus rare.`,
    };
  }
  return { deck: [...deck, cardId], refused: null };
}

/** Jousts sorted for the list: the ones to play first, then the newest. */
export function sortJousts(jousts: readonly JoustSummary[]): JoustSummary[] {
  const rank = (joust: JoustSummary) =>
    joust.state === "play" ? 0 : joust.state === "waiting" ? 1 : 2;
  return [...jousts].sort(
    (a, b) => rank(a) - rank(b) || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

/**
 * When the question's clock runs out on this device. A question just served starts now, whatever
 * the device's clock says; one served earlier (the page was reloaded) keeps the server's deadline.
 */
export function localDeadline(
  question: { readonly servedAt: string; readonly deadline: string },
  receivedAt: EpochMs,
): EpochMs {
  const servedAt = Date.parse(question.servedAt);
  const deadline = Date.parse(question.deadline);
  const fresh = Math.abs(receivedAt - servedAt) < 5_000;
  return fresh ? receivedAt + (deadline - servedAt) : deadline;
}

/** « Tu as trouvé 4 mots sur 5 en 31 s, et Alix 3 sur 5 en 40 s. » */
export function scoresLine(
  mine: RunScore,
  theirs: RunScore,
  questions: number,
  opponent: PlayerBadge | null,
): string {
  const found = mine.correct > 1 ? "mots" : "mot";
  return `Tu as trouvé ${mine.correct} ${found} sur ${questions} en ${Math.round(mine.ms / 1000)} s, et ${playerName(opponent)} ${scoreText(theirs, questions)}.`;
}

/** Why the joust ended without the second run. */
export function forfeitLine(launched: boolean, opponent: PlayerBadge | null): string {
  return launched
    ? `La joute te revient, car ${playerName(opponent)} n'a pas joué à temps.`
    : "La joute revient à ton adversaire, car tu n'as pas joué à temps.";
}

/** « Tes mots cacochyme et bisbille ont piégé Alix. », or `null` when none did. */
export function trappedLine(words: readonly string[], opponent: PlayerBadge | null): string | null {
  if (words.length === 0) return null;
  const name = playerName(opponent);
  if (words.length === 1) return `Ton mot ${words[0]} a piégé ${name}.`;
  const list = `${words.slice(0, -1).join(", ")} et ${words.at(-1)}`;
  return `Tes mots ${list} ont piégé ${name}.`;
}

export interface RunSize {
  readonly questions: number;
  readonly seconds: number;
  readonly choices: number;
  /** Hours the second player has to play. */
  readonly replyHours: number;
}

/** Questions of a run, seconds to answer each, and choices, as the rules say now. */
export function runSize(now: EpochMs): RunSize {
  const rules = joustRulesAt(JOUST_SCHEDULE, now);
  return {
    questions: rules.drawn,
    seconds: Math.round(rules.answerMs / 1000),
    choices: rules.choices,
    replyHours: Math.round(rules.replyMs / 3_600_000),
  };
}

/** Before the run starts. */
export function runRules(now: EpochMs): string {
  const { questions, seconds } = runSize(now);
  return `Tu as ${seconds} secondes pour chacun des ${questions} mots. Si tu quittes la joute, le chrono continue et les questions restantes comptent fausses.`;
}

// --- The jousts' home, the run's summary and the result's reveal ---------------------------------

export const JOUST = "Jouter";
export const NEW_JOUST = "Nouvelle joute";
export const BACK_TO_JOUSTS = "Retour aux joutes";
export const REVENGE_SHORT = "Revanche";
export const REPLAY_REVEAL = "Revoir";
export const EDIT_DECK_SHORT = "Modifier";
export const COMPOSE_DECK = "Composer mon deck";
export const COMPLETE_DECK = "Compléter pour moi";
export const GUIDE_AGAIN = "Revoir l'accueil guidé";
export const RUN_DONE = "Ta partie est jouée";
export const TRAPS_TITLE = "Tes pièges";
export const SEALED_RESULT = "Résultat à découvrir";
export const OPEN_SEALED = "Touche pour l'ouvrir";
export const JOUSTS_HELP_LABEL = "Comment se joue une joute";
export const DECK_NOT_SAVED =
  "Compose ton deck pour jouter : ce sont tes mots que tes adversaires devront trouver.";

/** The rule in four short lines, behind the « ? » of the jousts' home. */
export function joustHelp(size: RunSize): readonly string[] {
  return [
    `Tu trouves les ${size.questions} mots tirés du deck de l'autre joueur, qui trouve les ${size.questions} du tien.`,
    `${size.seconds} secondes par mot, ${size.choices} choix.`,
    "Le plus de mots trouvés gagne ; à égalité, le plus rapide.",
    "Chaque partie donne des XP, et une victoire un sachet bonus en réserve.",
  ];
}

export interface JoustSections {
  readonly toPlay: readonly JoustSummary[];
  /** Ended, the result not watched yet: shown sealed. */
  readonly toDiscover: readonly JoustSummary[];
  readonly waiting: readonly JoustSummary[];
  readonly ended: readonly JoustSummary[];
}

/** The player's jousts by section, the newest first in each. */
export function joustSections(jousts: readonly JoustSummary[]): JoustSections {
  const newest = [...jousts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return {
    toPlay: newest.filter((joust) => joust.state === "play"),
    toDiscover: newest.filter((joust) => joust.state === "ended" && !joust.seen),
    waiting: newest.filter((joust) => joust.state === "waiting"),
    ended: newest.filter((joust) => joust.state === "ended" && joust.seen),
  };
}

const kindWord = (joust: JoustSummary) => (joust.kind === "ranked" ? "Classée" : "Amicale");

/** The short line of a joust in its section: « Classée · avant demain 9 h 05 ». */
export function joustRowState(joust: JoustSummary, now: EpochMs, timeZone?: string): string {
  switch (joust.state) {
    case "play":
      return joust.launched || joust.replyBy === null
        ? `${kindWord(joust)} · à toi de jouer`
        : `${kindWord(joust)} · avant ${deadlineText(joust.replyBy, now, timeZone)}`;
    case "waiting":
      return joust.replyBy === null
        ? `${kindWord(joust)} · en train de jouer`
        : `${kindWord(joust)} · jusqu'à ${deadlineText(joust.replyBy, now, timeZone)}`;
    case "ended":
      if (joust.forfeit) return `${kindWord(joust)} · forfait`;
      return joust.seen && joust.mine !== null && joust.theirs !== null
        ? `${kindWord(joust)} · ${joust.mine.correct} à ${joust.theirs.correct}`
        : kindWord(joust);
  }
}

/** The word of the banner, and of an ended joust in the list. */
export function outcomeWord(outcome: JoustSummary["outcome"], banner = false): string {
  switch (outcome) {
    case "won":
      return banner ? "Victoire !" : "Victoire";
    case "lost":
      return "Défaite";
    default:
      return "Égalité";
  }
}

/** Under the run's summary: « Alix a jusqu'à demain 17 h 20. On te prévient au courrier. » */
export function waitingLine(
  opponent: PlayerBadge | null,
  replyBy: string | null,
  now: EpochMs,
  timeZone?: string,
): string {
  const name = playerName(opponent);
  return replyBy === null
    ? `${name} va jouer sa partie. On te prévient au courrier.`
    : `${name} a jusqu'à ${deadlineText(replyBy, now, timeZone)}. On te prévient au courrier.`;
}

/** « Les 5 mots de ton deck que Alix devra trouver. » */
export function trapsLine(count: number, opponent: PlayerBadge | null): string {
  const name = playerName(opponent);
  return count === 1
    ? `Le mot de ton deck que ${name} devra trouver.`
    : `Les ${count} mots de ton deck que ${name} devra trouver.`;
}

/** The time of an answer on the summary and the board: « 4,2 s », or « manqué ». */
export function answerTimeText(answer: { readonly correct: boolean; readonly ms: number }) {
  if (!answer.correct) return "manqué";
  return `${(Math.round(answer.ms / 100) / 10).toLocaleString("fr-FR")} s`;
}

/** « 31 s », the total time of a run. */
export function runSeconds(answers: readonly { readonly ms: number }[]): string {
  return `${Math.round(answers.reduce((total, answer) => total + answer.ms, 0) / 1000)} s`;
}

export function xpGainText(xp: number): string {
  return `+${xp} XP`;
}

export function sachetGainText(boosters: number): string {
  return `+${plural(boosters, "sachet", "sachets")}`;
}

/** The words of the player's deck the other player missed, for the reveal's last line. */
export function trappingWords(
  theirs: readonly { readonly cardId: string; readonly correct: boolean }[],
  wordOf: (cardId: string) => string,
): string[] {
  return theirs.filter((answer) => !answer.correct).map((answer) => wordOf(answer.cardId));
}

/**
 * Fills the deck's empty places with the rarest cards that still fit its budget, as the game's own
 * deck does; ties go by card id, so the same cards give the same deck.
 */
export function completeDeck(
  deck: readonly string[],
  candidates: readonly { readonly cardId: string; readonly cost: number }[],
  limits: { readonly size: number; readonly budget: number },
): readonly string[] {
  const costs = new Map(candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  let spent = deck.reduce((total, id) => total + (costs.get(id) ?? 0), 0);
  const next = [...deck];
  const byRarity = [...candidates].sort(
    (a, b) => b.cost - a.cost || a.cardId.localeCompare(b.cardId),
  );
  for (const candidate of byRarity) {
    if (next.length >= limits.size) break;
    if (next.includes(candidate.cardId) || spent + candidate.cost > limits.budget) continue;
    next.push(candidate.cardId);
    spent += candidate.cost;
  }
  return next;
}
