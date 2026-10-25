"use client";

import type { ProfileClan, ProfileStats } from "@leximon/contract";
import { collectionName } from "@leximon/contract/client";
import {
  formatPlayerCode,
  memberSinceLabel,
  profileHeadline,
  statTiles,
} from "@leximon/view-model";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { Emblem } from "@/clan/emblem";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { useNarrow } from "@/lib/use-narrow";
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
  readonly clan: ProfileClan | null;
  /** Where the clan's name leads: the player's own clan page, else nowhere. */
  readonly clanHref?: string;
}

/** The profile's banner: avatar in its frame, pseudo, title, level, clan, code. */
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
          {face.clan !== null && <ClanLine clan={face.clan} href={face.clanHref} />}
          {subline.length > 0 && <p className={styles.subline}>{subline.join(" · ")}</p>}
        </div>
        {actions !== undefined && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}

function ClanLine({
  clan,
  href,
}: {
  readonly clan: ProfileClan;
  readonly href: string | undefined;
}) {
  const content = (
    <>
      <Emblem emblem={clan.emblem} size={28} level={clan.level} />
      <span>{clan.name}</span>
    </>
  );
  return href === undefined ? (
    <p className={styles.clan}>{content}</p>
  ) : (
    <Link href={href} className={styles.clan}>
      {content}
    </Link>
  );
}

/** Someone's pinned cards, as others see them (the player's own: `PinnedCardsEditor`). */
export function PinnedCards({
  pinned,
  onOpen,
}: {
  readonly pinned: readonly string[];
  readonly onOpen?: (cardId: string) => void;
}) {
  const catalog = useCatalog();
  const narrow = useNarrow();
  return (
    <section className={`${ui.panel} ${styles.panel}`} aria-labelledby="pinned-title">
      <div className={styles.panelHead}>
        <h2 id="pinned-title" className={`${ui.display} ${styles.panelTitle}`}>
          Cartes épinglées
        </h2>
      </div>
      {pinned.length === 0 ? (
        <p className={styles.muted}>Vitrine vide.</p>
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
                  width={narrow ? 130 : 150}
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
