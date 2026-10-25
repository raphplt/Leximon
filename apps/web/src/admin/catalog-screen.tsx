"use client";

import { RARITY_LABELS } from "@leximon/contract";
import { RARITIES } from "@leximon/core";
import Link from "next/link";
import { adminApi } from "@/admin/admin-api";
import { RarityName } from "@/components/rarity-icon";
import styles from "./admin.module.css";
import { formatNumber } from "./format";
import { useLoad } from "./use-load";

export function CatalogScreen() {
  const { state } = useLoad(adminApi.fetchCatalog);
  return (
    <>
      <h1 className={styles.title}>Collections</h1>
      <p className={styles.muted}>
        Le catalogue tel que le serveur le tire. Les cartes se rédigent dans Directus, puis une
        nouvelle version se publie avec <code>pnpm catalog:publish</code>.
      </p>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Collection</th>
                <th>Publiée</th>
                <th className={styles.num}>Cartes</th>
                <th className={styles.num}>Retirées</th>
                {RARITIES.map((rarity) => (
                  <th key={rarity} className={styles.num} title={RARITY_LABELS[rarity]}>
                    <RarityName rarity={rarity} />
                  </th>
                ))}
                <th className={styles.num}>Collectionneurs</th>
              </tr>
            </thead>
            <tbody>
              {state.data.collections.map((collection) => (
                <tr key={collection.id}>
                  <td>
                    <div className={styles.collectionCell}>
                      <Link
                        href={`/admin/cartes?collection=${encodeURIComponent(collection.id)}&sort=collection`}
                        className={styles.collectionLink}
                      >
                        {collection.name}
                      </Link>
                      <span className={`${styles.muted} ${styles.mono}`}>{collection.id}</span>
                    </div>
                  </td>
                  <td>
                    {collection.published ? (
                      <span className={styles.badge}>Oui</span>
                    ) : (
                      <span className={styles.badgeWarn}>Non</span>
                    )}
                  </td>
                  <td className={styles.num}>{formatNumber(collection.cards)}</td>
                  <td className={styles.num}>{formatNumber(collection.retired)}</td>
                  {RARITIES.map((rarity) => {
                    const count = collection.byRarity[rarity] ?? 0;
                    return (
                      <td key={rarity} className={styles.num}>
                        {count > 0 ? formatNumber(count) : <span className={styles.muted}>0</span>}
                      </td>
                    );
                  })}
                  <td className={styles.num}>{formatNumber(collection.collectors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
