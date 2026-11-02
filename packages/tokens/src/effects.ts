import type { Rarity } from "@leximon/core";

/**
 * The particles of « La Bibliothèque », as data: each platform draws them its own way (a 2D
 * canvas on the web, Skia on the phone) from the same settings. Speeds are in px per second,
 * gravity in px per second squared, sizes in px, lives in seconds.
 *
 * - `spark`: a short streak of light along its path;
 * - `glow`: a soft round light, also the dust in the lamplight;
 * - `star`: a four-pointed twinkle;
 * - `leaf`: a fluttering flake, of gold leaf or of parchment depending on its colors.
 */
export type ParticleKind = "spark" | "glow" | "star" | "leaf";

export type Range = readonly [min: number, max: number];

export interface BurstSettings {
  readonly count: number;
  readonly kinds: readonly ParticleKind[];
  readonly colors: readonly string[];
  readonly speed: Range;
  readonly life: Range;
  readonly size: Range;
  /** Directions in radians, 0 pointing right and π/2 down. The whole circle by default. */
  readonly angle?: Range;
  /** How far from the point each particle starts, in px. */
  readonly spread?: number;
  readonly gravity?: number;
  /** The share of speed kept every sixtieth of a second. */
  readonly drag?: number;
  /** A sideways sway, in px per second, as a leaf falls. */
  readonly sway?: number;
  /** How much a particle grows over its life: 1 doubles it. */
  readonly grow?: number;
}

/** One knob for every burst, shake and flash: 0.6 keeps the room sober. */
export const intensity = 0.6;

/** At most this many particles alive at once: past it, new ones are dropped. */
export const particleCap = { web: 300, mobile: 150 } as const;

/** Light colors of each rarity, for its burst and the light it draws in. */
export const rarityLights: Readonly<Record<Rarity, readonly string[]>> = {
  common: ["#FFF6E0", "#E8DCC2"],
  uncommon: ["#5FF0B8", "#1F9E7A", "#C8FFE9"],
  rare: ["#FF8A5C", "#F0603C", "#FFD2B8"],
  precious: ["#8FB0FF", "#3361E8", "#D6E2FF"],
  epic: ["#FFE08A", "#FFC23D", "#FFF4CF", "#FF9D2E"],
  // Gold first: the aura and the rays take the first light, the sparks take them all.
  legendary: ["#FFD36E", "#FF9AD5", "#A5FF9A", "#7FE6FF", "#B49CFF", "#FFFFFF"],
};

/** The band of light that sweeps a card's face as it settles, at its brightest. */
export const revealSheen = "rgba(255, 255, 255, 0.7)";

/** The rarity's name stamped over the card, for the two highest. */
export const revealBanner: Readonly<Partial<Record<Rarity, string>>> = {
  epic: "#F6D47A",
  legendary: "#DDF6FF",
};

const GOLD_LEAF = ["#F6D47A", "#E0B04A", "#FBECCB"];
const PARCHMENT = ["#F3E2B8", "#E6CF98", "#D9BD84"];
const LAMPLIGHT = ["#FFF6D8", "#F6D47A", "#D9A63A"];
const DUST = "rgba(255, 230, 180, 0.5)";

export const effects = {
  /** Dust drifting in the lamplight, a few motes per second. */
  dust: {
    perSecond: 3,
    burst: {
      count: 1,
      kinds: ["glow"],
      colors: ["rgba(255, 220, 160, 0.55)"],
      speed: [3, 7],
      angle: [-Math.PI * 0.75, -Math.PI * 0.25],
      life: [5, 9],
      size: [0.8, 1.8],
      drag: 1,
      sway: 8,
    },
  },
  /** Sparks leaking from the tear while the sachet charges, more and more of them. */
  charge: {
    everyMs: 55,
    burst: {
      count: 1,
      kinds: ["spark"],
      colors: ["#FFF6D8", "#F6D47A"],
      speed: [120, 320],
      angle: [-Math.PI * 0.95, -Math.PI * 0.05],
      spread: 50,
      life: [0.25, 0.5],
      size: [1.5, 3],
      gravity: 400,
    },
  },
  /** The sachet bursts: light, then scraps of parchment. */
  burst: [
    {
      count: 90,
      kinds: ["spark", "glow"],
      colors: LAMPLIGHT,
      speed: [200, 900],
      life: [0.4, 1.1],
      size: [2, 5],
      gravity: 500,
      drag: 0.94,
    },
    {
      count: 30,
      kinds: ["leaf"],
      colors: PARCHMENT,
      speed: [150, 480],
      life: [1, 1.8],
      size: [6, 9],
      gravity: 260,
      sway: 30,
    },
  ],
  /** A card lands on the desk: a puff of dust under it. */
  land: {
    count: 6,
    kinds: ["glow"],
    colors: [DUST],
    speed: [20, 70],
    angle: [Math.PI * 0.9, Math.PI * 2.1],
    life: [0.4, 0.7],
    size: [4, 8],
    grow: 1.5,
  },
  /** A reward claimed from a tile. */
  reward: {
    count: 18,
    kinds: ["star"],
    colors: ["#F6D47A", "#FFF6D8"],
    speed: [80, 220],
    life: [0.4, 0.8],
    size: [3, 7],
    gravity: 300,
  },
  /** A right answer in a challenge: a short spray of gold and green from the answer. */
  right: {
    count: 14,
    kinds: ["spark", "star"],
    colors: ["#F6D47A", "#9ED8AF", "#FFF6D8"],
    speed: [90, 240],
    life: [0.35, 0.7],
    size: [3, 6],
    gravity: 280,
  },
  /** Gold leaf falling from the top of the screen, for an epic or legendary card. */
  rain: {
    kinds: ["leaf"],
    colors: GOLD_LEAF,
    speed: [50, 300],
    angle: [Math.PI * 0.15, Math.PI * 0.85],
    life: [1.6, 3],
    size: [5, 10],
    gravity: 260,
    drag: 0.985,
    sway: 40,
  },
} as const satisfies {
  readonly dust: { readonly perSecond: number; readonly burst: BurstSettings };
  readonly charge: { readonly everyMs: number; readonly burst: BurstSettings };
  readonly burst: readonly BurstSettings[];
  readonly land: BurstSettings;
  readonly reward: BurstSettings;
  readonly right: BurstSettings;
  readonly rain: Omit<BurstSettings, "count">;
};

