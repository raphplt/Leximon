import type { WelcomeWeekResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  welcomeAfterClaim,
  welcomeGuestLine,
  welcomeRefusalMessage,
  welcomeReminderLine,
  welcomeSessionLine,
  welcomeTomorrowLine,
  welcomeView,
  welcomeWaits,
} from "./welcome";

const days: WelcomeWeekResponse["days"] = [
  [{ kind: "bonus_booster" }, { kind: "bonus_booster" }],
  [{ kind: "garni_booster" }],
  [{ kind: "avatar", avatar: "bejaune" }],
  [{ kind: "precious_garni_booster" }, { kind: "title", title: "Habitué des rayons" }],
];
const week = (claimed: number, open: boolean, account = true): WelcomeWeekResponse => ({
  days,
  claimed,
  open,
  account,
});

describe("welcomeView", () => {
  it("marks the days claimed, today's, tomorrow's and the later ones", () => {
    const view = welcomeView(week(1, true));
    expect(view.today).toBe(2);
    expect(view.cases.map((c) => c.status)).toEqual(["claimed", "today", "later", "later"]);
    expect(welcomeView(week(1, false)).cases.map((c) => c.status)).toEqual([
      "claimed",
      "tomorrow",
      "later",
      "later",
    ]);
  });

  it("says each day's rewards in a sentence", () => {
    expect(welcomeView(week(0, true)).cases.map((c) => c.phrase)).toEqual([
      "2 sachets bonus",
      "un sachet garni",
      "un avatar gravé",
      "un sachet garni Précieux et le titre « Habitué des rayons »",
    ]);
  });

  it("opens nothing to a guest, nor once the week is over", () => {
    expect(welcomeView(week(0, true, false)).today).toBeNull();
    expect(welcomeWaits(week(0, true, false))).toBe(false);
    expect(welcomeView(week(4, true))).toMatchObject({ today: null, done: true });
    expect(welcomeWaits(null)).toBe(false);
  });
});

describe("the lines of the week", () => {
  it("says what tomorrow gives once today's day is claimed", () => {
    expect(welcomeTomorrowLine(week(2, false))).toBe(
      "Demain, le jour 3 de ta semaine de bienvenue t'offre un avatar gravé.",
    );
    expect(welcomeTomorrowLine(week(2, true))).toBeNull();
    expect(welcomeTomorrowLine(week(4, false))).toBeNull();
  });

  it("ends a session on today's day if it waits, else on tomorrow's", () => {
    expect(welcomeSessionLine(week(0, true))).toBe(
      "Le jour 1 de ta semaine de bienvenue t'attend dans tes récompenses.",
    );
    expect(welcomeSessionLine(week(1, false))).toBe(
      "Demain, le jour 2 de ta semaine de bienvenue t'offre un sachet garni.",
    );
  });

  it("adds today's day to the e-mail that says the sachets are full", () => {
    expect(welcomeReminderLine(week(1, true))).toBe(
      "Le jour 2 de ta semaine de bienvenue t'attend aussi, avec un sachet garni.",
    );
    expect(welcomeReminderLine(week(1, false))).toBeNull();
  });

  it("closes the week on its last day", () => {
    expect(welcomeAfterClaim(week(4, false), 4)).toBe(
      "C'était le dernier jour de ta semaine de bienvenue. Ton carnet de pointage prend le relais, une case par jour où tu joues.",
    );
  });

  it("counts the sachets of the week for a guest", () => {
    expect(welcomeGuestLine(week(0, true, false))).toBe(
      "Ton compte t'offre aussi une semaine de bienvenue, avec 4 sachets en 4 jours.",
    );
    expect(welcomeGuestLine(week(0, true))).toBeNull();
  });

  it("says why a day stays closed", () => {
    expect(welcomeRefusalMessage("not_open")).toBe("Cette case s'ouvre demain.");
  });
});
