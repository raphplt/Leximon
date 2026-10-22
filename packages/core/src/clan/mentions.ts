/**
 * Mentions in the clan's discussion: "@" followed by a member's pseudo. Pure functions: the
 * server finds which keys belong to members of the clan, with the unique index on pseudo keys.
 */

import { pseudoKey } from "../account/pseudo";

/** One way an "@" could name a player. */
export interface MentionCandidate {
  /** Index of the "@" in the message. */
  readonly start: number;
  /** Index just past the name. */
  readonly end: number;
  /** `pseudoKey` of the text after the "@". */
  readonly key: string;
}

/** A mention resolved to a member: the range covers the "@" and the name. */
export interface Mention {
  readonly start: number;
  readonly end: number;
  readonly userId: string;
}

const WORD_CHAR = /^[\p{Script=Latin}\p{Nd}]$/u;
const SEPARATOR = /^[ '._-]$/;

/**
 * Every way each "@" of a message could name a player, shaped like a pseudo: letters and digits
 * with single separators between them, at most `maxLength` characters. "@Jean Paul, salut"
 * gives "Jean" and "Jean Paul". An "@" inside a word, as in an address, names nobody.
 */
export function mentionCandidates(body: string, maxLength: number): MentionCandidate[] {
  const found: MentionCandidate[] = [];
  for (let at = body.indexOf("@"); at !== -1; at = body.indexOf("@", at + 1)) {
    if (isWordCharBefore(body, at)) continue;
    let index = at + 1;
    let length = 0;
    for (;;) {
      const segmentStart = index;
      for (let char = charAt(body, index); char !== null && WORD_CHAR.test(char); ) {
        index += char.length;
        length++;
        char = charAt(body, index);
      }
      if (index === segmentStart || length > maxLength) break;
      found.push({ start: at, end: index, key: pseudoKey(body.slice(at + 1, index)) });
      const separator = charAt(body, index);
      const next = charAt(body, index + 1);
      if (separator === null || !SEPARATOR.test(separator) || next === null) break;
      if (!WORD_CHAR.test(next)) break;
      index += separator.length;
      length++;
    }
  }
  return found;
}

/**
 * Keeps, for each "@", the longest candidate that names a member: with "Jean" and "Jean Paul"
 * in the clan, "@Jean Paul" names the second one.
 */
export function resolveMentions(
  candidates: readonly MentionCandidate[],
  members: ReadonlyMap<string, string>,
): Mention[] {
  const byStart = new Map<number, Mention>();
  for (const candidate of candidates) {
    const userId = members.get(candidate.key);
    if (userId === undefined) continue;
    const kept = byStart.get(candidate.start);
    if (kept === undefined || candidate.end > kept.end) {
      byStart.set(candidate.start, { start: candidate.start, end: candidate.end, userId });
    }
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

function charAt(text: string, index: number): string | null {
  const code = text.codePointAt(index);
  return code === undefined ? null : String.fromCodePoint(code);
}

function isWordCharBefore(text: string, index: number): boolean {
  if (index === 0) return false;
  const before = [...text.slice(Math.max(0, index - 2), index)].at(-1);
  return before !== undefined && WORD_CHAR.test(before);
}
