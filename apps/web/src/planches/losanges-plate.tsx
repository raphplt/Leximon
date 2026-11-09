"use client";

import type { CatalogCard } from "@leximon/contract";
import { useMemo, useState } from "react";
import { Sachet } from "@/booster/sachet";
import { useCatalog } from "@/cards/use-catalog";
import { Card } from "@/components/card";
import { GiltCorners, Tooling } from "@/ui/ornaments";
import { Kicker, Leaf, Lettering, Toy } from "@/ui/toy";
import styles from "./losanges-plate.module.css";

type PaletteId = "acajou" | "nuit" | "velours" | "emeraude" | "ardoise" | "parchemin";
type CutId = "harlequin" | "square" | "grand" | "petit";
type ContrastId = "subtle" | "balanced" | "bold";

const DEFAULT_PALETTE = {
  id: "acajou" as const,
  label: "Acajou du cabinet",
  sub: "Bois chaud & cuir brun (retenu sur l'Album et l'accueil)",
  light: false,
};

const PALETTES: readonly {
  readonly id: PaletteId;
  readonly label: string;
  readonly sub: string;
  readonly light: boolean;
}[] = [
  DEFAULT_PALETTE,
  {
    id: "nuit",
    label: "Nuit d'encre",
    sub: "Bleu royal & ardoise nocturne (esprit Clash Royale)",
    light: false,
  },
  {
    id: "velours",
    label: "Velours cramoisi",
    sub: "Bordeaux profond & grenat d'écrin",
    light: false,
  },
  {
    id: "emeraude",
    label: "Drap d'émeraude",
    sub: "Vert de table & sapin sombre",
    light: false,
  },
  {
    id: "ardoise",
    label: "Ardoise & Or",
    sub: "Gris-bleu minéral & lueur ambrée",
    light: false,
  },
  {
    id: "parchemin",
    label: "Parchemin damassé",
    sub: "Ivoire chaud & crème (pour l'intérieur d'un feuillet)",
    light: true,
  },
];

const CUTS: readonly { readonly id: CutId; readonly label: string; readonly note: string }[] = [
  { id: "harlequin", label: "Losange classique (62 × 66)", note: "Presque carré, relief patiné" },
  { id: "square", label: "Losange carré (60 × 60)", note: "Coupe exacte à 45°" },
  { id: "grand", label: "Grand losange (84 × 90)", note: "Ample, idéal pour un fond de page" },
  { id: "petit", label: "Petit losange (42 × 45)", note: "Serré, idéal pour un encart" },
];

const CONTRASTS: readonly { readonly id: ContrastId; readonly label: string }[] = [
  { id: "subtle", label: "Subtil (velouté)" },
  { id: "balanced", label: "Équilibré" },
  { id: "bold", label: "Franc (arcade)" },
];

const SAMPLE_IDS = ["charivarieur", "orvietan", "coquefredouille", "pendardeau"] as const;

const DEFAULT_CARD: CatalogCard = {
  id: "charivarieur",
  word: "charivarieur",
  partOfSpeech: "n. m.",
  era: "XVIe s.",
  rarity: "rare",
  definition: "Celui qui donne un charivari, concert burlesque de casseroles et de huées.",
  etymology: null,
  quote: null,
  collectionId: "caracteres",
  themes: ["societe"],
  perBillion: 4,
};

const FALLBACK_CARDS: readonly CatalogCard[] = [
  DEFAULT_CARD,
  {
    id: "orvietan",
    word: "orviétan",
    partOfSpeech: "n. m.",
    era: "XVIIe s.",
    rarity: "precious",
    definition: "Remède universel que vendaient autrefois les charlatans sur les places.",
    etymology: null,
    quote: null,
    collectionId: "metiers",
    themes: ["medecine"],
    perBillion: 2,
  },
  {
    id: "coquefredouille",
    word: "coquefredouille",
    partOfSpeech: "n. m.",
    era: "XVIe s.",
    rarity: "epic",
    definition: "Homme sans esprit ni prestance, qui fait le beau sans en avoir l'étoffe.",
    etymology: null,
    quote: null,
    collectionId: "caracteres",
    themes: ["caracteres"],
    perBillion: 0.5,
  },
  {
    id: "pendardeau",
    word: "pendardeau",
    partOfSpeech: "n. m.",
    era: "XVIe s.",
    rarity: "legendary",
    definition: "Petit vaurien, jeune fripon qui mériterait déjà le gibet.",
    etymology: null,
    quote: null,
    collectionId: "caracteres",
    themes: ["caracteres"],
    perBillion: 0.1,
  },
];

