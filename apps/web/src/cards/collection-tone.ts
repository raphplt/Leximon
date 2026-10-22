/** Tone of each launch collection's progress bar (album, clan library). */
const TONES: Readonly<Record<string, string>> = {
  fondateurs: "#7C9BFF",
  caracteres: "#FF8462",
  metiers: "#3BD3A5",
};

export function collectionTone(collectionId: string): string {
  return TONES[collectionId] ?? "var(--lx-color-accent)";
}