/**
 * The opening of a sachet, in ms: it comes to the middle of the desk, charges while the server
 * answers (longer if the answer is late), then bursts and lets the first card come.
 */
export const openingTimes = {
  arriveMs: 520,
  chargeMs: 1100,
  burstMs: 450,
} as const;

/** What a card's face does as it turns, by rarity. */
export interface RevealEffect {
  readonly bursts: readonly BurstSettings[];
  /** Leaves falling from the top of the screen. */
  readonly rain: number;
  /** A ring of the rarity's light, as a multiple of the card's size. 0 for none. */
  readonly ring: number;
  readonly shake: { readonly strength: number; readonly ms: number } | null;
  readonly flash: { readonly opacity: number; readonly ms: number } | null;
  /** Rays turning behind the card. */
  readonly rays: boolean;
  /** Before it turns, the card trembles this long and draws the light in. 0 for none. */
  readonly drawInMs: number;
}

/** A soft light swelling on the card as it turns, under the sparks. */
function halo(colors: readonly string[], count: number, size: Range): BurstSettings {
  return {
    count,
    kinds: ["glow"],
    colors,
    speed: [0, 90],
    life: [0.5, 1],
    size,
    grow: 0.6,
    drag: 0.9,
  };
}

/** Sparks thrown off the card, as from a struck flint. */
function sparks(rarity: Rarity, count: number, speed: Range): BurstSettings {
  return {
    count,
    kinds: ["spark"],
    colors: rarityLights[rarity],
    speed,
    life: [0.35, 0.8],
    size: [1.5, 3.5],
    gravity: 380,
    drag: 0.94,
  };
}

/** Stars that linger and rise a little after the sparks are gone. */
function twinkles(rarity: Rarity, count: number): BurstSettings {
  return {
    count,
    kinds: ["star"],
    colors: rarityLights[rarity],
    speed: [40, 220],
    life: [0.9, 1.8],
    size: [3, 7],
    gravity: -30,
    drag: 0.95,
  };
}

export const revealEffects: Readonly<Record<Rarity, RevealEffect>> = {
  // Most cards of a sachet: a few glints off its edges, nothing that tires on the third one.
  // They start around the card, where the dark of the room shows them, not on its cream face.
  common: {
    bursts: [
      {
        count: 14,
        kinds: ["star"],
        colors: ["#F6D47A", "#FFF6E0"],
        spread: 80,
        speed: [50, 160],
        life: [0.5, 0.9],
        size: [3, 5.5],
        gravity: 60,
      },
    ],
    rain: 0,
    ring: 0,
    shake: null,
    flash: null,
    rays: false,
    drawInMs: 0,
  },
  uncommon: {
    bursts: [
      {
        count: 24,
        kinds: ["star"],
        colors: rarityLights.uncommon,
        spread: 50,
        speed: [60, 260],
        life: [0.4, 0.9],
        size: [3, 6],
        gravity: 120,
      },
    ],
    rain: 0,
    ring: 0,
    shake: null,
    flash: null,
    rays: false,
    drawInMs: 0,
  },
  rare: {
    bursts: [
      halo(["rgba(255, 138, 92, 0.45)"], 3, [8, 12]),
      sparks("rare", 34, [150, 520]),
      twinkles("rare", 12),
    ],
    rain: 0,
    ring: 3.5,
    shake: { strength: 4, ms: 260 },
    flash: null,
    rays: false,
    drawInMs: 0,
  },
  precious: {
    bursts: [
      halo(["rgba(143, 176, 255, 0.5)"], 3, [9, 13]),
      sparks("precious", 44, [200, 700]),
      twinkles("precious", 16),
    ],
    rain: 0,
    ring: 4.5,
    shake: { strength: 6, ms: 340 },
    flash: null,
    rays: false,
    drawInMs: 0,
  },
  epic: {
    bursts: [
      halo(["rgba(255, 224, 138, 0.5)"], 4, [10, 15]),
      sparks("epic", 60, [250, 900]),
      twinkles("epic", 22),
    ],
    rain: 30,
    ring: 6,
    shake: { strength: 8, ms: 420 },
    flash: { opacity: 0.5, ms: 400 },
    rays: true,
    drawInMs: 650,
  },
  legendary: {
    bursts: [
      halo(["rgba(255, 244, 207, 0.55)", "rgba(221, 246, 255, 0.5)"], 5, [12, 18]),
      sparks("legendary", 90, [300, 1050]),
      twinkles("legendary", 34),
    ],
    rain: 110,
    ring: 9,
    shake: { strength: 14, ms: 650 },
    flash: { opacity: 0.95, ms: 650 },
    rays: true,
    drawInMs: 1000,
  },
};

/** The sachet bursting open. */
export const burstOpen = {
  ring: 6,
  shake: { strength: 10, ms: 450 },
  flash: { opacity: 1, ms: 500 },
} as const;
