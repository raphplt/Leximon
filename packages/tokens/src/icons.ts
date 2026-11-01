/**
 * The interface's icon set, drawn on a 24 px grid with a round 2 px stroke. Path data only, so that
 * the web (`<svg>`) and mobile (react-native-svg) draw the same geometry.
 */

export const iconGrid = 24;
export const iconStroke = 2;

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy}Z`;

export const icons = {
  sachet: "M6 3 H18 L17 6 L18 21 H6 L7 6Z M7 6 H17 M9.5 12.5 L12 10 L14.5 12.5 L12 15Z",
  album:
    "M4 5 C7 4 10 4.5 12 6 C14 4.5 17 4 20 5 V19 C17 18 14 18.5 12 20 C10 18.5 7 18 4 19Z M12 6 V20",
  defi: `${circle(12, 13, 8)} M12 13 L15.5 9.5 M9.5 2.5 H14.5 M12 2.5 V5`,
  echange: "M4 8 H18 L14.5 4.5 M20 16 H6 L9.5 19.5",
  clan: "M5 4 H19 V12 C19 16.5 15.5 19.5 12 21 C8.5 19.5 5 16.5 5 12Z M9 10.5 L11.2 12.7 L15.2 8.7",
  courrier: "M3.5 6 H20.5 V18 H3.5Z M3.5 6.5 L12 13 L20.5 6.5",
  chat: "M4 5 H20 V16 H11 L6.5 20 V16 H4Z M8 10.5 H8.01 M12 10.5 H12.01 M16 10.5 H16.01",
  joutes:
    "M4 4 L14.5 14.5 M20 4 L9.5 14.5 M4 4 H7.5 M4 4 V7.5 M20 4 H16.5 M20 4 V7.5 M12.5 16.5 L16.5 20.5 M11.5 16.5 L7.5 20.5 M15 13 L17.5 15.5 L15.5 17.5 M9 13 L6.5 15.5 L8.5 17.5",
  coffret:
    "M3.5 10 H20.5 V20 H3.5Z M4.5 10 C4.5 5.5 7 4 12 4 C17 4 19.5 5.5 19.5 10 M10 10 V13.5 H14 V10 M3.5 14 H10 M14 14 H20.5",
  reglages: `${circle(12, 12, 3)} M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7.1 7.1 M16.9 16.9 L18.7 18.7 M5.3 18.7 L7.1 16.9 M16.9 7.1 L18.7 5.3 ${circle(12, 12, 7)}`,
  profil: `${circle(12, 8.5, 4)} M4 21 C4.5 16 8 14 12 14 C16 14 19.5 16 20 21`,
  star: "M12 3 L14.6 8.6 L20.6 9.3 L16.1 13.4 L17.4 19.4 L12 16.4 L6.6 19.4 L7.9 13.4 L3.4 9.3 L9.4 8.6Z",
  lock: "M5.5 11 H18.5 V20.5 H5.5Z M8.5 11 V8 C8.5 5.5 10 4 12 4 C14 4 15.5 5.5 15.5 8 V11 M12 14.5 V17",
  check: "M5 12.5 L10 17.5 L19 7",
  close: "M6 6 L18 18 M18 6 L6 18",
  back: "M15 5 L8 12 L15 19",
  chev: "M9 5 L16 12 L9 19",
  chevd: "M6 9 L12 15 L18 9",
  search: `${circle(10.5, 10.5, 6)} M15 15 L20 20`,
  plus: "M12 5 V19 M5 12 H19",
  pin: "M9 3.5 H15 M10 3.5 V9.5 L6.5 13.5 H17.5 L14 9.5 V3.5 M12 13.5 V21",
  plume: "M20 4 C12 4 6.5 9 5.5 17 L4 20.5 M5.5 17 C11 17 16 13 20 4 M9 15 L13.5 10.5",
  bolt: "M13.5 2.5 L5 13.5 H11.5 L10.5 21.5 L19 10.5 H12.5Z",
  carte:
    "M7 3 H17 C18 3 19 4 19 5 V19 C19 20 18 21 17 21 H7 C6 21 5 20 5 19 V5 C5 4 6 3 7 3Z M12 8.5 L14 12 L12 15.5 L10 12Z",
  logout: "M14 4 H19 V20 H14 M10 8 L6 12 L10 16 M6 12 H15",
  share: "M12 3 V15 M7.5 7.5 L12 3 L16.5 7.5 M5 12 V20 H19 V12",
  clock: `${circle(12, 12, 9)} M12 7 V12 L15 14`,
  encre: "M7 10 H17 L18.5 20.5 H5.5Z M9 10 V6.5 H15 V10 M10.5 6.5 V3.5 H13.5 V6.5",
  palette:
    "M12 3 C17 3 21 6.5 21 11 C21 14 18.5 15 16.5 14.5 C14.5 14 13.5 15.5 14.5 17.5 C15.5 19.5 14 21 12 21 C7 21 3 17 3 12 C3 7 7 3 12 3Z M8 10 H8.01 M11.5 7 H11.51 M15.5 8 H15.51 M7.5 14 H7.51",
  flag: "M5 21 V4 M5 4 H17 L14.5 8 L17 12 H5",
  cle: `${circle(8, 16, 4.5)} M11.2 12.8 L20 4 M17 7 L20 10 M14.5 9.5 L17 12`,
  sound:
    "M4 9.5 H8 L13 5 V19 L8 14.5 H4Z M16.5 9 C17.8 10.5 17.8 13.5 16.5 15 M19 6.5 C21.5 9.5 21.5 14.5 19 17.5",
  soundOff: "M4 9.5 H8 L13 5 V19 L8 14.5 H4Z M16.5 9.5 L21 14.5 M21 9.5 L16.5 14.5",
  play: "M8 5 L19 12 L8 19Z",
  send: "M4 12 L20 4 L15 20 L11.5 13 Z M11.5 13 L20 4",
  dots: "M5.5 12 H5.51 M12 12 H12.01 M18.5 12 H18.51",
  crown: "M4 18 H20 M4 18 L3 7.5 L8.5 11.5 L12 5 L15.5 11.5 L21 7.5 L20 18",
  block: `${circle(12, 12, 8.5)} M6 6 L18 18`,
  amis: `${circle(9, 8.5, 3.5)} M2.5 20 C3 16 5.5 14 9 14 C12.5 14 15 16 15.5 20 M15 4.8 C17 5 18.5 6.6 18.5 8.5 C18.5 10.4 17 12 15 12.2 M17 14.3 C19.5 15 21 17 21.5 20`,
} as const;

export type IconName = keyof typeof icons;
