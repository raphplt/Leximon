import { z } from "zod";

/** Account level (P48). The level is derived from the XP by the server; clients only show it. */
export const progressSchema = z.object({
  /** Total experience earned. */
  xp: z.int().nonnegative(),
  level: z.int().positive(),
  /** XP earned since the current level was reached. */
  xpIntoLevel: z.int().nonnegative(),
  /** XP the current level takes in all, up to the next one. */
  xpForNextLevel: z.int().positive(),
});
export type Progress = z.infer<typeof progressSchema>;

/** `GET /me/progress`, 200. */
export const progressResponseSchema = progressSchema;
export type ProgressResponse = Progress;

/** Progress after an action, with what this action earned (0 when a retry replays it). */
export const progressGainSchema = progressSchema.extend({
  xpGained: z.int().nonnegative(),
  /** The action raised the level: the client celebrates it. */
  levelUp: z.boolean(),
});
export type ProgressGain = z.infer<typeof progressGainSchema>;
