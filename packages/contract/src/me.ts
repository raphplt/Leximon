import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";

/** `GET /me/cards` query string. */
export const ownedCardsQuerySchema = z.object({
  /** Only cards of this collection. */
  collectionId: slugSchema.optional(),
  /** Opaque cursor returned as `nextCursor` by the previous page. */
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type OwnedCardsQuery = z.infer<typeof ownedCardsQuerySchema>;

export const ownedCardSchema = z.object({
  cardId: z.string().min(1),
  variant: z.string().min(1),
  quantity: z.int().positive(),
  firstObtainedAt: timestampSchema,
});

/** `GET /me/cards`, 200. Cards are sorted by `cardId`, then `variant`. */
export const ownedCardsResponseSchema = z.object({
  cards: z.array(ownedCardSchema),
  /** `null` on the last page. */
  nextCursor: z.string().nullable(),
});
export type OwnedCardsResponse = z.infer<typeof ownedCardsResponseSchema>;
