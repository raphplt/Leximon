import { z } from "zod";
import { emailSchema } from "./account";
import { timestampSchema } from "./common";

/**
 * E-mail campaigns sent from the back office (D-035), the players' consent to them (P61), and the
 * public unsubscribe flow. Sign-in codes are not campaigns: they live in `account.ts`.
 */

export const CAMPAIGN_AUDIENCES = ["waitlist", "players", "test"] as const;
export const campaignAudienceSchema = z.enum(CAMPAIGN_AUDIENCES);
export type CampaignAudience = z.infer<typeof campaignAudienceSchema>;

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "paused",
  "completed",
  "cancelled",
] as const;
export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

/** Sending rate bounds, per minute. The default suits a domain without history. */
export const CAMPAIGN_RATE = { min: 10, max: 5000, default: 1000 } as const;

/** A test audience stays small: it is for checking rendering in real inboxes. */
export const MAX_TEST_RECIPIENTS = 20;

const httpsUrlSchema = z
  .string()
  .trim()
  .max(500)
  .pipe(z.url({ protocol: /^https$/, hostname: z.regexes.domain }));

const campaignContentFields = {
  subject: z.string().trim().min(1).max(120),
  bodyMarkdown: z.string().trim().min(1).max(10_000),
  buttonLabel: z.string().trim().min(1).max(40).nullable(),
  buttonUrl: httpsUrlSchema.nullable(),
};

const hasWholeButton = (input: { buttonLabel: string | null; buttonUrl: string | null }) =>
  (input.buttonLabel === null) === (input.buttonUrl === null);
const wholeButtonError = { message: "A button needs both a label and a link", path: ["buttonUrl"] };

/** `POST /admin/campaigns/preview` and `/test` body: what the e-mail says, not who gets it. */
export const adminCampaignContentSchema = z
  .object(campaignContentFields)
  .refine(hasWholeButton, wholeButtonError);
export type AdminCampaignContent = z.input<typeof adminCampaignContentSchema>;

/** `POST /admin/campaigns` and `POST /admin/campaigns/:id` body (drafts only). */
export const adminCampaignInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    ...campaignContentFields,
    audience: campaignAudienceSchema,
    testRecipients: z.array(emailSchema).max(MAX_TEST_RECIPIENTS),
    ratePerMinute: z.int().min(CAMPAIGN_RATE.min).max(CAMPAIGN_RATE.max),
  })
  .refine(hasWholeButton, wholeButtonError)
  .refine((input) => input.audience !== "test" || input.testRecipients.length > 0, {
    message: "A test audience needs at least one address",
    path: ["testRecipients"],
  });
export type AdminCampaignInput = z.input<typeof adminCampaignInputSchema>;

/** Where each recipient stands. `waiting` counts rows not yet handed to the provider. */
export const campaignCountsSchema = z.object({
  waiting: z.int().nonnegative(),
  sent: z.int().nonnegative(),
  failed: z.int().nonnegative(),
  bounced: z.int().nonnegative(),
  complained: z.int().nonnegative(),
  suppressed: z.int().nonnegative(),
  cancelled: z.int().nonnegative(),
  unsubscribed: z.int().nonnegative(),
});
export type CampaignCounts = z.infer<typeof campaignCountsSchema>;

export const adminCampaignSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  subject: z.string(),
  audience: campaignAudienceSchema,
  status: campaignStatusSchema,
  recipientCount: z.int().nonnegative().nullable(),
  createdAt: timestampSchema,
  scheduledAt: timestampSchema.nullable(),
  launchedAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable(),
  counts: campaignCountsSchema,
});
export type AdminCampaignSummary = z.infer<typeof adminCampaignSummarySchema>;

export const adminCampaignSchema = adminCampaignSummarySchema.extend({
  bodyMarkdown: z.string(),
  buttonLabel: z.string().nullable(),
  buttonUrl: z.string().nullable(),
  testRecipients: z.array(z.string()),
  ratePerMinute: z.int(),
  waitlistErasedAt: timestampSchema.nullable(),
});
export type AdminCampaign = z.infer<typeof adminCampaignSchema>;

export const adminCampaignsResponseSchema = z.object({
  campaigns: z.array(adminCampaignSummarySchema),
});
export type AdminCampaignsResponse = z.infer<typeof adminCampaignsResponseSchema>;

/** `POST /admin/campaigns/preview` answer: the e-mail exactly as a recipient would get it. */
export const adminCampaignPreviewSchema = z.object({
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});
export type AdminCampaignPreview = z.infer<typeof adminCampaignPreviewSchema>;

/** `GET /admin/campaigns/:id/audience`: exact recipients, suppression deducted. */
export const adminCampaignAudienceSchema = z.object({ recipients: z.int().nonnegative() });
export type AdminCampaignAudience = z.infer<typeof adminCampaignAudienceSchema>;

/**
 * `POST /admin/campaigns/:id/launch` body. The admin confirms the exact number of recipients:
 * when it changed since, the launch is refused with `recipient_count_changed` and the new number.
 */
export const adminCampaignLaunchRequestSchema = z.object({
  expectedRecipients: z.int().positive(),
  /** null to send now; otherwise within 30 days. */
  scheduledAt: timestampSchema.nullable(),
});
export type AdminCampaignLaunchRequest = z.input<typeof adminCampaignLaunchRequestSchema>;

export const adminCampaignCountChangedSchema = z.object({
  error: z.literal("recipient_count_changed"),
  recipients: z.int().nonnegative(),
});

/** `POST /admin/waitlist/erase` body: the admin types the number of addresses erased. */
export const adminWaitlistEraseRequestSchema = z.object({
  expectedCount: z.int().nonnegative(),
});
export type AdminWaitlistEraseRequest = z.input<typeof adminWaitlistEraseRequestSchema>;

/** The opening e-mail to the waiting list (P55), as the waiting list screen shows it. */
export const adminWaitlistOpeningSchema = z.object({
  campaignId: z.uuid(),
  status: campaignStatusSchema,
  /** Launched: the list no longer takes addresses. */
  closed: z.boolean(),
  erasedAt: timestampSchema.nullable(),
});
export type AdminWaitlistOpening = z.infer<typeof adminWaitlistOpeningSchema>;

/** `GET /me/email-preferences`. */
export const emailPreferencesSchema = z.object({
  /** "M'écrire quand il y a du nouveau" (P61). */
  newsOptIn: z.boolean(),
});
export type EmailPreferences = z.infer<typeof emailPreferencesSchema>;

/** `POST /me/email-preferences` body. The source is kept as proof of consent. */
export const updateEmailPreferencesRequestSchema = z.object({
  newsOptIn: z.boolean(),
  source: z.enum(["signup", "settings"]),
});
export type UpdateEmailPreferencesRequest = z.input<typeof updateEmailPreferencesRequestSchema>;

/** Unsubscribe token: a send id and its HMAC, base64url. Never the address. */
export const unsubscribeTokenSchema = z
  .string()
  .max(100)
  .regex(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);

/**
 * Lettermint webhook events we act on (D-034). Other fields and other events are ignored; an
 * unknown event is acknowledged without being processed.
 */
const lettermintMessageData = z.object({
  message_id: z.string().max(200).optional(),
  recipient: z.string().max(320).optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const lettermintWebhookSchema = z.object({
  id: z.string().max(200),
  event: z.string().max(100),
  timestamp: z.string().max(100).optional(),
  data: lettermintMessageData.optional(),
});
export type LettermintWebhook = z.infer<typeof lettermintWebhookSchema>;
