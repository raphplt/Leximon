import {
  ADMIN_ACTIONS,
  type AdminWaitlistInviteRequest,
  type AdminWaitlistInviteResponse,
  CAMPAIGN_RATE,
  WAITLIST_INVITE_SUBJECT,
} from "@leximon/contract";
import { type EpochMs, gameDayOf } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomInviteCode } from "../beta/invites";
import { lockWaitlist } from "./closure";

const {
  adminActions,
  emailCampaignSends: sends,
  emailCampaigns: campaigns,
  emailSuppressions,
  invites,
  users,
  waitlistSignups: waitlist,
} = schema;

/** What the invited addresses read. One action: the button, which carries the invitation. */
export const WAITLIST_INVITE_EMAIL = {
  subject: WAITLIST_INVITE_SUBJECT,
  bodyMarkdown: [
    "Tu nous as laissé ton adresse pour entrer dans Leximon. Ta place est prête.",
    "Des mots que plus personne ne dit t'attendent, à collectionner et à placer. Gratuits, tous les jours.",
    "La bêta est encore sur invitation : ce bouton est ton entrée.",
  ].join("\n\n"),
  buttonLabel: "Entrer dans Leximon",
} as const;

/**
 * An address an invitation can go to: not invited yet, not opted out of our e-mails, and without
 * an account (a player already in needs no invitation).
 */
export const invitableAddress = sql`${waitlist.invitedAt} is null
  and not exists (select 1 from ${emailSuppressions}
    where ${emailSuppressions.email} = ${waitlist.email})
  and not exists (select 1 from ${users} where ${users.email} = ${waitlist.email})`;

export type InviteWaitlistResult =
  | ({ readonly kind: "invited" } & AdminWaitlistInviteResponse)
  | { readonly kind: "nobody_to_invite" };

/**
 * Invites addresses of the waiting list to the closed beta, in one transaction: an invitation
 * link with exactly one place per address, a campaign already launched that carries it, and the
 * addresses marked as invited so that no later click writes to them again.
 *
 * Rows are locked as they are picked: two clicks at once never invite the same address twice.
 * A retried request with the same key returns the first result.
 */
export async function inviteFromWaitlist(
  db: Database,
  input: {
    readonly adminId: string;
    readonly request: AdminWaitlistInviteRequest;
    readonly webUrl: string;
    readonly idempotencyKey: string;
    readonly now: EpochMs;
  },
): Promise<InviteWaitlistResult> {
  const { adminId, request, idempotencyKey, now } = input;
  return db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ details: adminActions.details })
      .from(adminActions)
      .where(
        and(eq(adminActions.adminId, adminId), eq(adminActions.idempotencyKey, idempotencyKey)),
      );
    if (previous !== undefined) {
      const details = previous.details as AdminWaitlistInviteResponse;
      return {
        kind: "invited",
        invited: details.invited,
        campaignId: details.campaignId,
        inviteCode: details.inviteCode,
      };
    }

    // Shared, like a sign-up: the erasure of the list, exclusive, waits for the invitation.
    await lockWaitlist(tx, "shared");
    const picked = await tx.execute<{ email: string }>(
      request.target === "oldest"
        ? sql`select ${waitlist.email} as email from ${waitlist}
            where ${invitableAddress}
            order by ${waitlist.createdAt}, ${waitlist.email}
            limit ${request.count}
            for update of ${waitlist} skip locked`
        : sql`select ${waitlist.email} as email from ${waitlist}
            where ${invitableAddress}
              and ${inArray(waitlist.email, request.emails)}
            for update of ${waitlist}`,
    );
    const emails = picked.rows.map((row) => row.email);
    if (emails.length === 0) return { kind: "nobody_to_invite" };

    const at = new Date(now);
    const [day = "", month = ""] = gameDayOf(now).key.split("-").reverse();
    const batch = `Liste d'attente · ${day}/${month}`;
    const [invite] = await tx
      .insert(invites)
      .values({
        code: randomInviteCode(),
        label: batch,
        maxUses: emails.length,
        createdBy: adminId,
        createdAt: at,
      })
      .returning({ id: invites.id, code: invites.code });
    if (invite === undefined) throw new Error("Invite insert returned no row");

    const [campaign] = await tx
      .insert(campaigns)
      .values({
        name: `Invitation · ${batch}`,
        subject: WAITLIST_INVITE_EMAIL.subject,
        bodyMarkdown: WAITLIST_INVITE_EMAIL.bodyMarkdown,
        buttonLabel: WAITLIST_INVITE_EMAIL.buttonLabel,
        buttonUrl: `${input.webUrl.replace(/\/+$/, "")}/invitation/${invite.code}`,
        audience: "waitlist_invite",
        status: "sending",
        ratePerMinute: CAMPAIGN_RATE.default,
        recipientCount: emails.length,
        createdBy: adminId,
        launchedBy: adminId,
        createdAt: at,
        updatedAt: at,
        launchedAt: at,
      })
      .returning({ id: campaigns.id });
    if (campaign === undefined) throw new Error("Campaign insert returned no row");

    await tx
      .update(waitlist)
      .set({ invitedAt: at, inviteCampaignId: campaign.id })
      .where(inArray(waitlist.email, emails));
    await tx.execute(sql`
      insert into ${sends} (campaign_id, email)
      select ${campaign.id}::uuid, ${waitlist.email} from ${waitlist}
      where ${waitlist.inviteCampaignId} = ${campaign.id}::uuid`);

    const result: AdminWaitlistInviteResponse = {
      invited: emails.length,
      campaignId: campaign.id,
      inviteCode: invite.code,
    };
    await tx.insert(adminActions).values({
      adminId,
      action: ADMIN_ACTIONS.inviteWaitlist,
      details: { ...result, inviteId: invite.id },
      idempotencyKey,
      createdAt: at,
    });
    return { kind: "invited", ...result };
  });
}
