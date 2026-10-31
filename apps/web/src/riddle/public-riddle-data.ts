import { type PublicRiddle, publicRiddleSchema } from "@leximon/contract";

// Server side: the API's address inside the hosting, else the public one.
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/**
 * A riddle's public page, for the page and its title: read without a session, so the same copy
 * serves every visitor for a few minutes, like the API's own cache. `null` when there is none.
 */
export async function readPublicRiddle(number: number): Promise<PublicRiddle | null> {
  const response = await fetch(`${API_URL}/riddles/${number}`, { next: { revalidate: 300 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Riddle unavailable (${response.status})`);
  const riddle = publicRiddleSchema.safeParse(await response.json());
  if (!riddle.success) throw new Error("Unexpected riddle response");
  return riddle.data;
}
