"use client";

import type {
  ProfileBanner as Banner,
  ProfileClan,
  ProfileJousts,
  ProfileStats,
} from "@leximon/contract";
import { collectionName } from "@leximon/contract/client";
import {
  capitalize,
  formatPlayerCode,
  memberSinceLabel,
  PROFILE_JOUSTS_TITLE,
  profileJoustTiles,
  statTiles,
} from "@leximon/view-model";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { Emblem } from "@/clan/emblem";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { ProfileBanner } from "@/components/profile-banner";
import { Shield } from "@/jousts/league-pieces";
import { useNarrow } from "@/lib/use-narrow";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import { useToast } from "@/ui/toast";
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
  readonly banner: Banner;
  /** Where the clan's name leads, for a player in the game. */
  readonly clanHref?: string;
}

/** The profile's banner: avatar in its frame, pseudo and code, title, level, clan. */
export function ProfileHeader({
  face,
  actions,
}: {
  readonly face: ProfileFace;
  readonly actions?: ReactNode;
}) {
  const narrow = useNarrow();
  return (
    <header className={styles.banner}>
      <ProfileBanner banner={face.banner} className={styles.bannerArt} />
      <div className={styles.identity}>
        <Avatar
          avatar={face.avatar}
          frame={face.frame}
          size={narrow ? 92 : 116}
          label="Avatar"
          className={styles.bigAvatar}
        />
        <div className={styles.names}>
          <div className={styles.nameRow}>
            <h1 className={`${ui.display} ${styles.name}`}>{face.name}</h1>
            {face.code !== null && <CodeButton code={face.code} />}
          </div>
          {face.code !== null && (
            <p className={styles.headline}>
              <LevelMedal level={face.level} size={34} labelled />
              {face.title}
            </p>
          )}
          {face.clan !== null && <ClanLine clan={face.clan} href={face.clanHref} />}
        </div>
        {(face.memberSince !== null || actions !== undefined) && (
          <div className={styles.aside}>
            {face.memberSince !== null && (
              <p className={styles.since}>
                <Icon name="calendar" size={18} />
                {capitalize(memberSinceLabel(face.memberSince))}
              </p>
            )}
            {actions !== undefined && <div className={styles.actions}>{actions}</div>}
          </div>
        )}
      </div>
    </header>
  );
}

/** « #0N3E 2Q8N » beside the pseudo: a click copies the code, and the icon ticks for a moment. */
function CodeButton({ code }: { readonly code: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast("Code copié.");
    } catch {
      toast(`Copie impossible. Le code est ${formatPlayerCode(code)}.`);
    }
  };
  return (
    <button
      type="button"
      className={styles.codeButton}
      onClick={() => void copy()}
      title="Copier le code joueur"
      aria-label={`Copier le code joueur, ${code.split("").join(" ")}`}
    >
      #{formatPlayerCode(code)}
      <Icon name={copied ? "check" : "copier"} size={15} />
    </button>
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
        <p className={styles.muted}>Aucune carte épinglée.</p>
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

/** The ranked jousts: the league's shield and name, then the week and the jousts played. */
export function JoustsPanel({ jousts }: { readonly jousts: ProfileJousts }) {
  const { league, tiles } = profileJoustTiles(jousts);
  return (
    <section className={`${ui.panel} ${styles.panel}`} aria-labelledby="jousts-title">
      <div className={styles.joustsHead}>
        <Shield league={jousts.league} size={42} />
        <div>
          <h2 id="jousts-title" className={`${ui.display} ${styles.panelTitle}`}>
            {PROFILE_JOUSTS_TITLE}
          </h2>
          <p className={styles.joustsLeague}>{league}</p>
        </div>
      </div>
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
