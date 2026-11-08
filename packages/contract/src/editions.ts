import { z } from "zod";
import { slugSchema } from "./common";

/**
 * `GET /me/editions`, 200: the library editions the player owns, the album's and each card's
 * own choice. A card missing from `cards` prints in the album's edition; `null` there prints it
 * ordinary. Read a card's with `cardEditionOf` from `@leximon/core`.
 */
export const editionsResponseSchema = z.object({
  owned: z.array(slugSchema),
  album: slugSchema.nullable(),
  cards: z.record(slugSchema, slugSchema.nullable()),
});
export type EditionsResponse = z.infer<typeof editionsResponseSchema>;

export const EMPTY_EDITIONS: EditionsResponse = { owned: [], album: null, cards: {} };

/** `PUT /me/editions/album` and `PUT /me/editions/cards/:cardId` body; `null` prints ordinary. */
export const editionChoiceSchema = z.object({ edition: slugSchema.nullable() });
export type EditionChoice = z.infer<typeof editionChoiceSchema>;

/** Refusals, as `{ error }` with 403: an edition the player does not own, a card they do not. */
export const editionRefusalSchema = z.object({
  error: z.enum(["edition_not_owned", "card_not_owned"]),
});
export type EditionRefusal = z.infer<typeof editionRefusalSchema>["error"];
