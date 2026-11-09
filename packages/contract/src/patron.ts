import { PATRON_PLANS } from "@leximon/core";
import { z } from "zod";
import { timestampSchema } from "./common";
import { patronFindsSchema } from "./reserve";

export const patronPlanSchema = z.enum(PATRON_PLANS);
export type PatronPlan = z.infer<typeof patronPlanSchema>;

/** The mark on a profile: a founder keeps it for life, a patron while subscribed. */
export const patronMarkSchema = z.enum(["founder", "patron"]).nullable().default(null);
export type PatronMarkView = z.infer<typeof patronMarkSchema>;

/** A cosmetic of the patron calendar: a frame, an engraved avatar or a title. */
export const patronCosmeticSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("frame"), frame: z.string().min(1) }),
  z.object({ kind: z.literal("avatar"), avatar: z.string().min(1) }),
  z.object({ kind: z.literal("title"), title: z.string().min(1) }),
]);
export type PatronCosmeticView = z.infer<typeof patronCosmeticSchema>;

/** A month of the calendar (in Paris, `YYYY-MM`) and its cosmetic. */
export const monthCosmeticSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  /** A matching pair, claimed together. */
  cosmetics: z.array(patronCosmeticSchema).min(1).readonly(),
});
export type MonthCosmeticView = z.infer<typeof monthCosmeticSchema>;

/**
 * Whether the subscription can be bought: `closed` before sales open (admins may still buy, to
 * try the real payment), `open` after, `unavailable` when payments are not configured.
 */
export const patronSalesSchema = z.enum(["closed", "open", "unavailable"]);
export type PatronSales = z.infer<typeof patronSalesSchema>;

/**
 * `GET /me/patron`, 200. `subscription` is `null` for a player who never subscribed.
 * - `standing`: `patron` (paid and subscribed), `none` otherwise;
 * - `cancelAt`: when a subscription cancelled by the player stops, `null` while it renews;
 * - `paymentFailing`: the latest payment failed and Stripe is retrying it.
 */
const pollThemeViewSchema = z.object({ name: z.string(), description: z.string() });

/**
 * The patrons' vote on the theme of a coming collection: the one open, or the last one closed
 * for a month after. Voices show only once it closes.
 */
export const patronPollSchema = z.object({
  id: z.uuid(),
  themes: z.array(pollThemeViewSchema),
  closesAt: timestampSchema,
  open: z.boolean(),
  /** The patron's choice, as an index of `themes`. */
  myVote: z.int().nonnegative().nullable(),
  /** Once closed: voices by theme, and the theme chosen (`null` on a tie or without a voice). */
  result: z
    .object({
      votes: z.array(z.int().nonnegative()),
      winner: z.int().nonnegative().nullable(),
    })
    .nullable(),
});
export type PatronPollView = z.infer<typeof patronPollSchema>;

export const patronResponseSchema = z.object({
  sales: patronSalesSchema,
  /** Declared 15 to 17 years old: the page asks for a parent's agreement. */
  minor: z.boolean(),
  mark: patronMarkSchema,
  /** The cosmetic of the current month, shown to everyone; `null` for a month without one. */
  monthCosmetic: monthCosmeticSchema.nullable(),
  /** Cosmetics of the months paid for, not claimed yet, oldest first. */
  claimable: z.array(monthCosmeticSchema),
  canBuy: z.boolean(),
  founder: z.boolean(),
  /** Within the founding month: a first payment now makes a founder. */
  foundingOffer: z.boolean().default(false),
  finds: patronFindsSchema,
  /** On the public page of thanks while paying, unless the patron asked not to be. */
  thanksListed: z.boolean().default(true),
  /**
   * What still keeps a listed patron off the page: a level below the one from which profiles are
   * public, a profile set private, or no pseudo chosen. `null` once nothing does.
   */
  thanksWaiting: z
    .object({ reason: z.enum(["level", "private", "pseudo"]), level: z.int().positive() })
    .nullable()
    .default(null),
  poll: patronPollSchema.nullable().default(null),
  /**
   * The patrons' Discord: `available` once the bot is set on the server, `username` the account
   * linked, if any.
   */
  discord: z
    .object({ available: z.boolean(), username: z.string().nullable() })
    .default({ available: false, username: null }),
  subscription: z
    .object({
      standing: z.enum(["none", "patron"]),
      plan: patronPlanSchema.nullable(),
      currentPeriodEnd: timestampSchema.nullable(),
      cancelAt: timestampSchema.nullable(),
      paymentFailing: z.boolean(),
      since: timestampSchema.nullable(),
    })
    .nullable(),
});
export type PatronResponse = z.infer<typeof patronResponseSchema>;

