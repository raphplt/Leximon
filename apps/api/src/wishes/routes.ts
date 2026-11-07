import { slugSchema, type WishesResponse, type WishSeekersResponse } from "@leximon/contract";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { readWishes, readWishSeekers, removeWish } from "./wishes";

/** The player's list of wishes and the players who look for their doubles, under `/me`. */
export function wishRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/wishes", async (c) =>
    c.json<WishesResponse>(await readWishes(c.var.db, c.var.userId)),
  );

  routes.delete("/wishes/:cardId", async (c) => {
    const cardId = slugSchema.safeParse(c.req.param("cardId"));
    if (!cardId.success) return c.json({ error: "invalid_request" }, 400);
    await removeWish(c.var.db, c.var.userId, cardId.data);
    return c.body(null, 204);
  });

  routes.get("/wish-seekers", async (c) =>
    c.json<WishSeekersResponse>(await readWishSeekers(c.var.db, c.var.userId, Date.now())),
  );

  return routes;
}
