import { DrizzleQueryError } from "drizzle-orm";

/** What an error log may carry. */
export interface ErrorSummary {
  readonly name: string;
  readonly message: string;
  /** Postgres SQLSTATE of a failed query, when there is one. */
  readonly code: string | null;
  /** First stack frames, without the message line. */
  readonly at: string | null;
}

const MAX_MESSAGE = 300;
const STACK_FRAMES = 4;

/**
 * Summary of an error that is safe to log. A failed query's message carries its parameters
 * (addresses, chat messages, ids): for those only the SQL text is kept, whose values are
 * placeholders.
 */
export function errorSummary(error: unknown): ErrorSummary {
  if (!(error instanceof Error)) {
    return { name: typeof error, message: "", code: null, at: null };
  }
  const query = findQueryError(error);
  const code = postgresCode(error);
  return {
    name: query === null ? error.name : "DrizzleQueryError",
    message: safeMessage(error, query, code).slice(0, MAX_MESSAGE),
    code,
    at: stackFrames(error),
  };
}

function safeMessage(error: Error, query: DrizzleQueryError | null, code: string | null): string {
  if (query !== null) return `Failed query: ${query.query}`;
  // Postgres quotes the offending value in some messages ("invalid input syntax…: \"…\"").
  if (code !== null) return "";
  return error.message;
}

function findQueryError(error: Error): DrizzleQueryError | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if (current instanceof DrizzleQueryError) return current;
    current = current.cause;
  }
  return null;
}

function postgresCode(error: Error): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = current.cause;
  }
  return null;
}

function stackFrames(error: Error): string | null {
  if (error.stack === undefined) return null;
  const frames = error.stack
    .split("\n")
    .filter((line) => line.trimStart().startsWith("at "))
    .slice(0, STACK_FRAMES)
    .map((line) => line.trim());
  return frames.length === 0 ? null : frames.join(" | ");
}
