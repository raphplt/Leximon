"use client";

import {
  APPEARANCE_PREVIEW_NOTE,
  APPEARANCE_PREVIEW_TITLE,
  APPEARANCE_TRYING,
  type Appearance,
} from "@leximon/view-model";
import { Avatar } from "@/components/avatar";
import { ProfileBanner } from "@/components/profile-banner";
import { LevelMedal } from "@/ui/level-bits";
import ui from "@/ui/ui.module.css";
import styles from "./appearance.module.css";

/** The profile card as others will see it, drawn from the draft: every choice shows here first. */
export function AppearancePreview({
  look,
  name,
  level,
  trying,
}: {
  readonly look: Appearance;
  readonly name: string;
  readonly level: number;
  /** A piece tried on rather than owned. */
  readonly trying: boolean;
}) {
  return (
    <figure className={styles.preview} aria-label={APPEARANCE_PREVIEW_TITLE}>
      <div className={styles.card} data-paper>
        <ProfileBanner
          banner={{ motif: look.bannerMotif, tint: look.bannerTint }}
          className={styles.cloth}
        />
        {trying && <span className={styles.trying}>{APPEARANCE_TRYING}</span>}
        <div className={styles.cardBody}>
          <Avatar
            avatar={look.avatar}
            frame={look.frame}
            size={96}
            label="Avatar"
            className={styles.cardAvatar}
          />
          <p className={`${ui.display} ${styles.cardName}`}>{name}</p>
          <p className={styles.cardHeadline}>
            <LevelMedal level={level} size={28} labelled />
            {look.title}
          </p>
        </div>
      </div>
      <figcaption className={styles.note}>{APPEARANCE_PREVIEW_NOTE}</figcaption>
    </figure>
  );
}
