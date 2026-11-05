import type { CarnetResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  carnetAction,
  carnetNextLine,
  carnetNotStartedLine,
  carnetTomorrowLine,
  carnetView,
  carnetWaitingLine,
} from "./carnet";

function carnet(over: Partial<CarnetResponse> = {}): CarnetResponse {
  return {
    account: true,
    started: true,
    cases: [
      [{ kind: "ecus", amount: 10 }],
      [{ kind: "ecus", amount: 10 }],
      [{ kind: "bonus_booster" }],
    ],
    period: { index: 0, firstDay: "2026-11-09", lastDay: "2026-12-06" },
    earned: 2,
    claimed: 1,
    next: { period: 0, case: 2 },
    waiting: 1,
    ...over,
  };
}

describe("carnetView", () => {
  it("shows each case as claimed, waiting or to come", () => {
    const view = carnetView(carnet());
    expect(view.cases.map((c) => c.status)).toEqual(["claimed", "waiting", "later"]);
    expect(view.cases[2]).toMatchObject({
      big: true,
      last: true,
      label: "Case 3, un sachet bonus, à venir",
    });
    expect(view.cases[0]?.label).toBe("Case 1, 10 écus, prise");
    expect(view.dates).toBe("Du 9 novembre au 6 décembre 2026");
    expect(view.filled).toBe("2 cases remplies sur 3");
    expect(carnetView(carnet({ earned: 1 })).filled).toBe("1 case remplie sur 3");
  });
});

describe("carnet texts", () => {
  it("names the case to claim, an earlier carnet first", () => {
    expect(carnetAction(carnet())).toBe("Prendre la case 2");
    expect(carnetAction(carnet({ next: { period: -1, case: 27 } }))).toBe(
      "Prendre la case 27 du carnet précédent",
    );
    expect(carnetAction(carnet({ next: null }))).toBeNull();
    expect(carnetNextLine(carnet())).toBe("La case 2 t'offre 10 écus.");
  });

  it("says what the next day played fills", () => {
    expect(carnetTomorrowLine(carnet())).toBeNull();
    expect(carnetTomorrowLine(carnet({ next: null, claimed: 2 }))).toBe(
      "Joue un autre jour pour remplir la case 3, qui t'offre un sachet bonus.",
    );
  });

  it("says when the carnet starts", () => {
    expect(carnetNotStartedLine(carnet())).toBeNull();
    expect(carnetNotStartedLine(carnet({ started: false }))).toBe(
      "Ton carnet de pointage commence le jour où tu joues après ta semaine de bienvenue.",
    );
  });

  it("counts the cases that wait, for one and many", () => {
    expect(carnetWaitingLine(carnet())).toBe("Une case de ton carnet de pointage t'attend.");
    expect(carnetWaitingLine(carnet({ waiting: 3 }))).toBe(
      "3 cases de ton carnet de pointage t'attendent.",
    );
    expect(carnetWaitingLine(carnet({ waiting: 0 }))).toBeNull();
  });
});
