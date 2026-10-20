/**
 * Reading an A/B test: is the gap between two rates more than chance? Two-sided test on two
 * proportions with the normal approximation, enough for the few thousand players of a beta.
 */

export interface Proportion {
  readonly successes: number;
  readonly total: number;
}

export interface Comparison {
  readonly rateA: number;
  readonly rateB: number;
  /** `rateB - rateA`. */
  readonly difference: number;
  /** Chance of a gap at least this wide if both variants were the same. `null` without data. */
  readonly pValue: number | null;
}

/** Standard normal cumulative distribution (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export function compareProportions(a: Proportion, b: Proportion): Comparison {
  const rateA = a.total > 0 ? a.successes / a.total : 0;
  const rateB = b.total > 0 ? b.successes / b.total : 0;
  const difference = rateB - rateA;
  if (a.total === 0 || b.total === 0) return { rateA, rateB, difference, pValue: null };
  const pooled = (a.successes + b.successes) / (a.total + b.total);
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / a.total + 1 / b.total));
  if (standardError === 0) return { rateA, rateB, difference, pValue: difference === 0 ? 1 : 0 };
  const z = difference / standardError;
  return { rateA, rateB, difference, pValue: 2 * (1 - normalCdf(Math.abs(z))) };
}
