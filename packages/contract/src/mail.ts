import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";
import { playerBadgeSchema } from "./profile";

const letterBase = {
  id: z.int().positive(),
  /** The other player; `null` once they deleted their account. */
  player: playerBadgeSchema.nullable(),
  read: z.boolean(),
  createdAt: timestampSchema,
};

/** A letter of the mail, news written by the server. Each kind leads to its own screen. */
export const mailLetterSchema = z.discriminatedUnion("kind", [
  /** An offer received, accepted or declined by the other player. */
  z.object({
    kind: z.enum(["offer_received", "offer_completed", "offer_declined"]),
    ...letterBase,
    tradeId: z.uuid(),
  }),
  /** Named in the clan's discussion. `excerpt` is `null` once the message is removed. */
  z.object({
    kind: z.literal("clan_mention"),
    ...letterBase,
    clanId: z.uuid(),
    excerpt: z.string().nullable(),
  }),
  /** A player asks to enter the clan, for its chief and deputies. */
  z.object({ kind: z.literal("clan_request"), ...letterBase, clanId: z.uuid() }),
]);
export type MailLetter = z.infer<typeof mailLetterSchema>;
export type MailKind = MailLetter["kind"];

/** `GET /me/mail` query: `before` pages back from the oldest letter received. */
export const mailQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
});

/** `GET /me/mail`: newest first. */
export const mailResponseSchema = z.object({
  letters: z.array(mailLetterSchema),
  /** Letters not read yet, all pages together. */
  unread: z.int().nonnegative(),
  /**
   * Words owned whose review is due, slipping away: the most overdue one, and how many others.
   * `null` when none is due.
   */
  slipping: z.object({ cardId: slugSchema, others: z.int().nonnegative() }).nullable(),
  hasMore: z.boolean(),
});
export type MailResponse = z.infer<typeof mailResponseSchema>;

/** `POST /me/mail/read` body: every letter up to this one is read. */
export const markMailReadRequestSchema = z.object({ upTo: z.int().positive() });

export const markMailReadResponseSchema = z.object({ unread: z.int().nonnegative() });
export type MarkMailReadResponse = z.infer<typeof markMailReadResponseSchema>;
