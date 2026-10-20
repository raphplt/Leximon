/**
 * A/B tests (docs/cahiers-des-charges/ouverture.md, « préparer l'A/B »). A player's variant is a
 * pure function of their id and the experiment: no table, the same answer on every device and on
 * every server, and a guest keeps it on sign-up since they keep their id.
 *
 * Like the game settings, an experiment never changes once started: changing its weights would
 * move players from one variant to the other. To try something else, add a new key.
 */

export interface Experiment<Variant extends string = string> {
  /** Stable key, also the name clients see. Never reused. */
  readonly key: string;
  /** The first variant is the control: everyone gets it outside the experiment's dates. */
  readonly variants: readonly [Variant, ...Variant[]];
  /** Share of players in each variant, in the order of `variants`, out of 100. */
  readonly weights: readonly number[];
  readonly startsAt: number;
  /** `null` while it runs. */
  readonly endsAt: number | null;
}

/** Pack shape (P47): the sealed fold against the crimped pouch. */
export const PACK_SHAPE_EXPERIMENT = {
  key: "pack-shape",
  variants: ["pli", "sachet"],
  weights: [50, 50],
  startsAt: Date.parse("2026-10-20T00:00:00Z"),
  endsAt: null,
} as const satisfies Experiment<"pli" | "sachet">;

export const EXPERIMENTS: readonly Experiment[] = [PACK_SHAPE_EXPERIMENT];

const BUCKETS = 10_000;

/**
 * Bucket of a player in an experiment, from 0 to 9,999: 32-bit FNV-1a of `key:subject`, the
 * hash GrowthBook uses for the same purpose. Salting with the key keeps two experiments
 * independent: being in B for one says nothing about the other.
 */
export function experimentBucket(experimentKey: string, subject: string): number {
  const text = `${experimentKey}:${subject}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % BUCKETS;
}

export function isRunning(experiment: Experiment, now: number): boolean {
  return now >= experiment.startsAt && (experiment.endsAt === null || now < experiment.endsAt);
}

export function assignVariant<Variant extends string>(
  experiment: Experiment<Variant>,
  subject: string,
  now: number,
): Variant {
  const [control] = experiment.variants;
  if (!isRunning(experiment, now)) return control;
  const bucket = experimentBucket(experiment.key, subject);
  let threshold = 0;
  for (const [index, variant] of experiment.variants.entries()) {
    threshold += ((experiment.weights[index] ?? 0) * BUCKETS) / 100;
    if (bucket < threshold) return variant;
  }
  return control;
}

/** Every running experiment's variant for a player, e.g. `{ "pack-shape": "sachet" }`. */
export function runningVariants(
  experiments: readonly Experiment[],
  subject: string,
  now: number,
): Record<string, string> {
  const variants: Record<string, string> = {};
  for (const experiment of experiments) {
    if (isRunning(experiment, now))
      variants[experiment.key] = assignVariant(experiment, subject, now);
  }
  return variants;
}
