import type { MetadataRoute } from "next";
import { readCatalogCardIds } from "@/cards/catalog-server";

const SITE = "https://leximon.fr";

// Read from the published catalogue at request time: at build, the server has no catalogue to read.
export const dynamic = "force-dynamic";

/** The pages open to search engines; every other page is behind sign-in or kept out of the index. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/charte", "/conditions", "/confidentialite", "/mentions"];
  const cards = (await readCatalogCardIds()).map((id) => `/carte/${id}`);
  return [...pages, ...cards].map((path) => ({ url: `${SITE}${path}` }));
}
