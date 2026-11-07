import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";
import { playerBadgeSchema } from "./profile";

/** Where a wished word was met. */
export const wishSourceSchema = z.enum(["joust"]);

export const wishSchema = z.object({
  cardId: slugSchema,
  source: wishSourceSchema,
  seenAt: timestampSchema,
});
export type Wish = z.infer<typeof wishSchema>;

/** `GET /me/wishes`: the words the player looks for, still not owned, most recent first. */
export const wishesResponseSchema = z.object({ wishes: z.array(wishSchema) });
export type WishesResponse = z.infer<typeof wishesResponseSchema>;

/**
 * `GET /me/wish-seekers`: players who look for words the player can trade, with only those
 * words: never the rest of what they miss.
 */
export const wishSeekersResponseSchema = z.object({
  players: z.array(z.object({ player: playerBadgeSchema, cardIds: z.array(slugSchema) })),
});
export type WishSeekersResponse = z.infer<typeof wishSeekersResponseSchema>;
