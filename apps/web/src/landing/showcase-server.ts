import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { catalogCollectionFileSchema, catalogManifestSchema } from "@leximon/contract";
import { EMPTY_SHOWCASE, type Showcase, showcaseOf } from "./showcase-cards";

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

/**
 * The home page's cards, read from the catalogue that `catalog:publish` copied into
 * `public/catalog`, when the page is built: the page is static, so its cards come with its HTML
 * and a first visit downloads no collection. Catalogue and site are deployed together, so they
 * always match. Built without a catalogue, the page goes without its cards.
 */
export async function readShowcase(): Promise<Showcase> {
  // Not traced: the catalogue is read when the page is built, never shipped with the server.
  const root = join(/* turbopackIgnore: true */ process.cwd(), "public", "catalog");
  try {
    const manifest = catalogManifestSchema.parse(await readJson(join(root, "manifest.json")));
    const collections = await Promise.all(
      manifest.collections.map(async (entry) =>
        catalogCollectionFileSchema.parse(await readJson(join(root, entry.file))),
      ),
    );
    return showcaseOf(collections);
  } catch (error) {
    console.warn(`Home page without its cards: no valid catalogue in ${root}.`, error);
    return EMPTY_SHOWCASE;
  }
}
