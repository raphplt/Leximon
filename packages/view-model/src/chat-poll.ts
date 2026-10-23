/** First wait after news, growth per quiet poll, and the longest wait of the open discussion. */
const FIRST_MS = 4_000;
const GROWTH = 1.5;
const LONGEST_MS = 25_000;

/**
 * Wait before the open discussion asks again for what came since (no WebSockets): 4 s while it
 * moves, then longer after each poll that brought nothing, up to 25 s. A quiet clan costs about
 * one request every 25 s per open discussion instead of one every 4 s.
 */
export function chatPollDelay(quietPolls: number): number {
  return Math.min(LONGEST_MS, Math.round(FIRST_MS * GROWTH ** Math.max(0, quietPolls)));
}
