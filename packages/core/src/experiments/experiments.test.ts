import { describe, expect, it } from "vitest";
import {
  assignVariant,
  type Experiment,
  experimentBucket,
  PACK_SHAPE_EXPERIMENT,
  runningVariants,
} from "./experiments";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const subjects = Array.from({ length: 20_000 }, (_, i) => `user-${i}`);

function experiment(overrides: Partial<Experiment<"a" | "b">> = {}): Experiment<"a" | "b"> {
  return {
    key: "test",
    variants: ["a", "b"],
    weights: [50, 50],
    startsAt: Date.parse("2026-11-01T00:00:00Z"),
    endsAt: null,
    ...overrides,
  };
}

describe("experimentBucket", () => {
  it("always gives a player the same bucket", () => {
    expect(experimentBucket("pack-shape", "abc")).toBe(experimentBucket("pack-shape", "abc"));
    const bucket = experimentBucket("pack-shape", "abc");
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(10_000);
  });
});

describe("assignVariant", () => {
  it("splits players according to the weights", () => {
    const even = subjects.filter((s) => assignVariant(experiment(), s, NOW) === "b").length;
    expect(even / subjects.length).toBeGreaterThan(0.48);
    expect(even / subjects.length).toBeLessThan(0.52);

    const skewed = experiment({ weights: [90, 10] });
    const share = subjects.filter((s) => assignVariant(skewed, s, NOW) === "b").length;
    expect(share / subjects.length).toBeGreaterThan(0.08);
    expect(share / subjects.length).toBeLessThan(0.12);
  });

  it("keeps two experiments independent", () => {
    const other = experiment({ key: "other" });
    const both = subjects.filter(
      (s) => assignVariant(experiment(), s, NOW) === "b" && assignVariant(other, s, NOW) === "b",
    ).length;
    expect(both / subjects.length).toBeGreaterThan(0.23);
    expect(both / subjects.length).toBeLessThan(0.27);
  });

  it("gives everyone the control outside the experiment's dates", () => {
    const ended = experiment({ endsAt: Date.parse("2026-11-10T00:00:00Z") });
    const before = Date.parse("2026-10-01T00:00:00Z");
    expect(subjects.every((s) => assignVariant(experiment(), s, before) === "a")).toBe(true);
    expect(subjects.every((s) => assignVariant(ended, s, NOW) === "a")).toBe(true);
  });
});

describe("runningVariants", () => {
  it("lists only the experiments running now", () => {
    const later = experiment({ key: "later", startsAt: Date.parse("2027-01-01T00:00:00Z") });
    const variants = runningVariants([PACK_SHAPE_EXPERIMENT, later], "user-1", NOW);
    expect(Object.keys(variants)).toEqual(["pack-shape"]);
    expect(["pli", "sachet"]).toContain(variants["pack-shape"]);
  });
});
