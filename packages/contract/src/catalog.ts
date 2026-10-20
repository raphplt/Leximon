import { z } from "zod";
import { raritySchema } from "./boosters";
import { slugSchema, timestampSchema } from "./common";

/**
 * Published catalogue (D-023): a manifest listing the collections, and one immutable file per
 * collection, named after the hash of its content. Written by the content pipeline, validated
 * again by `catalog:publish`, read by the apps. Changes must stay additive: old app versions
 * keep reading new files.
 */

export const CATALOG_SCHEMA_VERSION = 1;

export const catalogQuoteSchema = z.object({
  text: z.string().min(1),
  author: z.string().min(1),
});

/**
 * A path relative to the catalogue root, in `gravures/`: one segment, no way out of the folder,
 * nothing a CSS `url()` would need to escape. Kept loose on the name itself so that a later
 * naming (another size) never makes an old client reject the whole collection.
 */
const engravingFileSchema = z.string().regex(/^gravures\/[a-z0-9][a-z0-9.-]*\.webp$/);

/**
 * Engraving of a card (docs/rnd/gravures.md): two WebP files holding only an alpha channel,
 * tinted by the card at display time. Files are named after their content, so immutable.
 */
export const catalogEngravingSchema = z.object({
  /** The lines: `gravures/<card>.<hash12>.ink.webp`. */
  ink: engravingFileSchema,
  /** The dark masses as one flat shape, half size: `gravures/<card>.<hash12>.fill.webp`. */
  fill: engravingFileSchema,
  /** Size of the ink file, in px. */
  width: z.int().positive(),
  height: z.int().positive(),
  /**
   * Full credit line, licence included, shown as is:
   * « D'après Albrecht Dürer, 1514 · Wikimedia Commons (domaine public) ».
   */
  credit: z.string().min(1),
  /** The file's page on Wikimedia Commons. */
  sourceUrl: z.url({ protocol: /^https$/ }),
  /** "domaine public", "CC0" or "CC BY 4.0". A plain string: a new licence never breaks old clients. */
  licence: z.string().min(1),
});
export type CatalogEngraving = z.infer<typeof catalogEngravingSchema>;

export const catalogCardSchema = z.object({
  /** Stable slug, never reused (D-020): also the id of the `cards` row. */
  id: slugSchema,
  word: z.string().min(1),
  partOfSpeech: z.string().min(1),
  /** First attestation, e.g. "XIIIe s.". `null` when unknown. */
  era: z.string().min(1).nullable(),
  definition: z.string().min(1),
  etymology: z.string().min(1).nullable(),
  quote: catalogQuoteSchema.nullable(),
  rarity: raritySchema,
  collectionId: slugSchema,
  themes: z.array(slugSchema),
  /** Modern written frequency (Google Books Ngram, D-020). `null` below what Ngram measures. */
  perBillion: z.number().nonnegative().nullable(),
  /**
   * `null` when the card has no engraving yet (it shows its initial). Absent from releases made
   * before engravings, hence optional: read it as `card.engraving ?? null`.
   */
  engraving: catalogEngravingSchema.nullable().exactOptional(),
});
export type CatalogCard = z.infer<typeof catalogCardSchema>;

/** `collections/<id>.<hash>.json` */
export const catalogCollectionFileSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  cards: z.array(catalogCardSchema),
});
export type CatalogCollectionFile = z.infer<typeof catalogCollectionFileSchema>;

export const catalogManifestEntrySchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  cardCount: z.int().nonnegative(),
  /** Path relative to the manifest. Immutable: a new content gets a new name. */
  file: z.string().regex(/^collections\/[a-z0-9-]+\.[0-9a-f]{12}\.json$/),
});

/** `manifest.json`: the only catalogue file with a short cache. */
export const catalogManifestSchema = z.object({
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  /** e.g. "2026-10-19.1". */
  version: z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d+$/),
  releasedAt: timestampSchema,
  collections: z.array(catalogManifestEntrySchema),
});
export type CatalogManifest = z.infer<typeof catalogManifestSchema>;
