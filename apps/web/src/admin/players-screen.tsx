"use client";

import {
  type AdminPlayerKind,
  type AdminPlayerSummary,
  adminPlayerKindSchema,
} from "@leximon/contract";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Select } from "@/components/select";
import styles from "./admin.module.css";
import { adminErrorMessage, fetchPlayers } from "./admin-api";
import { formatDateTime } from "./format";

const KIND_LABELS: Readonly<Record<AdminPlayerKind, string>> = {
  member: "Comptes",
  guest: "Invités",
  banned: "Bannis",
  admin: "Admins",
};

export function PlayersScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = adminPlayerKindSchema.catch("member").parse(params.get("kind") ?? "member");
  const q = params.get("q") ?? "";
  const [draft, setDraft] = useState(q);
  const [players, setPlayers] = useState<readonly AdminPlayerSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setPlayers(null);
    setError(null);
    fetchPlayers({ q, kind })
      .then((page) => {
        if (!live) return;
        setPlayers(page.players);
        setCursor(page.nextCursor);
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      });
    return () => {
      live = false;
    };
  }, [q, kind]);

  const navigate = (next: { q?: string; kind?: AdminPlayerKind }) => {
    const query = new URLSearchParams();
    const nextKind = next.kind ?? kind;
    const nextQ = next.q ?? q;
    if (nextKind !== "member") query.set("kind", nextKind);
    if (nextQ !== "") query.set("q", nextQ);
    const text = query.toString();
    router.replace(text === "" ? pathname : `${pathname}?${text}`);
  };

  const search = (event: FormEvent) => {
    event.preventDefault();
    navigate({ q: draft.trim() });
  };

  const more = async () => {
    if (cursor === null) return;
    setBusy(true);
    try {
      const page = await fetchPlayers({ q, kind, cursor });
      setPlayers((current) => [...(current ?? []), ...page.players]);
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className={styles.title}>Joueurs</h1>
      <search>
        <form className={styles.toolbar} onSubmit={search}>
          <input
            className={`${styles.input} ${styles.grow}`}
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Adresse, code joueur ou identifiant"
            aria-label="Rechercher un joueur"
          />
          <Select<AdminPlayerKind>
            value={kind}
            onChange={(nextKind) => navigate({ kind: nextKind })}
            ariaLabel="Type de joueur"
            options={adminPlayerKindSchema.options.map((option) => ({
              value: option,
              label: KIND_LABELS[option],
            }))}
          />
          <button type="submit" className={styles.primary}>
            Rechercher
          </button>
        </form>
      </search>
      {error !== null && <p className={styles.error}>{error}</p>}
      {players === null && error === null && <p className={styles.muted}>Chargement…</p>}
      {players !== null && players.length === 0 && (
        <p className={styles.muted}>Aucun joueur ne correspond.</p>
      )}
      {players !== null && players.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Code</th>
                <th className={styles.num}>Niveau</th>
                <th>Statut</th>
                <th>Arrivé le</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <td>
                    <Link href={`/admin/joueurs/${encodeURIComponent(player.id)}`}>
                      {player.email ?? `Invité ${player.id.slice(0, 8)}`}
                    </Link>
                  </td>
                  <td className={styles.mono}>{player.playerCode ?? "–"}</td>
                  <td className={styles.num}>{player.level}</td>
                  <td>
                    <PlayerBadges player={player} />
                  </td>
                  <td>{formatDateTime(player.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor !== null && (
        <button type="button" className={styles.button} disabled={busy} onClick={() => void more()}>
          Afficher plus
        </button>
      )}
    </>
  );
}

export function PlayerBadges({ player }: { readonly player: AdminPlayerSummary }) {
  return (
    <span className={styles.toolbar}>
      {player.isGuest && <span className={styles.badge}>Invité</span>}
      {player.isAdmin && <span className={styles.badge}>Admin</span>}
      {player.banned && <span className={styles.badgeWarn}>Banni</span>}
      {!player.isGuest && !player.isAdmin && !player.banned && (
        <span className={styles.badge}>Compte</span>
      )}
    </span>
  );
}
