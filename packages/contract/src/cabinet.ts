import { z } from "zod";
import { slugSchema } from "./common";

/**
 * The cabinet of a word, which patrons open from a card's sheet: its use in books since 1800,
 * its Littré article and its family. One file per card, written by the content pipeline and
 * named after its content, so cached for good; `cabinet.json` lists them by card.
 */
export const cabinetFileSchema = z
  .string()
  .regex(/^cabinet\/[a-z0-9][a-z0-9-]*\.[0-9a-f]{12}\.json$/);

const citationSchema = z.object({
  text: z.string(),
  /** As the Littré prints it, often shortened (« MOL. »); empty for an anonymous work. */
  author: z.string(),
  reference: z.string(),
});
export type CabinetCitation = z.infer<typeof citationSchema>;

export const cabinetArticleSchema = z.object({
  nature: z.string(),
  senses: z.array(
    z.object({
      number: z.string().nullable(),
      definition: z.string(),
      citations: z.array(citationSchema),
    }),
  ),
  etymology: z.string().nullable(),
  /** The word's oldest uses, by century. */
  history: z.array(z.object({ century: z.int(), citations: z.array(citationSchema) })),
});
export type CabinetArticle = z.infer<typeof cabinetArticleSchema>;

export const cabinetRelationSchema = z.enum(["base", "derived", "sibling"]);
export type CabinetRelation = z.infer<typeof cabinetRelationSchema>;

export const catalogCabinetSchema = z.object({
  word: z.string(),
  /** Occurrences per billion words in each decade from `from`; `null` for an expression. */
  usage: z
    .object({
      from: z.int(),
      step: z.int().positive(),
      perBillion: z.array(z.number().nonnegative()),
    })
    .nullable(),
  articles: z.array(cabinetArticleSchema),
  /**
   * The word it derives from (`base`), the catalogue's words derived from it (`derived`) and from
   * the same word (`sibling`). `cardId` links a word of the catalogue to its card.
   */
  family: z.array(
    z.object({ word: z.string(), cardId: slugSchema.nullable(), relation: cabinetRelationSchema }),
  ),
});
export type CatalogCabinet = z.infer<typeof catalogCabinetSchema>;

/** `cabinet.json`, written by `catalog:publish` beside the manifest: each card's cabinet file. */
export const cabinetIndexSchema = z.object({ cards: z.record(slugSchema, cabinetFileSchema) });
export type CabinetIndex = z.infer<typeof cabinetIndexSchema>;
