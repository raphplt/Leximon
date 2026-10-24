import { z } from "zod";

/**
 * Messages of the game events queue. They are hints: the consumer recounts everything from
 * the database, so a message lost, replayed or sent twice changes nothing.
 */
export const gameEventSchema = z.discriminatedUnion("type", [
  /**
   * A player got cards (booster, trade, card choice): their clan's goal, library and journal (new
   * Legendaries) move.
   */
  z.object({ type: z.literal("cards_obtained"), userId: z.string().min(1) }),
  /** A player answered a challenge right: their clan's weekly goal and level move. */
  z.object({ type: z.literal("answer_given"), userId: z.string().min(1) }),
  /** Members came or went: the library is recounted. */
  z.object({ type: z.literal("clan_changed"), clanId: z.uuid() }),
  /** A library recount put off because the last one was too recent: it is due now. */
  z.object({ type: z.literal("library_due"), clanId: z.uuid() }),
  /** An offer was made or answered: the mail of the player who waits for it gets a letter. */
  z.object({ type: z.literal("trade_changed"), tradeId: z.uuid() }),
  /** A message named members: each one gets a letter. */
  z.object({ type: z.literal("clan_mentions"), messageId: z.int().positive() }),
  /** A player asked to enter a clan: its chief and deputies get a letter. */
  z.object({ type: z.literal("clan_request"), clanId: z.uuid(), userId: z.string().min(1) }),
  /** A player passed a level: their friends' feed, and the reward of the player who invited them. */
  z.object({ type: z.literal("level_up"), userId: z.string().min(1) }),
  /** A friend request was sent: the recipient gets a letter while it waits. */
  z.object({
    type: z.literal("friend_request"),
    senderId: z.string().min(1),
    recipientId: z.string().min(1),
  }),
  /** A request was accepted, or a friend link made friends: the other player gets a letter. */
  z.object({
    type: z.literal("friend_accepted"),
    userId: z.string().min(1),
    friendId: z.string().min(1),
  }),
  /** A friend reacted to a feed event: its author gets a letter. */
  z.object({ type: z.literal("friend_reaction"), eventId: z.int().positive() }),
]);
export type GameEvent = z.infer<typeof gameEventSchema>;
