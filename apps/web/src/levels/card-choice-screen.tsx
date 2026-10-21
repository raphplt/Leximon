"use client";

import type { CatalogCard } from "@leximon/contract";
import { capitalize, choiceCount, choiceGroups, choiceRefusalMessage } from "@leximon/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { type Catalog, collectionName, loadCatalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import { RarityIcon } from "@/components/rarity-icon";
import { chooseCard, fetchOwnedCards } from "@/lib/api";
import { useNarrow } from "@/lib/use-narrow";
import { useNow } from "@/lib/use-now";
import { levelRewards, publishCardChosen } from "@/player/player";
import { useShared } from "@/player/resource";
import { Button, ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./card-choice.module.css";

type Load =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly catalog: Catalog; readonly owned: ReadonlySet<string> };

/**
 * The card of the player's choice (N-08, P58): every Courant and Peu courant card the player
 * lacks, by collection, with a search. Nothing is drawn: the player picks, the server checks.
 */
export function CardChoiceScreen() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<CatalogCard | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rewards = useShared(levelRewards);
  const now = useNow(60_000);
  const router = useRouter();
  const toast = useToast();

  const read = () => {
    setLoad({ kind: "loading" });
    Promise.all([loadCatalog(), fetchOwnedCards()])
      .then(([catalog, cards]) =>
        setLoad({
          kind: "ready",
          catalog,
          owned: new Set(cards.filter((c) => c.quantity > 0).map((c) => c.cardId)),
        }),
      )
      .catch(() => setLoad({ kind: "failed" }));
  };
  useEffect(read, []);

  const level = rewards?.cardChoices[0];

  const take = async () => {
    if (picked === null || level === undefined) return;
    setSending(true);
    setError(null);
    try {
      const result = await chooseCard(level, picked.id);
      if (result.kind === "refused") {
        setError(choiceRefusalMessage(result.reason));
        if (result.reason !== "card_not_choosable") levelRewards.refresh();
        return;
      }
      publishCardChosen(level);
      toast(`${capitalize(picked.word)} rejoint ton album !`);
      router.push("/album");
    } catch {
      setError("Le serveur lambine. Réessaie.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/niveaux" className={ui.round} aria-label="Retour au chemin des niveaux">
          <Icon name="back" size={20} />
        </Link>
        <div>
          <h1 className={`${ui.display} ${styles.title}`}>Carte au choix</h1>
          <p className={styles.subtitle}>
            {level === undefined
              ? " "
              : `Niveau ${level} · une Courante ou Peu courante, celle que tu veux`}
          </p>
        </div>
      </header>

      {rewards !== null && level === undefined ? (
        <div className={`${ui.panel} ${styles.empty}`}>
          <p className={styles.emptyText}>
            Pas de carte au choix en attente. Il en tombe une tous les 10 niveaux.
          </p>
          <ButtonLink href="/niveaux" variant="secondary">
            Voir le chemin des niveaux
          </ButtonLink>
        </div>
      ) : load.kind === "failed" ? (
        <div className={`${ui.panel} ${styles.empty}`}>
          <p className={styles.emptyText}>Le serveur lambine.</p>
          <Button variant="secondary" onClick={read}>
            Réessayer
          </Button>
        </div>
      ) : load.kind === "loading" || now === 0 || rewards === null ? (
        <div className={`${ui.panel} ${styles.skeleton}`} />
      ) : (
        <Choice
          catalog={load.catalog}
          owned={load.owned}
          search={search}
          onSearch={setSearch}
          picked={picked}
          onPick={(card) => {
            setPicked(card);
            setError(null);
          }}
          now={now}
          action={
            <>
              {error !== null && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <Button wide disabled={picked === null || sending} onClick={() => void take()}>
                {sending
                  ? "Envoi…"
                  : picked === null
                    ? "Choisis une carte"
                    : `Prendre ${capitalize(picked.word)}`}
              </Button>
            </>
          }
        />
      )}
    </main>
  );
}

function Choice({
  catalog,
  owned,
  search,
  onSearch,
  picked,
  onPick,
  now,
  action,
}: {
  readonly catalog: Catalog;
  readonly owned: ReadonlySet<string>;
  readonly search: string;
  readonly onSearch: (search: string) => void;
  readonly picked: CatalogCard | null;
  readonly onPick: (card: CatalogCard) => void;
  readonly now: number;
  readonly action: ReactNode;
}) {
  const narrow = useNarrow();
  const all = choiceGroups(catalog.collections, owned, "", now);
  const groups = choiceGroups(catalog.collections, owned, search, now);
  return (
    <div className={styles.layout}>
      <section className={styles.list} aria-label="Cartes à choisir">
        <div className={styles.searchRow}>
          <label className={styles.search}>
            <Icon name="search" size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Chercher un mot"
              aria-label="Chercher un mot"
            />
          </label>
          <span className={styles.count}>{choiceCount(all)}</span>
        </div>
        {groups.length === 0 && <p className={styles.emptyText}>Aucun mot de ce côté.</p>}
        {groups.map((group) => (
          <div key={group.collectionId} className={styles.group}>
            <h2 className={ui.kicker}>{group.name}</h2>
            <ul className={styles.tiles}>
              {group.cards.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    className={styles.tile}
                    aria-pressed={picked?.id === card.id}
                    onClick={() => onPick(card)}
                  >
                    <span className={styles[`gem_${card.rarity}`]}>
                      <RarityIcon rarity={card.rarity} size="14px" />
                    </span>
                    {card.word}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <aside className={`${ui.panel} ${styles.preview}`} aria-live="polite">
        {picked === null ? (
          <p className={styles.previewEmpty}>Touche un mot pour voir sa carte.</p>
        ) : (
          <div className={styles.previewCard}>
            <Card
              card={picked}
              collectionName={collectionName(catalog, picked.collectionId)}
              width={narrow ? 96 : 220}
            />
          </div>
        )}
        <div className={styles.previewAction}>{action}</div>
      </aside>
    </div>
  );
}
