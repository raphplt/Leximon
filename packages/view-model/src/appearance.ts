import type { ProfileResponse, UpdateProfileRequest } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { type BannerItem, bannerItems } from "./banners";
import { ecusLabel } from "./ecus";
import { capitalize } from "./format";
import { LEAGUE_NAMES } from "./leagues";
import { type AtelierItem, atelierItems, type CosmeticTab } from "./profile";

/**
 * The atelier works on a draft, as a profile editor does: every choice shows at once on the
 * preview, nothing is worn until saved. A piece not yet owned may be tried on the preview; it
 * blocks the saving and says how to get it.
 */

export interface Appearance {
  readonly avatar: string;
  readonly frame: string;
  readonly title: string | null;
  readonly bannerMotif: string;
  readonly bannerTint: string;
}

type Wardrobe = Pick<
  ProfileResponse,
  "avatar" | "frame" | "title" | "level" | "wardrobe" | "banner"
>;

export function savedAppearance(profile: Wardrobe): Appearance {
  return {
    avatar: profile.avatar,
    frame: profile.frame,
    title: profile.title,
    bannerMotif: profile.banner.motif,
    bannerTint: profile.banner.tint,
  };
}

/** What to send to wear the draft: only what differs from the profile. */
export function appearanceChanges(profile: Wardrobe, draft: Appearance): UpdateProfileRequest {
  const saved = savedAppearance(profile);
  return Object.fromEntries(
    (Object.keys(draft) as (keyof Appearance)[])
      .filter((key) => draft[key] !== saved[key])
      .map((key) => [key, draft[key]]),
  );
}

export function isAppearanceChanged(profile: Wardrobe, draft: Appearance): boolean {
  return Object.keys(appearanceChanges(profile, draft)).length > 0;
}

/** The piece of each tab chosen in the draft. */
export function chosenIn(tab: CosmeticTab, draft: Appearance): string | null {
  switch (tab) {
    case "avatars":
      return draft.avatar;
    case "frames":
      return draft.frame;
    case "titles":
      return draft.title;
  }
}

export function withChoice(draft: Appearance, tab: CosmeticTab, id: string): Appearance {
  switch (tab) {
    case "avatars":
      return { ...draft, avatar: id };
    case "frames":
      return { ...draft, frame: id };
    case "titles":
      return { ...draft, title: id };
  }
}

/**
 * The items of a tab as the draft shows them: the one chosen is `worn` when it may be, a closed
 * one chosen stays closed and is `chosen` (tried on).
 */
export function draftItems<T extends { readonly state: string }>(
  items: readonly T[],
  isChosen: (item: T) => boolean,
): (T & { readonly chosen: boolean })[] {
  return items.map((item) => {
    const chosen = isChosen(item);
    const open = item.state === "worn" || item.state === "owned";
    const state = open ? (chosen ? "worn" : "owned") : item.state;
    return { ...item, state, chosen };
  });
}

function article(tab: CosmeticTab, item: AtelierItem): string {
  switch (tab) {
    case "avatars":
      return `l'avatar ${item.name}`;
    case "frames":
      return `le cadre ${item.name}`;
    case "titles":
      return `le titre « ${item.name} »`;
  }
}

const TRY_ONLY = "D'ici là, tu peux seulement l'essayer.";

function bannerBlock(item: BannerItem): AppearanceBlock | null {
  const named = `le motif ${item.name}`;
  switch (item.source.kind) {
    case "level":
      return {
        kind: "locked",
        text: `Tu gagnes ${named} au niveau ${item.source.level}. ${TRY_ONLY}`,
      };
    case "league":
      return {
        kind: "locked",
        text: `Tu gagnes ${named} en atteignant la ligue ${LEAGUE_NAMES[item.source.league]} aux joutes classées. ${TRY_ONLY}`,
      };
    case "collection":
      return {
        kind: "locked",
        text: `Tu gagnes ${named} en complétant une collection. ${TRY_ONLY}`,
      };
    case "ecus":
      return {
        kind: "for_sale",
        motif: item.motif,
        name: item.name,
        price: item.source.price,
        text: `${capitalize(named)} coûte ${ecusLabel(item.source.price)}. Achète-le pour le porter.`,
      };
    case "start":
      return null;
  }
}

/** Why the draft cannot be saved as it is: a piece tried on, or a motif to buy first. */
export type AppearanceBlock =
  | { readonly kind: "locked"; readonly text: string }
  | {
      readonly kind: "for_sale";
      readonly motif: string;
      readonly name: string;
      readonly price: number;
      readonly text: string;
    };

export function appearanceBlock(
  profile: Wardrobe,
  draft: Appearance,
  now: EpochMs,
): AppearanceBlock | null {
  for (const tab of ["avatars", "frames", "titles"] as const) {
    const id = chosenIn(tab, draft);
    const item = atelierItems(tab, profile, now).find((entry) => entry.id === id);
    if (item === undefined || item.state === "worn" || item.state === "owned") continue;
    return {
      kind: "locked",
      text:
        item.state === "in_coffret"
          ? `${capitalize(article(tab, item))} est dans ton coffret du niveau ${item.level}. Ouvre-le pour le porter.`
          : `Tu gagnes ${article(tab, item)} au niveau ${item.level}. ${TRY_ONLY}`,
    };
  }
  const motif = bannerItems(profile, now).find((item) => item.motif === draft.bannerMotif);
  if (motif !== undefined && (motif.state === "locked" || motif.state === "for_sale")) {
    return bannerBlock(motif);
  }
  return null;
}

export const APPEARANCE_PREVIEW_TITLE = "Aperçu";
export const APPEARANCE_PREVIEW_NOTE = "Ton profil tel que les autres le verront.";
export const APPEARANCE_TRYING = "Essai";
export const APPEARANCE_UNSAVED = "Tes changements ne sont pas encore enregistrés.";
export const APPEARANCE_SAVE = "Enregistrer";
export const APPEARANCE_SAVE_BUSY = "Enregistrement…";
export const APPEARANCE_RESET = "Annuler";
export const APPEARANCE_SAVED = "Apparence enregistrée.";

/** The button of a draft whose motif is for sale. */
export function appearanceBuyAction(block: Extract<AppearanceBlock, { kind: "for_sale" }>): string {
  return `Acheter, ${ecusLabel(block.price)}`;
}
