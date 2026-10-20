import type { CatalogCard } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { pickShowcase } from "./showcase-cards";

describe("pickShowcase", () => {
  it("keeps the given order and skips cards missing from the catalogue", () => {
    const card = (id: string) => ({ id }) as CatalogCard;
    const cardsById = new Map([
      ["a", card("a")],
      ["c", card("c")],
    ]);
    expect(pickShowcase(cardsById, ["c", "b", "a"]).map((found) => found.id)).toEqual(["c", "a"]);
  });
});
