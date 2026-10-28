import type { AdminEmailDay, AdminEmailsResponse } from "@leximon/contract";

/** What Cloudflare charges past the included e-mails, in dollars per thousand. */
export const OVERAGE_PER_THOUSAND_USD = 0.35;

export type QuotaLevel = "ok" | "watch" | "over";

export interface QuotaOutlook {
  /** Share of the included e-mails already sent. */
  readonly used: number;
  /** E-mails at the end of the month if the days to come look like the days so far. */
  readonly projected: number;
  /** E-mails at the end of the month if every day to come spends the whole notification budget. */
  readonly ceiling: number;
  /** Dollars past the included e-mails at the projected pace. */
  readonly overageUsd: number;
  /** `watch` from 80 % of the quota projected, `over` past it. */
  readonly level: QuotaLevel;
}

const WATCH_FROM = 0.8;

/** Where the month is heading against Cloudflare's included e-mails. */
export function quotaOutlook(quota: AdminEmailsResponse["quota"], today: string): QuotaOutlook {
  const [year = 0, month = 1, day = 1] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const projected = Math.round((quota.sent / day) * daysInMonth);
  const ceiling = quota.sent + quota.notificationDailyLimit * (daysInMonth - day);
  const overageUsd = (Math.max(0, projected - quota.included) / 1000) * OVERAGE_PER_THOUSAND_USD;
  return {
    used: quota.sent / quota.included,
    projected,
    ceiling,
    overageUsd,
    level:
      projected > quota.included
        ? "over"
        : projected >= quota.included * WATCH_FROM
          ? "watch"
          : "ok",
  };
}

export interface EmailTotals {
  readonly codes: number;
  readonly invitationOnly: number;
  readonly notifications: number;
  readonly campaigns: number;
  readonly failed: number;
}

export function emailTotals(days: readonly AdminEmailDay[]): EmailTotals {
  return days.reduce(
    (sum, day) => ({
      codes: sum.codes + day.codes,
      invitationOnly: sum.invitationOnly + day.invitationOnly,
      notifications: sum.notifications + day.notifications,
      campaigns: sum.campaigns + day.campaigns,
      failed: sum.failed + day.failed,
    }),
    { codes: 0, invitationOnly: 0, notifications: 0, campaigns: 0, failed: 0 },
  );
}
