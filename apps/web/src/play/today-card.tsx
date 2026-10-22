"use client";

import { capitalize, dailyView, SLIPPING_AWAY } from "@leximon/view-model";
import Link from "next/link";
import { type CSSProperties, useEffect, useState } from "react";
import { type Catalog, collectionName } from "@/cards/catalog";
import { Card } from "@/components/card";
import { fetchChallenges } from "@/lib/api";
import { dailyChallenge } from "@/player/collection";
import { useShared } from "@/player/resource";
import { useShell } from "@/shell/shell-context";
import { usePlayerView } from "@/shell/use-player-view";
import { ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import styles from "./play.module.css";

/**
 * What the day holds beside the counter: the daily challenge, the word slipping away, the mail.
 * On a phone, the floating buttons carry the challenge and the mail: only the word remains.
 */
export function TodayCard({ catalog }: { readonly catalog: Catalog | null }) {
  const view = usePlayerView();
  const { openMail } = useShell();
  const daily = useShared(dailyChallenge);
  const challenge = daily === null ? null : dailyView(daily);
  return (
    <section className={styles.today} aria-label="Aujourd'hui">
      <h2 className={styles.cardKicker}>Aujourd'hui</h2>
      <Link href="/defis" className={styles.todayRow}>
        <span
          className={styles.todayRing}
          style={{ "--done": `${Math.round((challenge?.ratio ?? 0) * 360)}deg` } as CSSProperties}
        >
          <Icon name="defi" size={20} />
        </span>
        <span className={styles.todayText}>
          <span className={styles.todayTitle}>Défi du jour</span>
          {challenge !== null && <span className={styles.todayDetail}>{challenge.text}</span>}
        </span>
      </Link>
      {catalog !== null && <SlippingWord catalog={catalog} />}
      <button type="button" className={styles.todayRow} onClick={openMail}>
        <span className={styles.todayIcon}>
          <Icon name="courrier" size={20} />
          {view.mail > 0 && <span className={styles.todayBadge}>{view.mail}</span>}
        </span>
        <span className={styles.todayText}>
          <span className={styles.todayTitle}>Courrier</span>
          <span className={styles.todayDetail}>
            {view.mail > 0 ? `${view.mail} en attente` : "Rien dans la boîte"}
          </span>
        </span>
      </button>
    </section>
  );
}

/** The word most at risk of being forgotten; nothing when no word is due. */
function SlippingWord({ catalog }: { readonly catalog: Catalog }) {
  const [cardId, setCardId] = useState<string | null>(null);
  useEffect(() => {
    fetchChallenges(1)
      .then((challenges) => setCardId(challenges.questions[0]?.cardId ?? null))
      .catch(() => undefined);
  }, []);
  const card = cardId === null ? undefined : catalog.cardsById.get(cardId);
  if (card === undefined) return null;
  return (
    <div className={styles.slipping}>
      <span className={styles.slippingCard}>
        <Card card={card} collectionName={collectionName(catalog, card.collectionId)} width={46} />
      </span>
      <div className={styles.slippingBody}>
        <p className={styles.slippingText}>
          <em>{capitalize(card.word)}</em>
          {SLIPPING_AWAY.after}
        </p>
        <ButtonLink href="/defis" variant="secondary" small>
          {SLIPPING_AWAY.action}
        </ButtonLink>
      </div>
    </div>
  );
}
