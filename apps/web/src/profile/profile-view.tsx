"use client";

import type { ProfileStats } from "@leximon/contract";
import {
  formatPlayerCode,
  memberSinceLabel,
  pinnedSlotsLabel,
  profileHeadline,
  statTiles,
} from "@leximon/view-model";
import Link from "next/link";
import type { ReactNode } from "react";
import { collectionName } from "@/cards/catalog";
import { useCatalog } from "@/cards/use-catalog";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { useNarrow } from "@/lib/use-narrow";
import { Icon } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
import styles from "./profile.module.css";

export interface ProfileFace {
  readonly name: string;
  readonly avatar: string;
  readonly frame: string;
  readonly title: string | null;
  readonly level: number;
  /** `null` on a private profile: only the pseudo and the avatar show. */
  readonly code: string | null;
  readonly memberSince: string | null;
}

/** The profile's banner: avatar in its frame, pseudo, title, level, code. */
export function ProfileHeader({
  face,
  actions,
}: {
  readonly face: ProfileFace;
  readonly actions?: ReactNode;
}) {
  const narrow = useNarrow();
  const subline = [
    face.code === null ? null : `Code joueur ${formatPlayerCode(face.code)}`,
    face.memberSince === null ? null : memberSinceLabel(face.memberSince),
  ].filter((part) => part !== null);
  return (
    <header className={styles.banner}>
      <div className={styles.bannerArt} aria-hidden="true" />
      <div className={styles.identity}>
        <Avatar
          avatar={face.avatar}
          frame={face.frame}
          size={narrow ? 92 : 116}
          label="Avatar"
          className={styles.bigAvatar}
        />
        <div className={styles.names}>
          <h1 className={`${ui.display} ${styles.name}`}>{face.name}</h1>
          {face.code !== null && (
            <p className={styles.headline}>{profileHeadline(face.title, face.level)}</p>
          )}
          {subline.length > 0 && <p className={styles.subline}>{subline.join(" · ")}</p>}
        </div>
        {actions !== undefined && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}

/** Pinned cards, and on the player's own profile the empty places left. */
export function PinnedCards({
  pinned,
  slots,
  onOpen,
}: {
  readonly pinned: readonly string[];
  /** The player's own places, shown empty; `null` on someone else's profile. */
  readonly slots: number | null;
  readonly onOpen?: (cardId: string) => void;
}) {
  const catalog = useCatalog();
  const empty = slots === null ? 0 : Math.max(0, slots - pinned.length);
  return (
    <section className={`${ui.panel} ${styles.panel}`} aria-labelledby="pinned-title">
      <div className={styles.panelHead}>
        <h2 id="pinned-title" className={`${ui.display} ${styles.panelTitle}`}>
          Cartes épinglées
        </h2>
        {slots !== null && <span className={styles.panelMeta}>{pinnedSlotsLabel(slots)}</span>}
      </div>
      {pinned.length === 0 && slots === null ? (
        <p className={styles.muted}>Rien d'épinglé pour l'instant.</p>
      ) : (
        <ul className={styles.pins}>
          {pinned.map((cardId, index) => {
            const card = catalog?.cardsById.get(cardId);
            const tilt = PIN_TILTS[index % PIN_TILTS.length];
            const face =
              card === undefined || catalog === null ? (
                <span className={styles.pinPlaceholder} />
              ) : (
                <Card
                  card={card}
                  collectionName={collectionName(catalog, card.collectionId)}
                  width={150}
                />
              );
            return (
              <li key={cardId} className={styles.pin} style={{ rotate: `${tilt}deg` }}>
                {onOpen === undefined ? (
                  face
                ) : (
                  <button
                    type="button"
                    className={styles.pinButton}
                    onClick={() => onOpen(cardId)}
                    aria-label={`Ouvrir ${card?.word ?? "la carte"}`}
                  >
                    {face}
                  </button>
                )}
              </li>
            );
          })}
          {Array.from({ length: empty }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: empty places have no identity
            <li key={`empty-${index}`} className={styles.pin}>
              <Link href="/album" className={styles.emptySlot}>
                <Icon name="pin" size={22} />
                <span>Épingle une carte depuis ton album</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const PIN_TILTS = [-3, 2, -1.5, 3, -2];

/** The profile in figures. */
export function StatsPanel({ stats }: { readonly stats: ProfileStats }) {
  const catalog = useCatalog();
  const tiles = statTiles(stats, catalog === null ? null : catalog.cardsById.size);
  return (
    <section className={`${ui.panel} ${styles.panel}`} aria-labelledby="stats-title">
      <h2 id="stats-title" className={`${ui.display} ${styles.panelTitle}`}>
        En chiffres
      </h2>
      <dl className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <dt className={styles.tileLabel}>{tile.label}</dt>
            <dd className={`${ui.display} ${styles.tileValue}`}>{tile.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