/** `PUT /me/patron/thanks` body: whether the patron's pseudo shows on the page of thanks. */
export const patronThanksChoiceSchema = z.object({ listed: z.boolean() });
export type PatronThanksChoice = z.infer<typeof patronThanksChoiceSchema>;

/**
 * `GET /patrons`, 200, readable without an account: the patrons thanked on the public page,
 * founders first, then by the date of their first payment. Only paying patrons with a public
 * profile who did not ask to stay off it.
 */
export const patronThanksResponseSchema = z.object({
  patrons: z.array(z.object({ pseudo: z.string(), founder: z.boolean() })),
});
export type PatronThanksResponse = z.infer<typeof patronThanksResponseSchema>;

/**
 * `POST /me/patron/checkout` request body. `waiverAccepted` is the box giving up the right of
 * withdrawal: the law asks for it before a digital service starts at once.
 */
export const patronCheckoutRequestSchema = z.object({
  plan: patronPlanSchema,
  waiverAccepted: z.literal(true),
});
export type PatronCheckoutRequest = z.infer<typeof patronCheckoutRequestSchema>;

/** `POST /me/patron/checkout` and `POST /me/patron/portal`, 200: the Stripe page to go to. */
export const patronRedirectResponseSchema = z.object({ url: z.url() });
export type PatronRedirectResponse = z.infer<typeof patronRedirectResponseSchema>;

/**
 * `POST /me/patron/checkout`, 409: sales are closed, the player is a guest, or already
 * subscribed. `POST /me/patron/portal`, 409: the player never subscribed.
 */
export const patronRefusalSchema = z.object({
  error: z.enum(["sales_closed", "guest", "already_patron", "not_subscribed"]),
});
export type PatronRefusal = z.infer<typeof patronRefusalSchema>["error"];

/** `POST /me/patron/cosmetics/:month/claim`, 200: the month's cosmetics, now in the wardrobe. */
export const patronClaimResponseSchema = z.object({
  cosmetics: z.array(patronCosmeticSchema).readonly(),
});
export type PatronClaimResponse = z.infer<typeof patronClaimResponseSchema>;

/** `POST /me/patron/cosmetics/:month/claim`, 409: the month was not paid for, or is claimed. */
export const patronClaimRefusalSchema = z.object({ error: z.enum(["nothing_to_claim"]) });
export type PatronClaimRefusal = z.infer<typeof patronClaimRefusalSchema>["error"];

// --- Back office -------------------------------------------------------------------------------

/** `GET /admin/patrons?cursor=`: subscribers, the latest change first. */
export const adminPatronsQuerySchema = z.object({ cursor: z.string().max(200).optional() });

export const adminPatronSchema = z.object({
  userId: z.string(),
  email: z.string(),
  pseudo: z.string().nullable(),
  playerCode: z.string().nullable(),
  standing: z.enum(["none", "patron"]),
  plan: patronPlanSchema.nullable(),
  since: timestampSchema.nullable(),
  currentPeriodEnd: timestampSchema.nullable(),
  cancelAt: timestampSchema.nullable(),
  paymentFailing: z.boolean(),
  founder: z.boolean(),
  /** The latest payment; `null` before the first one. */
  lastPayment: z
    .object({
      invoiceId: z.string(),
      /** In cents of euro. */
      amount: z.int().positive(),
      paidAt: timestampSchema,
      refunded: z.boolean(),
    })
    .nullable(),
});
export type AdminPatron = z.infer<typeof adminPatronSchema>;

