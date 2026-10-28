import { describe, expect, it } from "vitest";
import { emailTotals, quotaOutlook } from "./emails-model";

const quota = { since: "2026-10-01", included: 3000, notificationDailyLimit: 200 };

describe("quota outlook", () => {
  it("projects the month at the pace of the days so far", () => {
    const outlook = quotaOutlook({ ...quota, sent: 300 }, "2026-10-10");

    expect(outlook.used).toBeCloseTo(0.1);
    expect(outlook.projected).toBe(930);
    expect(outlook.ceiling).toBe(300 + 200 * 21);
    expect(outlook).toMatchObject({ level: "ok", overageUsd: 0 });
  });

  it("warns from 80 % of the quota, and prices what goes past it", () => {
    expect(quotaOutlook({ ...quota, sent: 800 }, "2026-10-10").level).toBe("watch");
    const over = quotaOutlook({ ...quota, sent: 1200 }, "2026-10-10");
    expect(over.projected).toBe(3720);
    expect(over.level).toBe("over");
    expect(over.overageUsd).toBeCloseTo(0.252);
  });

  it("counts the days of a short month", () => {
    expect(quotaOutlook({ ...quota, sent: 140 }, "2026-02-14").projected).toBe(280);
  });
});

describe("totals", () => {
  it("adds up each kind over the days", () => {
    const day = { codes: 2, invitationOnly: 1, notifications: 5, campaigns: 0, failed: 1 };
    expect(
      emailTotals([
        { day: "2026-10-27", ...day },
        { day: "2026-10-28", ...day, campaigns: 40 },
      ]),
    ).toEqual({ codes: 4, invitationOnly: 2, notifications: 10, campaigns: 40, failed: 2 });
  });
});
