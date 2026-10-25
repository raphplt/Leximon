"use client";

import type { CatalogCard } from "@leximon/contract";
import { collectionName } from "@leximon/contract/client";
import { formatOdds } from "@leximon/view-model";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback } from "react";
import { adminApi } from "@/admin/admin-api";
import { loadCatalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import { EngravingCredit } from "@/components/engraving-credit";
import { RarityName } from "@/components/rarity-icon";
import styles from "./admin.module.css";
import { formatNumber } from "./format";
import { useLoad } from "./use-load";

/** The card of the address `/admin/cartes/[id]`. */
export function CardFromAddress() {
  const params = useParams<{ id: string }>();
  return <CardScreen id={decodeURIComponent(params.id)} />;
}

function CardScreen({ id }: { readonly id: string }) {
  const { state } = useLoad(loadCatalog);
  const card = state.kind === "ready" ? (state.data.cardsById.get(id) ?? null) : null;
  return (
    <>
      <p>
        <Link href="/admin/cartes">← Cartes</Link>
      </p>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>Le catalogue ne se charge pas.</p>}
      {state.kind === "ready" && card === null && (
        <p className={styles.error}>Cette carte n'est pas dans le catalogue publié.</p>
      )}
      {state.kind === "ready" && card !== null && (
        <CardDetail card={card} collection={collectionName(state.data, card.collectionId)} />
      )}
    </>
  );
}

function CardDetail({
  card,
  collection,
}: {
  readonly card: CatalogCard;
  readonly collection: string;
}) {
  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>{card.word}</h1>
        <RarityName rarity={card.rarity} />
      </div>
      <div className={styles.cardLayout}>
        <div className={styles.cardFace}>
          <Card card={card} collectionName={collection} width={300} />
          <EngravingCredit card={card} />
          {(card.engraving ?? null) === null && (
            <p className={styles.muted}>Pas encore de gravure : la carte montre son initiale.</p>
          )}
        </div>
        <div className={styles.form}>
          <dl className={styles.facts}>
            <dt>Identifiant</dt>
            <dd className={styles.mono}>{card.id}</dd>
            <dt>Collection</dt>
            <dd>{collection}</dd>
            <dt>Nature</dt>
            <dd>{card.partOfSpeech}</dd>
            <dt>Époque</dt>
            <dd>{card.era ?? "–"}</dd>
            <dt>Définition</dt>
            <dd>{card.definition}</dd>
            <dt>Étymologie</dt>
            <dd>{card.etymology ?? "–"}</dd>
            <dt>Citation</dt>
            <dd>{card.quote === null ? "–" : `« ${card.quote.text} » (${card.quote.author})`}</dd>
            <dt>Thèmes</dt>
            <dd>{card.themes.length === 0 ? "–" : card.themes.join(", ")}</dd>
            <dt>Fréquence</dt>
            <dd>{formatOdds(card.perBillion)}</dd>
          </dl>
          <CardStats id={card.id} />
        </div>
      </div>
    </>
  );
}

function CardStats({ id }: { readonly id: string }) {
  const fetcher = useCallback(() => adminApi.fetchCardStats(id), [id]);
  const { state } = useLoad(fetcher);
  if (state.kind === "loading") return <p className={styles.muted}>Chargement des chiffres…</p>;
  if (state.kind === "failed") return <p className={styles.error}>{state.message}</p>;
  if (state.data === null) {
    return (
      <p className={styles.muted}>
        Le serveur ne connaît pas encore cette carte : publie le catalogue dans sa base.
      </p>
    );
  }
  const { owners, copies, mastery, retired } = state.data;
  return (
    <>
      {retired && <p className={styles.badgeWarn}>Retirée : elle ne sort plus des plis.</p>}
      <div className={styles.stats}>
        <Figure label="Détenteurs" value={owners} note={`${formatNumber(copies)} exemplaires`} />
        <Figure
          label="Joueurs qui l'apprennent"
          value={mastery.learners}
          note={`${formatNumber(mastery.ink)} à l'encre · ${formatNumber(mastery.gilded)} dorés`}
        />
      </div>
    </>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: number;
  readonly note: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{formatNumber(value)}</span>
      <span className={styles.statNote}>{note}</span>
    </div>
  );
}
