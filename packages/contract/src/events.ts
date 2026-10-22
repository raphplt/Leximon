import { z } from "zod";

/**
 * Messages of the game events queue (D-038). They are hints: the consumer recounts everything from
 * the database, so a message lost, replayed or sent twice changes nothing.
 */
export const gameEventSchema = z.discriminatedUnion("type", [
  /**
   * A player got cards (booster, trade, card choice): their clan's goal, library and journal (new
   * Legendaries) move.
   */
  z.object({ type: z.literal("cards_obtained"), userId: z.string().min(1) }),
  /** Members came or went: the library is recounted. */
  z.object({ type: z.literal("clan_changed"), clanId: z.uuid() }),
]);
export type GameEvent = z.infer<typeof gameEventSchema>;
