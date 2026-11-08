/** The window that asks before a game in progress is left: its title, what leaving costs, its two buttons. */
export interface LeaveWords {
  readonly title: string;
  readonly text: string;
  readonly stay: string;
  readonly leave: string;
}

export const LEAVE_SERIES: LeaveWords = {
  title: "Arrêter la série ?",
  text: "Tes réponses déjà données sont gardées. Les questions qui restent ne seront pas posées.",
  stay: "Continuer la série",
  leave: "Arrêter",
};

export const LEAVE_JOUST: LeaveWords = {
  title: "Quitter la joute ?",
  text: "Le chrono continue sans toi, et chaque question laissée passer compte comme une erreur.",
  stay: "Continuer la joute",
  leave: "Quitter",
};
