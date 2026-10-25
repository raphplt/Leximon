import type { ChallengeQuestion } from "@leximon/contract";
import type { AnsweredQuestion } from "@leximon/view-model";

/** `chosen`: the card picked, or the word typed. */
export type Step =
  | { readonly name: "asking" }
  | { readonly name: "sending"; readonly chosen: string }
  | { readonly name: "answered"; readonly chosen: string; readonly slip: boolean }
  | { readonly name: "recap" };

export interface Session {
  readonly questions: readonly ChallengeQuestion[];
  readonly answers: readonly AnsweredQuestion[];
  readonly index: number;
  readonly step: Step;
}

export function startSession(questions: readonly ChallengeQuestion[]): Session {
  return { questions, answers: [], index: 0, step: { name: "asking" } };
}

/** The next question, or the recap after the last one. */
export function advance(session: Session): Session {
  return session.index + 1 < session.questions.length
    ? { ...session, index: session.index + 1, step: { name: "asking" } }
    : { ...session, step: { name: "recap" } };
}
