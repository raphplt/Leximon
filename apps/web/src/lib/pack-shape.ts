import { PACK_SHAPES, type PackShape } from "@leximon/view-model";

/** A shape asked for in the address (`?paquet=sachet`), to try it; `null` if none. */
export function packShapeFromSearch(search: string): PackShape | null {
  const asked = new URLSearchParams(search).get("paquet");
  return PACK_SHAPES.find((shape) => shape === asked) ?? null;
}