/** `monthlyRevenue`: what the current subscribers pay a month, a yearly plan counting for 1/12. */
export const adminPatronsResponseSchema = z.object({
  sales: patronSalesSchema,
  counts: z.object({
    patrons: z.int().nonnegative(),
    cancelling: z.int().nonnegative(),
    failing: z.int().nonnegative(),
    founders: z.int().nonnegative(),
  }),
  /** In cents of euro. */
  monthlyRevenue: z.int().nonnegative(),
  patrons: z.array(adminPatronSchema),
  nextCursor: z.string().nullable(),
});
export type AdminPatronsResponse = z.infer<typeof adminPatronsResponseSchema>;

/**
 * `POST /admin/patrons/:userId/refund`, 200: the subscription stops at once and its latest
 * payment, if any, is refunded. `refunded` is 0 when nothing had been paid.
 */
export const adminPatronRefundResponseSchema = z.object({
  /** In cents of euro. */
  refunded: z.int().nonnegative(),
});
export type AdminPatronRefundResponse = z.infer<typeof adminPatronRefundResponseSchema>;

/** `POST /admin/patrons/:userId/refund`, 409: the player never subscribed. */
export const adminPatronRefundRefusalSchema = z.object({ error: z.enum(["not_subscribed"]) });
export type AdminPatronRefundRefusal = z.infer<typeof adminPatronRefundRefusalSchema>["error"];

/** `POST /me/patron/discord/link` body: back to the app (`leximon://`) or to the web page. */
export const discordLinkRequestSchema = z.object({ app: z.boolean().default(false) });

/** Refusals of a Discord link, as `{ error }` with 409: not a paying patron, or no bot set. */
export const discordLinkRefusalSchema = z.object({
  error: z.enum(["not_patron", "discord_unavailable"]),
});
export type DiscordLinkRefusal = z.infer<typeof discordLinkRefusalSchema>["error"];

/** Where Discord's page sends the player back: `?discord=linked`, or `?discord=failed`. */
export const DISCORD_RETURN_QUERY = "discord";

/**
 * Where Stripe's portal sends the player back: the page then asks `POST /me/patron/refresh`
 * (200, the same body as `GET /me/patron`) to read the subscription again from Stripe.
 */
export const PATRON_PORTAL_RETURN_QUERY = "abonnement";

/** `PUT /me/patron/polls/:pollId/vote` body: the theme chosen, as an index. */
export const patronVoteRequestSchema = z.object({ theme: z.int().nonnegative() });

/** Refusals of a vote, as `{ error }` with 409: not a paying patron, a vote closed, no such theme. */
export const patronVoteRefusalSchema = z.object({
  error: z.enum(["not_patron", "poll_closed", "unknown_theme"]),
});
export type PatronVoteRefusal = z.infer<typeof patronVoteRefusalSchema>["error"];

/** A theme an admin offers to the vote. */
export const pollThemeSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().min(10).max(200),
});

/** `POST /admin/patrons/polls` body: the themes of a new vote, which opens at once. */
export const adminPollCreateSchema = z.object({ themes: z.array(pollThemeSchema).min(2).max(5) });
export type AdminPollCreate = z.infer<typeof adminPollCreateSchema>;

/** Refusals, as `{ error }` with 409: a vote still open, or not the number of themes the rules set. */
export const adminPollRefusalSchema = z.object({ error: z.enum(["poll_open", "theme_count"]) });
export type AdminPollRefusal = z.infer<typeof adminPollRefusalSchema>["error"];

/** `GET /admin/patrons/polls`, 200: the votes, latest first, with their voices while open too. */
export const adminPollsResponseSchema = z.object({
  polls: z.array(
    z.object({
      id: z.uuid(),
      themes: z.array(pollThemeViewSchema),
      opensAt: timestampSchema,
      closesAt: timestampSchema,
      votes: z.array(z.int().nonnegative()),
    }),
  ),
});
export type AdminPollsResponse = z.infer<typeof adminPollsResponseSchema>;
