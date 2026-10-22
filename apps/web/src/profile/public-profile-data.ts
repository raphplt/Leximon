import { type PublicProfile, publicProfileSchema } from "@leximon/contract";
import { cacheLife } from "next/cache";

// Server side: the API's address inside the hosting, else the public one.
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/**
 * A public profile as anyone sees it, for the page, its title and its shared image: read
 * without a session, so the same copy serves every visitor for a minute, like the API's own cache.
 * `null` when there is none to show (unknown pseudo, profile below the public level).
 */
export async function readPublicProfile(pseudo: string): Promise<PublicProfile | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  const response = await fetch(`${API_URL}/players/${encodeURIComponent(pseudo)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Profile unavailable (${response.status})`);
  const profile = publicProfileSchema.safeParse(await response.json());
  if (!profile.success) throw new Error("Unexpected profile response");
  return profile.data;
}
