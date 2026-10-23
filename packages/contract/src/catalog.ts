import { z } from "zod";
import { raritySchema } from "./boosters";
import { slugSchema, timestampSchema } from "./common";

/**
 * Published catalogue: a manifest listing the collections, and one immutable file per
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

/**
 * Engraving of a collection's seal, chosen by hand: its ink only, drawn in one colour in a round
 * (`gravures/collection-<id>.<hash12>.ink.webp`).
 */
export const catalogSealEngravingSchema = catalogEngravingSchema.omit({ fill: true });
export type CatalogSealEngraving = z.infer<typeof catalogSealEngravingSchema>;

/** `prononciation/<card>.<hash12>.mp3`: one segment, named after its content, so immutable. */
const pronunciationFileSchema = z.string().regex(/^prononciation\/[a-z0-9][a-z0-9.-]*\.mp3$/);

/**
 * Spoken word of a card: one synthetic voice reads every word, guided by a checked
 * phonetic notation. No credit to show: the voice is generated, not recorded.
 */
export const catalogPronunciationSchema = z.object({
  /** Phonetic notation (IPA) the voice read, e.g. "kɔʁɔɡʁaf". */
  ipa: z.string().min(1),
  /** MP3 file, relative to the catalogue root. */
  audio: pronunciationFileSchema,
});
export type CatalogPronunciation = z.infer<typeof catalogPronunciationSchema>;

export const catalogCardSchema = z.object({
  /** Stable slug, never reused: also the id of the `cards` row. */
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
  /** Modern written frequency (Google Books Ngram). `null` below what Ngram measures. */
  perBillion: z.number().nonnegative().nullable(),
  /**
   * `null` when the card has no engraving yet (it shows its initial). Absent from releases made
   * before engravings, hence optional: read it as `card.engraving ?? null`.
   */
  engraving: catalogEngravingSchema.nullable().exactOptional(),
  /**
   * `null` while the word has no settled notation (the card stays silent). Absent from releases
   * made before pronunciations, hence optional: read it as `card.pronunciation ?? null`.
   */
  pronunciation: catalogPronunciationSchema.nullable().exactOptional(),
});
export type CatalogCard = z.infer<typeof catalogCardSchema>;

/** `collections/<id>.<hash>.json` */
export const catalogCollectionFileSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  /**
   * Tone of the card back for this collection's packs, a name of `backTones` in @leximon/tokens.
   * A plain string: a new tone never breaks old clients, which show night for a name they lack.
   * Absent from releases made before it.
   */
  back: z.string().min(1).exactOptional(),
  /** The engraving of its seal. Absent from releases made before it, and while none is chosen. */
  engraving: catalogSealEngravingSchema.exactOptional(),
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

/** e.g. "2026-10-19.1". */
const catalogVersionSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d+$/);

/** `manifest.json`: the only catalogue file with a short cache, with `engravings.json`. */
export const catalogManifestSchema = z.object({
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  version: catalogVersionSchema,
  releasedAt: timestampSchema,
  collections: z.array(catalogManifestEntrySchema),
});
export type CatalogManifest = z.infer<typeof catalogManifestSchema>;

/**
 * `engravings.json`, written by `catalog:publish` beside the manifest and cached as briefly: the
 * ink of every engraved card, by card id. Enough to draw an avatar or an emblem without reading
 * the collections.
 */
export const catalogEngravingIndexSchema = z.object({
  version: catalogVersionSchema,
  inks: z.record(slugSchema, engravingFileSchema),
});
export type CatalogEngravingIndex = z.infer<typeof catalogEngravingIndexSchema>;
