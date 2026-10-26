import { describe, expect, it } from "vitest";
import { gameHourOf, gameTimeOn } from "../bonus/bonus";
import { NOTIFY_SCHEDULE } from "../rules";
import {
  absenceDays,
  isLastReminder,
  notifyRulesAt,
  reminderSeenDays,
  reminderStep,
  sendableAt,
} from "./notify";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** 18:00 in Paris on Wednesday 2026-11-04 (winter time, UTC+1). */
const evening = Date.UTC(2026, 10, 4, 17);
const rules = notifyRulesAt(NOTIFY_SCHEDULE, evening);

describe("absenceDays", () => {
  it("counts calendar days in Paris, not hours", () => {
    expect(absenceDays(evening - HOUR, evening)).toBe(0);
    // Seen at 23:30 the night before: one day, though only 18 hours ago.
    expect(absenceDays(Date.UTC(2026, 10, 3, 22, 30), evening)).toBe(1);
    // 00:30 in Paris is still the 4th, though the 3rd in UTC.
    expect(absenceDays(Date.UTC(2026, 10, 3, 23, 30), evening)).toBe(0);
    expect(absenceDays(evening - 30 * DAY, evening)).toBe(30);
  });

  it("spans the change of clocks without losing a day", () => {
    // Seen on 2026-10-24 (summer time), counted on 2026-10-27 (winter time).
    expect(absenceDays(Date.UTC(2026, 9, 24, 10), Date.UTC(2026, 9, 27, 17))).toBe(3);
  });
});

describe("reminderStep", () => {
  it("sends on days 1, 3, 7, 14 and 30 of absence only", () => {
    const due = Array.from({ length: 40 }, (_, days) => days).filter(
      (days) => reminderStep(rules, evening - days * DAY, evening) !== null,
    );
    expect(due).toEqual([1, 3, 7, 14, 30]);
  });

  it("never reminds a player seen today", () => {
    expect(reminderStep(rules, evening - 10 * HOUR, evening)).toBeNull();
  });

  it("says when no reminder follows", () => {
    expect(isLastReminder(rules, 30)).toBe(true);
    expect(isLastReminder(rules, 14)).toBe(false);
  });
});

describe("reminderSeenDays", () => {
  it("names the days a player due today was last seen", () => {
    expect(reminderSeenDays(rules, evening)).toEqual([
      "2026-10-05",
      "2026-10-21",
      "2026-10-28",
      "2026-11-01",
      "2026-11-03",
    ]);
  });
});

describe("sendableAt", () => {
  it("lets an e-mail leave during the day", () => {
    expect(sendableAt(rules, evening)).toBe(evening);
  });

  it("holds an e-mail of the night until 8:00 in Paris", () => {
    const night = Date.UTC(2026, 10, 4, 21, 15); // 22:15 in Paris
    const morning = sendableAt(rules, night);
    expect(morning).toBe(gameTimeOn("2026-11-05", 8));
    expect(gameHourOf(morning)).toBe(8);
    const early = Date.UTC(2026, 10, 5, 4); // 5:00 in Paris
    expect(sendableAt(rules, early)).toBe(morning);
  });

  it("keeps 8:00 in summer time too", () => {
    const night = Date.UTC(2026, 5, 10, 20); // 22:00 in Paris
    expect(sendableAt(rules, night)).toBe(Date.UTC(2026, 5, 11, 6));
  });
});
