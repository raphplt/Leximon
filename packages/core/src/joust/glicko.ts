/**
 * The rating of ranked jousts, Glicko-2 (Mark Glickman, 2012). Each player carries a rating, a
 * deviation (how unsure the rating is) and a volatility (how erratic the player is). A player who
 * stops playing grows more uncertain with time, so their first games back move their rating more.
 * Shown like an Elo: a number that starts at 1 500.
 */

export interface Rating {
  readonly rating: number;
  readonly deviation: number;
  readonly volatility: number;
}

export interface GlickoRules {
  readonly initial: Rating;
  /** Constrains how fast the volatility changes; 0.3 to 1.2 in Glickman's paper. */
  readonly tau: number;
  /** Length of a rating period: the deviation grows once per period without games. */
  readonly periodDays: number;
}

/** A game against an opponent, as they stood before it: 1 won, 0 lost, 0.5 drawn. */
export interface GlickoResult {
  readonly opponent: Rating;
  readonly score: 0 | 0.5 | 1;
}

/** Ratio between the Glicko scale and the Glicko-2 one. */
const SCALE = 173.7178;
const CENTER = 1500;
const CONVERGENCE = 0.000001;

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expected(mu: number, opponentMu: number, opponentPhi: number): number {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

/**
 * The deviation after `idleDays` without a game: it grows by the volatility once per full period,
 * up to the deviation of a new player.
 */
export function idleRating(rules: GlickoRules, rating: Rating, idleDays: number): Rating {
  const periods = Math.max(0, Math.floor(idleDays / rules.periodDays));
  if (periods === 0) return rating;
  const phi = rating.deviation / SCALE;
  const grown = Math.sqrt(phi * phi + periods * rating.volatility * rating.volatility) * SCALE;
  return { ...rating, deviation: Math.min(rules.initial.deviation, grown) };
}

/** The volatility after the period, by the Illinois algorithm of Glickman's step 5. */
function nextVolatility(
  tau: number,
  phi: number,
  sigma: number,
  variance: number,
  delta: number,
): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + variance + ex;
    return (ex * (delta * delta - d)) / (2 * d * d) - (x - a) / (tau * tau);
  };
  let low = a;
  let high: number;
  if (delta * delta > phi * phi + variance) {
    high = Math.log(delta * delta - phi * phi - variance);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    high = a - k * tau;
  }
  let fLow = f(low);
  let fHigh = f(high);
  while (Math.abs(high - low) > CONVERGENCE) {
    const next = low + ((low - high) * fLow) / (fHigh - fLow);
    const fNext = f(next);
    if (fNext * fHigh <= 0) {
      low = high;
      fLow = fHigh;
    } else {
      fLow /= 2;
    }
    high = next;
    fHigh = fNext;
  }
  return Math.exp(low / 2);
}

/** The rating after one period of games. Without games, only the deviation grows. */
export function rateGlicko(
  rules: GlickoRules,
  player: Rating,
  results: readonly GlickoResult[],
): Rating {
  const mu = (player.rating - CENTER) / SCALE;
  const phi = player.deviation / SCALE;
  if (results.length === 0) return idleRating(rules, player, rules.periodDays);

  let inverseVariance = 0;
  let improvement = 0;
  for (const { opponent, score } of results) {
    const opponentMu = (opponent.rating - CENTER) / SCALE;
    const opponentPhi = opponent.deviation / SCALE;
    const weight = g(opponentPhi);
    const e = expected(mu, opponentMu, opponentPhi);
    inverseVariance += weight * weight * e * (1 - e);
    improvement += weight * (score - e);
  }
  const variance = 1 / inverseVariance;
  const delta = variance * improvement;

  const sigma = nextVolatility(rules.tau, phi, player.volatility, variance, delta);
  const before = Math.sqrt(phi * phi + sigma * sigma);
  const nextPhi = 1 / Math.sqrt(1 / (before * before) + 1 / variance);
  const nextMu = mu + nextPhi * nextPhi * improvement;
  return {
    rating: nextMu * SCALE + CENTER,
    deviation: Math.min(rules.initial.deviation, nextPhi * SCALE),
    volatility: sigma,
  };
}