export function LosangesPlate() {
  const catalog = useCatalog();
  const [palette, setPalette] = useState<PaletteId>("acajou");
  const [cut, setCut] = useState<CutId>("harlequin");
  const [contrast, setContrast] = useState<ContrastId>("balanced");
  const [lamp, setLamp] = useState(true);
  const [giltSeams, setGiltSeams] = useState(false);
  const [pageBg, setPageBg] = useState(false);

  const cards = useMemo(() => {
    if (!catalog) return FALLBACK_CARDS;
    const found = SAMPLE_IDS.flatMap((id) => {
      const card = catalog.cardsById.get(id);
      return card ? [card] : [];
    });
    return found.length >= 4 ? found : FALLBACK_CARDS;
  }, [catalog]);

  const currentPalette = PALETTES.find((item) => item.id === palette) ?? DEFAULT_PALETTE;

  return (
    <main
      className={styles.page}
      data-page-bg={pageBg || undefined}
      data-palette={palette}
      data-cut={cut}
      data-contrast={contrast}
      data-lamp={lamp || undefined}
      data-seams={giltSeams || undefined}
    >
      <header className={styles.header}>
        <Kicker>Planche R&D · Fonds à deux tons</Kicker>
        <h1 className={styles.title}>
          <Lettering>Losanges & damassés</Lettering>
        </h1>
        <p className={styles.intro}>
          Essais de fonds géométriques en losanges bicolores (façon Clash Royale, transposés dans
          les matières de la Bibliothèque). Tout est tracé en CSS pur par quatre dégradés obliques,
          sans image à charger.
        </p>
      </header>

      <Leaf className={styles.controls}>
        <GiltCorners />
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Teinte (2 couleurs)</span>
          <div className={styles.pills}>
            {PALETTES.map((item) => (
              <Toy
                key={item.id}
                matter={palette === item.id ? "gold" : "paper"}
                aria-pressed={palette === item.id}
                onClick={() => setPalette(item.id)}
                className={styles.pill}
              >
                <span className={styles.swatch} data-palette={item.id} aria-hidden="true" />
                {item.label}
              </Toy>
            ))}
          </div>
        </div>

        <div className={styles.controlRow}>
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Géométrie</span>
            <div className={styles.pills}>
              {CUTS.map((item) => (
                <Toy
                  key={item.id}
                  matter={cut === item.id ? "gold" : "paper"}
                  aria-pressed={cut === item.id}
                  onClick={() => setCut(item.id)}
                  className={styles.pill}
                >
                  {item.label}
                </Toy>
              ))}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Contraste des 2 tons</span>
            <div className={styles.pills}>
              {CONTRASTS.map((item) => (
                <Toy
                  key={item.id}
                  matter={contrast === item.id ? "gold" : "paper"}
                  aria-pressed={contrast === item.id}
                  onClick={() => setContrast(item.id)}
                  className={styles.pill}
                >
                  {item.label}
                </Toy>
              ))}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Finitions</span>
            <div className={styles.pills}>
              <Toy
                matter={lamp ? "gold" : "paper"}
                aria-pressed={lamp}
                onClick={() => setLamp((v) => !v)}
                className={styles.pill}
              >
                Halo & vignette
              </Toy>
              <Toy
                matter={giltSeams ? "gold" : "paper"}
                aria-pressed={giltSeams}
                onClick={() => setGiltSeams((v) => !v)}
                className={styles.pill}
              >
                Filets dorés
              </Toy>
              <Toy
                matter={pageBg ? "gold" : "paper"}
                aria-pressed={pageBg}
                onClick={() => setPageBg((v) => !v)}
                className={styles.pill}
              >
                Fond de page entier
              </Toy>
            </div>
          </div>
        </div>
      </Leaf>

      <section
        className={`${styles.stage} ${styles.diamondSurface}`}
        data-palette={palette}
        data-cut={cut}
        data-contrast={contrast}
        data-lamp={lamp || undefined}
        data-seams={giltSeams || undefined}
        data-light={currentPalette.light || undefined}
        aria-label="Aperçu grandeur nature"
      >
        <Tooling />
        <div className={styles.stageHead}>
          <div>
            <Kicker>{currentPalette.label}</Kicker>
            <h2 className={styles.stageTitle}>
              {currentPalette.light ? (
                <span>{currentPalette.sub}</span>
              ) : (
                <Lettering>{currentPalette.sub}</Lettering>
              )}
            </h2>
          </div>
          <span className={styles.badge}>
            {CUTS.find((c) => c.id === cut)?.note} · Contraste {contrast}
          </span>
        </div>

        <div className={styles.stageBody}>
          <div className={styles.stageSachet}>
            <Sachet
              collection={{ id: "fondateurs", name: "Les Fondateurs", back: "night" }}
              state="sealed"
              onTearStart={() => {}}
              onOpen={() => {}}
            />
          </div>
          <div className={styles.stageCards}>
            {cards.map((card) => (
              <div key={card.id} className={styles.cardSlot}>
                <Card
                  card={card}
                  collectionName={
                    catalog?.collections.find((c) => c.id === card.collectionId)?.name ??
                    "Les Fondateurs"
                  }
                  width={168}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.gallerySection} aria-labelledby="gallery-title">
        <div className={styles.galleryHeader}>
          <Kicker>Comparatif côte à côte</Kicker>
          <h2 id="gallery-title" className={styles.galleryTitle}>
            <Lettering>Les 6 palettes en un coup d'œil</Lettering>
          </h2>
          <p className={styles.gallerySub}>
            Clique sur une carte d'essai pour la charger dans l'atelier ci-dessus.
          </p>
        </div>

        <div className={styles.galleryGrid}>
          {PALETTES.map((item, index) => {
            const sampleCard = cards[index % cards.length] ?? DEFAULT_CARD;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.sampleTile} ${styles.diamondSurface}`}
                data-palette={item.id}
                data-cut={cut}
                data-contrast={contrast}
                data-lamp={lamp || undefined}
                data-seams={giltSeams || undefined}
                data-light={item.light || undefined}
                data-active={palette === item.id || undefined}
                onClick={() => setPalette(item.id)}
              >
                <Tooling />
                <div className={styles.sampleHead}>
                  <strong className={styles.sampleName}>{item.label}</strong>
                  <span className={styles.sampleNote}>{item.sub}</span>
                </div>
                <div className={styles.sampleCenter}>
                  <Card
                    card={sampleCard}
                    collectionName={
                      catalog?.collections.find((c) => c.id === sampleCard.collectionId)?.name ??
                      "Les Fondateurs"
                    }
                    width={142}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
