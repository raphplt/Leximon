import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";
import { referralRewardSchema } from "./friends";
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
  /**
   * A friend request received (`pending` while it waits for an answer), a request accepted, a
   * player arrived by the friend link, an invited player who reached the referral level.
   */
  z.object({
    kind: z.enum(["friend_request", "friend_accepted", "referral_arrived", "referral_qualified"]),
    ...letterBase,
    pending: z.boolean(),
  }),
  /** Friends reacted to one of the player's feed events; `reactions` counts them now. */
  z.object({
    kind: z.literal("friend_reaction"),
    ...letterBase,
    eventId: z.int().positive(),
    reactions: z.int().nonnegative(),
  }),
  /** A joust to play, launched by the other player; the joust to answer, or ended. */
  z.object({
    kind: z.enum(["joust_received", "joust_ended"]),
    ...letterBase,
    joustId: z.uuid(),
  }),
  /** A word the patron found: published with its collection, or set aside by the quality check. */
  z.object({
    kind: z.enum(["word_published", "word_rejected"]),
    ...letterBase,
    wordId: slugSchema,
    word: z.string(),
  }),
]);
export type MailLetter = z.infer<typeof mailLetterSchema>;
export type MailKind = MailLetter["kind"];

/** `GET /me/mail` query: `before` pages back from the oldest letter received. */
export const mailQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
});

/** `GET /me/mail`: newest first. */
export const mailResponseSchema = z.object({
  /** A letter of a kind this version does not know is left out: a newer server never breaks it. */
  letters: z.array(z.unknown()).transform((letters) =>
    letters.flatMap((letter) => {
      const known = mailLetterSchema.safeParse(letter);
      return known.success ? [known.data] : [];
    }),
  ),
  /** Letters not read yet, all pages together. */
  unread: z.int().nonnegative(),
  /**
   * Words owned whose review is due, slipping away: the most overdue one, and how many others.
   * `null` when none is due.
   */
  slipping: z.object({ cardId: slugSchema, others: z.int().nonnegative() }).nullable(),
  hasMore: z.boolean(),
  /** Bonus boosters of friend links waiting to be claimed, oldest first. */
  referralRewards: z.array(referralRewardSchema),
});
export type MailResponse = z.infer<typeof mailResponseSchema>;

/** `POST /me/mail/read` body: every letter up to this one is read. */
export const markMailReadRequestSchema = z.object({ upTo: z.int().positive() });

export const markMailReadResponseSchema = z.object({ unread: z.int().nonnegative() });
export type MarkMailReadResponse = z.infer<typeof markMailReadResponseSchema>;
