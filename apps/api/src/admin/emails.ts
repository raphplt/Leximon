import {
  type AdminEmail,
  type AdminEmailDay,
  type AdminEmailsQuery,
  type AdminEmailsResponse,
  adminEmailKindSchema,
  MEASURES_MAX_DAYS,
} from "@leximon/contract";
import { type EpochMs, gameDayOf } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { sql } from "drizzle-orm";
import { addDays, resolvePeriod } from "./retention";

const { emailCampaignSends, emailCampaigns, notificationEmails, players, signInEmails, users } =
  schema;

/** E-mails a month that the Workers Paid plan includes in Cloudflare Email Service. */
export const CLOUDFLARE_INCLUDED_EMAILS = 3000;

const RECENT = 50;

const parisStart = (day: string) => sql`(${day}::date)::timestamp at time zone 'Europe/Paris'`;

/** A campaign e-mail the provider took, whatever happened after. */
const CAMPAIGN_SENT = sql`${emailCampaignSends.status} in ('sent', 'bounced', 'complained')`;

type RecentRow = {
  at: string;
  kind: string;
  status: string;
  error: string | null;
  user_id: string | null;
  label: string | null;
};

/**
 * E-mails sent over a period, day by day and by kind, the latest ones, and the month's count
 * against Cloudflare's quota. `null` when the period is invalid.
 */
export async function readEmails(
  db: Database,
  now: EpochMs,
  query: AdminEmailsQuery,
  notificationDailyLimit: number,
): Promise<AdminEmailsResponse | null> {
  const today = gameDayOf(now).key;
  const period = resolvePeriod(query, today, MEASURES_MAX_DAYS);
  if (period === null) return null;
  const { from, to } = period;
  const start = parisStart(from);
  const end = parisStart(addDays(to, 1));
  const since = `${today.slice(0, 8)}01`;

  const [daily, quota, recent] = await Promise.all([
    db.execute<AdminEmailDay>(sql`
      with days as (
        select generate_series(${from}::date, ${to}::date, interval '1 day')::date as day
      ),
      sign_in as (
        select (${signInEmails.createdAt} at time zone 'Europe/Paris')::date as day,
          count(*) filter (where ${signInEmails.kind} = 'code' and ${signInEmails.status} = 'sent')::int as codes,
          count(*) filter (where ${signInEmails.kind} = 'invitation_only' and ${signInEmails.status} = 'sent')::int as invitation_only,
          count(*) filter (where ${signInEmails.status} = 'failed')::int as failed
        from ${signInEmails}
        where ${signInEmails.createdAt} >= ${start} and ${signInEmails.createdAt} < ${end}
        group by 1
      ),
      notified as (
        select ${notificationEmails.day} as day,
          count(*) filter (where ${notificationEmails.status} = 'sent')::int as sent,
          count(*) filter (where ${notificationEmails.status} = 'failed')::int as failed
        from ${notificationEmails}
        where ${notificationEmails.day} between ${from}::date and ${to}::date
        group by 1
      ),
      campaigns as (
        select (coalesce(${emailCampaignSends.sentAt}, ${emailCampaignSends.claimedAt}) at time zone 'Europe/Paris')::date as day,
          count(*) filter (where ${CAMPAIGN_SENT})::int as sent,
          count(*) filter (where ${emailCampaignSends.status} = 'failed')::int as failed
        from ${emailCampaignSends}
        where coalesce(${emailCampaignSends.sentAt}, ${emailCampaignSends.claimedAt}) >= ${start}
          and coalesce(${emailCampaignSends.sentAt}, ${emailCampaignSends.claimedAt}) < ${end}
        group by 1
      )
      select
        days.day::text as day,
        coalesce(sign_in.codes, 0) as codes,
        coalesce(sign_in.invitation_only, 0) as "invitationOnly",
        coalesce(notified.sent, 0) as notifications,
        coalesce(campaigns.sent, 0) as campaigns,
        (coalesce(sign_in.failed, 0) + coalesce(notified.failed, 0) + coalesce(campaigns.failed, 0))::int as failed
      from days
      left join sign_in using (day)
      left join notified using (day)
      left join campaigns using (day)
      order by days.day
    `),
    db.execute<{ sent: number }>(sql`
      select (
        (select count(*) from ${signInEmails}
          where ${signInEmails.status} = 'sent' and ${signInEmails.createdAt} >= ${parisStart(since)})
        + (select count(*) from ${notificationEmails}
          where ${notificationEmails.status} = 'sent' and ${notificationEmails.day} >= ${since}::date)
      )::int as sent
    `),
    db.execute<RecentRow>(sql`
      (select ${signInEmails.createdAt} as at, ${signInEmails.kind} as kind,
          ${signInEmails.status} as status, ${signInEmails.lastError} as error,
          null::text as user_id, null::text as label
        from ${signInEmails}
        where ${signInEmails.createdAt} >= ${start} and ${signInEmails.createdAt} < ${end}
        order by ${signInEmails.createdAt} desc
        limit ${RECENT})
      union all
      (select coalesce(${notificationEmails.sentAt}, ${notificationEmails.createdAt}),
          ${notificationEmails.kind}, ${notificationEmails.status}, ${notificationEmails.lastError},
          ${notificationEmails.userId},
          coalesce(${players.pseudo}, case when ${users.isAnonymous} then null else ${users.email} end)
        from ${notificationEmails}
        join ${users} on ${users.id} = ${notificationEmails.userId}
        left join ${players} on ${players.userId} = ${notificationEmails.userId}
        where ${notificationEmails.status} <> 'sending'
          and ${notificationEmails.day} between ${from}::date and ${to}::date
        order by ${notificationEmails.createdAt} desc
        limit ${RECENT})
      union all
      (select coalesce(${emailCampaignSends.sentAt}, ${emailCampaignSends.claimedAt}), 'campaign',
          ${emailCampaignSends.status}, ${emailCampaignSends.lastError},
          ${emailCampaignSends.userId}, ${emailCampaigns.name}
        from ${emailCampaignSends}
        join ${emailCampaigns} on ${emailCampaigns.id} = ${emailCampaignSends.campaignId}
        where (${CAMPAIGN_SENT} or ${emailCampaignSends.status} = 'failed')
          and coalesce(${emailCampaignSends.sentAt}, ${emailCampaignSends.claimedAt}) >= ${start}
          and coalesce(${emailCampaignSends.sentAt}, ${emailCampaignSends.claimedAt}) < ${end}
        order by 1 desc
        limit ${RECENT})
      order by at desc
      limit ${RECENT}
    `),
  ]);

  return {
    period: { from, to, today },
    daily: daily.rows,
    quota: {
      since,
      sent: quota.rows[0]?.sent ?? 0,
      included: CLOUDFLARE_INCLUDED_EMAILS,
      notificationDailyLimit,
    },
    recent: recent.rows.flatMap(toEmail),
  };
}

function toEmail(row: RecentRow): AdminEmail[] {
  const kind = adminEmailKindSchema.safeParse(row.kind);
  if (!kind.success) return [];
  return [
    {
      at: new Date(row.at).toISOString(),
      kind: kind.data,
      status: row.status,
      error: row.error,
      userId: row.user_id,
      label: row.label,
    },
  ];
}
