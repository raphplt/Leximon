import type { MetadataRoute } from "next";

const SITE = "https://leximon.fr";

/** The pages open to search engines; every other page is behind sign-in or kept out of the index. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/charte", "/conditions", "/confidentialite", "/mentions"].map((path) => ({
    url: `${SITE}${path === "/" ? "" : path}`,
  }));
}
