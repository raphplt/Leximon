import type { ReviewRequest } from "@leximon/contract";
import type { AnsweredQuestion, SeriesQuestion } from "@leximon/view-model";

/** `chosen`: the card picked, or the word typed. `meeting`: a new word's card, before its question. */
export type Step =
  | { readonly name: "meeting" }
  | { readonly name: "asking" }
  | { readonly name: "sending"; readonly chosen: string }
  | { readonly name: "answered"; readonly chosen: string; readonly slip: boolean }
  | { readonly name: "recap" };

export interface Session {
  readonly questions: readonly SeriesQuestion[];
  readonly answers: readonly AnsweredQuestion[];
  readonly index: number;
  readonly step: Step;
  /** What started it, to start another of the same kind from the recap. */
  readonly request: ReviewRequest;
}

/** A new word shows its card first: the player meets it before being asked. */
function stepFor(question: SeriesQuestion | undefined): Step {
  return question?.fresh === true ? { name: "meeting" } : { name: "asking" };
}

export function startSession(
  questions: readonly SeriesQuestion[],
  request: ReviewRequest,
): Session {
  return { questions, answers: [], index: 0, step: stepFor(questions[0]), request };
}

/** The next question, or the recap after the last one. */
export function advance(session: Session): Session {
  const next = session.questions[session.index + 1];
  return next !== undefined
    ? { ...session, index: session.index + 1, step: stepFor(next) }
    : { ...session, step: { name: "recap" } };
}
