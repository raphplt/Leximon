// Written by packages/tokens/scripts/bake_ornaments.py.

export const plates = {
  f01: { width: 480, height: 430 },
  f02: { width: 421, height: 480 },
  f03: { width: 480, height: 346 },
  f05: { width: 480, height: 374 },
  f06: { width: 480, height: 263 },
  f09: { width: 480, height: 441 },
  f10: { width: 453, height: 480 },
  f15: { width: 480, height: 317 },
  b01: { width: 1080, height: 288 },
  b02: { width: 1080, height: 303 },
  b04: { width: 1080, height: 344 },
  b05: { width: 1080, height: 397 },
  b06: { width: 1080, height: 406 },
  b07: { width: 1080, height: 362 },
  lr01: { width: 298, height: 300 },
  lr02: { width: 293, height: 300 },
  lr03: { width: 297, height: 300 },
  lr04: { width: 299, height: 300 },
  lr05: { width: 300, height: 297 },
  lr06: { width: 300, height: 299 },
  lr07: { width: 300, height: 300 },
  lr08: { width: 300, height: 300 },
  lr09: { width: 295, height: 300 },
  lr10: { width: 296, height: 300 },
  lr11: { width: 299, height: 300 },
  lr12: { width: 300, height: 295 },
  lr13: { width: 287, height: 300 },
  lr14: { width: 297, height: 299 },
  lr15: { width: 297, height: 300 },
  lr16: { width: 280, height: 286 },
  lr17: { width: 283, height: 285 },
  lr18: { width: 300, height: 299 },
  lr19: { width: 285, height: 287 },
  lr20: { width: 294, height: 300 },
} as const;

export type PlateName = keyof typeof plates;

export const fleurons = ["f01", "f02", "f03", "f05", "f06", "f09", "f10", "f15"] as const;

export const bandeaux = ["b01", "b02", "b04", "b05", "b06", "b07"] as const;

export const lettrines = {
  A: "lr01",
  B: "lr02",
  C: "lr03",
  D: "lr04",
  E: "lr05",
  F: "lr06",
  G: "lr07",
  H: "lr08",
  I: "lr09",
  L: "lr10",
  M: "lr11",
  N: "lr12",
  O: "lr13",
  P: "lr14",
  Q: "lr15",
  R: "lr16",
  S: "lr17",
  T: "lr18",
  V: "lr19",
  Z: "lr20",
} as const;
