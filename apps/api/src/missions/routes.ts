import {
  type CarnetRefusal,
  type CarnetResponse,
  type ChangeMissionRefusal,
  type ClaimCarnetCaseResponse,
  type ClaimMissionsResponse,
  changeMissionRequestSchema,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  type MissionsResponse,
} from "@leximon/contract";
import { Hono } from "hono";
import { z } from "zod";
import { generateSeed } from "../boosters/seed";
import { claimCarnetCase, readCarnet } from "../carnet/carnet";
import { sendGameEvents } from "../clans/events";
import type { AppEnv } from "../context";
import { refuseLockedWrites } from "../moderation/restrictions";
import { changeDailyMission, claimMissions, readMissions } from "./missions";

const periodParamSchema = z.coerce.number().int().min(-10_000).max(10_000);
const caseParamSchema = z.coerce.number().int().min(1).max(100);

/** The daily missions and the carnet, under `/me` (signed-in player, rate limited). */
export function missionRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/missions", async (c) => {
    return c.json<MissionsResponse>(
      await readMissions(c.var.db, c.var.userId, { now: Date.now(), seed: generateSeed() }),
    );
  });

  routes.post("/missions/change", refuseLockedWrites, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const body = changeMissionRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await changeDailyMission(c.var.db, {
      userId: c.var.userId,
      slot: body.data.slot,
      idempotencyKey: key.data,
      now: Date.now(),
      seed: generateSeed(),
    });
    switch (result.kind) {
      case "invalid_slot":
        return c.json({ error: "invalid_request" }, 400);
      case "refused":
        return c.json<{ error: ChangeMissionRefusal }>({ error: result.reason }, 409);
      case "changed":
        return c.json<MissionsResponse>(
          await readMissions(c.var.db, c.var.userId, { now: Date.now(), seed: generateSeed() }),
        );
    }
  });

  routes.post("/missions/claim", refuseLockedWrites, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const result = await claimMissions(c.var.db, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      now: Date.now(),
    });
    if (result.kind === "guest_archived") return c.json({ error: "guest_archived" }, 409);
    if (result.progress.levelUp) sendGameEvents(c, [{ type: "level_up", userId: c.var.userId }]);
    return c.json<ClaimMissionsResponse>({
      missions: result.missions,
      ecus: result.ecus,
      boosters: result.boosters,
      bonusWaiting: result.bonusWaiting,
      wallet: result.wallet,
      progress: result.progress,
    });
  });

  routes.get("/carnet", async (c) => {
    return c.json<CarnetResponse>(await readCarnet(c.var.db, c.var.userId, Date.now()));
  });

  routes.post("/carnet/:period/:case", refuseLockedWrites, async (c) => {
    const period = periodParamSchema.safeParse(c.req.param("period"));
    const caseNumber = caseParamSchema.safeParse(c.req.param("case"));
    if (!period.success || !caseNumber.success) return c.json({ error: "invalid_request" }, 400);
    const result = await claimCarnetCase(c.var.db, {
      userId: c.var.userId,
      period: period.data,
      case: caseNumber.data,
      now: Date.now(),
    });
    switch (result.kind) {
      case "guest_archived":
        return c.json({ error: "guest_archived" }, 409);
      case "refused":
        return c.json<{ error: CarnetRefusal }>({ error: result.reason }, 409);
      case "claimed":
        return c.json<ClaimCarnetCaseResponse>({
          period: result.period,
          case: result.case,
          rewards: [...result.rewards],
          wallet: result.wallet,
        });
    }
  });

  return routes;
}
