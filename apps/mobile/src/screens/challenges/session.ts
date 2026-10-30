import type { AnsweredQuestion, SessionQuestion } from "@leximon/view-model";

/** `chosen`: the card picked, or the word typed. */
export type Step =
  | { readonly name: "asking" }
  | { readonly name: "sending"; readonly chosen: string }
  | { readonly name: "answered"; readonly chosen: string; readonly slip: boolean }
  | { readonly name: "recap" };

export interface Session {
  readonly questions: readonly SessionQuestion[];
  readonly answers: readonly AnsweredQuestion[];
  readonly index: number;
  readonly step: Step;
  /** A series on a scope the player picked, not the daily challenge. */
  readonly practice: boolean;
}

export function startSession(questions: readonly SessionQuestion[], practice = false): Session {
  return { questions, answers: [], index: 0, step: { name: "asking" }, practice };
}

/** The next question, or the recap after the last one. */
export function advance(session: Session): Session {
  return session.index + 1 < session.questions.length
    ? { ...session, index: session.index + 1, step: { name: "asking" } }
    : { ...session, step: { name: "recap" } };
}
