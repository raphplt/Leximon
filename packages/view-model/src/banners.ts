import type { BannerPurchaseRefusal, ProfileBanner, ProfileResponse } from "@leximon/contract";
import {
  BANNER_SCHEDULE,
  type BannerSource,
  bannerCatalog,
  bannerRulesAt,
  type EpochMs,
} from "@leximon/core";
import { ecusLabel } from "./ecus";
import { LEAGUE_NAMES } from "./leagues";

/** The banner tab of the atelier: a tint, free, and a motif, earned or bought. */

const MOTIF_NAMES: Readonly<Record<string, string>> = {
  plain: "Toile unie",
  fleurons: "Semis de fleurons",
  scrolls: "Rinceaux",
  damask: "Damas",
  checky: "Échiqueté",
  quarterly: "Écartelé",
  cloth_of_gold: "Drap d'or",
  binding: "Reliure au fer",
  marbled: "Papier marbré",
  printer: "Pointillé d'imprimeur",
};

const TINT_NAMES: Readonly<Record<string, string>> = {
  bordeaux: "Bordeaux",
  bottle: "Vert bouteille",
  prussian: "Bleu de Prusse",
  leather: "Cuir",
  bishop: "Violet évêque",
  ochre: "Ocre",
  ink: "Encre",
  slate: "Ardoise",
};

export function bannerMotifName(id: string): string {
  return MOTIF_NAMES[id] ?? id;
}

export function bannerTintName(id: string): string {
  return TINT_NAMES[id] ?? id;
}

/** On a private profile and while a profile arrives: the cloth everyone starts with. */
export const PLAIN_BANNER: ProfileBanner = (() => {
  const rules = BANNER_SCHEDULE[BANNER_SCHEDULE.length - 1] ?? BANNER_SCHEDULE[0];
  return { motif: rules.startingMotif, tint: rules.tints[0] };
})();

export const BANNER_TINTS_TITLE = "Teinte";
export const BANNER_MOTIFS_TITLE = "Motif";

/** `for_sale`: not owned yet, bought with écus; `locked`: earned by playing. */
export type BannerState = "worn" | "owned" | "for_sale" | "locked";

export interface BannerItem {
  readonly motif: string;
  readonly name: string;
  readonly state: BannerState;
  readonly source: BannerSource;
}

export interface BannerTintItem {
  readonly tint: string;
  readonly name: string;
  readonly worn: boolean;
}

/** The tints, in the order of the rules, with the one worn. */
export function bannerTintItems(
  profile: Pick<ProfileResponse, "banner">,
  now: EpochMs,
): BannerTintItem[] {
  return bannerRulesAt(BANNER_SCHEDULE, now).tints.map((tint) => ({
    tint,
    name: bannerTintName(tint),
    worn: tint === profile.banner.tint,
  }));
}

/**
 * Every motif of the rules: the ones owned first, then the others, each in the order of the
 * rules. A motif owned under older rules stays, as started with.
 */
export function bannerItems(
  profile: Pick<ProfileResponse, "banner" | "wardrobe">,
  now: EpochMs,
): BannerItem[] {
  const owned = new Set(profile.wardrobe.banners);
  const catalog = bannerCatalog(bannerRulesAt(BANNER_SCHEDULE, now));
  const extra = [...owned]
    .filter((motif) => !catalog.some((entry) => entry.motif === motif))
    .map((motif) => ({ motif, source: { kind: "start" } as const }));
  const stateOf = (motif: string, source: BannerSource): BannerState => {
    if (motif === profile.banner.motif) return "worn";
    if (owned.has(motif)) return "owned";
    return source.kind === "ecus" ? "for_sale" : "locked";
  };
  const items = [...catalog, ...extra].map(({ motif, source }) => ({
    motif,
    name: bannerMotifName(motif),
    source,
    state: stateOf(motif, source),
  }));
  const isOwned = (item: BannerItem) => item.state === "worn" || item.state === "owned";
  return [...items.filter(isOwned), ...items.filter((item) => !isOwned(item))];
}

/** What gives a motif: « Niveau 30 », « Ligue Chevalier », « 250 écus ». */
export function bannerSourceLabel(source: BannerSource): string {
  switch (source.kind) {
    case "start":
      return "Dès le départ";
    case "level":
      return `Niveau ${source.level}`;
    case "league":
      return `Ligue ${LEAGUE_NAMES[source.league]}`;
    case "collection":
      return "Une collection complète";
    case "ecus":
      return ecusLabel(source.price);
  }
}

/** The label under a motif. */
export function bannerStateLabel(item: BannerItem): string {
  switch (item.state) {
    case "worn":
      return "Choisi";
    case "owned":
      return "Choisir";
    case "for_sale":
    case "locked":
      return bannerSourceLabel(item.source);
  }
}

/** Before a purchase: the price and what is left, or what is missing. */
export function bannerPurchaseConfirm(name: string, price: number, ecus: number): string {
  if (ecus < price) {
    return `${name} coûte ${ecusLabel(price)}. Il te manque ${ecusLabel(price - ecus)}.`;
  }
  return `${name} coûte ${ecusLabel(price)}. Il te restera ${ecusLabel(ecus - price)}. Le motif est à toi pour toujours.`;
}

export function bannerCanBuy(price: number, ecus: number): boolean {
  return ecus >= price;
}

export const BANNER_BUY_ACTION = "Oui, l'acheter";
export const BANNER_BUY_CANCEL = "Annuler";
export const BANNER_BUY_CLOSE = "Fermer";
export const BANNER_BUY_BUSY = "Achat…";
export const BANNER_BUY_FAILED = "Le motif n'a pas été acheté. Réessaie.";

export function bannerPurchaseRefusalMessage(reason: BannerPurchaseRefusal): string {
  switch (reason) {
    case "account_required":
      return "Crée d'abord un compte, ta partie y sera conservée.";
    case "not_for_sale":
      return "Ce motif ne s'achète pas.";
    case "already_owned":
      return "Tu as déjà ce motif.";
    case "not_enough_ecus":
      return "Tu n'as pas assez d'écus pour ce motif.";
  }
}
