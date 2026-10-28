"use client";

import {
  type AdminPlayerKind,
  type AdminPlayerRow,
  type AdminPlayerSort,
  type AdminPlayerSummary,
  adminPlayerKindSchema,
  adminPlayerSortSchema,
  type SortDirection,
  sortDirectionSchema,
} from "@leximon/contract";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { formatDateTime, formatNumber } from "./format";
import p from "./players.module.css";

const KIND_LABELS: Readonly<Record<AdminPlayerKind, string>> = {
  member: "Comptes",
  guest: "Invités",
  banned: "Bannis",
  admin: "Admins",
  all: "Tous",
};

/** The columns, in order; a column with a sort can be clicked. */
const COLUMNS: readonly {
  readonly label: string;
  readonly sort?: AdminPlayerSort;
  readonly numeric?: boolean;
}[] = [
  { label: "Joueur", sort: "pseudo" },
  { label: "Code" },
  { label: "Niveau", sort: "level", numeric: true },
  { label: "Cartes", sort: "cards", numeric: true },
  { label: "Sachets", sort: "boosters", numeric: true },
  { label: "Défis", sort: "answers", numeric: true },
  { label: "Jours", sort: "days", numeric: true },
  { label: "Dernière venue", sort: "lastDay" },
  { label: "Arrivé le", sort: "created" },
  { label: "Statut" },
];

/** Letters read from A to Z first; figures and dates, from the biggest or newest. */
const FIRST_DIRECTION: Readonly<Record<AdminPlayerSort, SortDirection>> = {
  pseudo: "asc",
  created: "desc",
  lastDay: "desc",
  level: "desc",
  cards: "desc",
  boosters: "desc",
  answers: "desc",
  days: "desc",
};

const DEFAULTS = { kind: "member", sort: "created", dir: "desc", q: "" } as const;

const SEARCH_DELAY_MS = 300;

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDay(day: string): string {
  return DAY_FORMAT.format(new Date(`${day}T00:00:00Z`));
}

interface View {
  readonly q: string;
  readonly kind: AdminPlayerKind;
  readonly sort: AdminPlayerSort;
  readonly dir: SortDirection;
}

/** Every player, searched, filtered and sorted from the address, so that a view can be shared. */
export function PlayersScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view: View = {
    q: params.get("q") ?? DEFAULTS.q,
    kind: adminPlayerKindSchema.catch(DEFAULTS.kind).parse(params.get("kind") ?? DEFAULTS.kind),
    sort: adminPlayerSortSchema.catch(DEFAULTS.sort).parse(params.get("sort") ?? DEFAULTS.sort),
    dir: sortDirectionSchema.catch(DEFAULTS.dir).parse(params.get("dir") ?? DEFAULTS.dir),
  };
  const { q, kind, sort, dir } = view;
  const [draft, setDraft] = useState(q);
  const [players, setPlayers] = useState<readonly AdminPlayerRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    adminApi
      .fetchPlayers({ q, kind, sort, dir })
      .then((page) => {
        if (!live) return;
        setPlayers(page.players);
        setTotal(page.total);
        setCursor(page.nextCursor);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [q, kind, sort, dir]);

  const navigate = (next: Partial<View>) => {
    const target = { ...view, ...next };
    const query = new URLSearchParams();
    for (const key of ["q", "kind", "sort", "dir"] as const) {
      if (target[key] !== DEFAULTS[key]) query.set(key, target[key]);
    }
    const text = query.toString();
    router.replace(text === "" ? pathname : `${pathname}?${text}`, { scroll: false });
  };

  // The list follows the search as it is typed, once the typing pauses.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the draft starts a search.
  useEffect(() => {
    const next = draft.trim();
    if (next === q) return;
    const timer = setTimeout(() => navigate({ q: next }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  const search = (event: FormEvent) => {
    event.preventDefault();
    navigate({ q: draft.trim() });
  };

  const sortBy = (column: AdminPlayerSort) => {
    if (column === sort) navigate({ dir: dir === "asc" ? "desc" : "asc" });
    else navigate({ sort: column, dir: FIRST_DIRECTION[column] });
  };

  const more = async () => {
    if (cursor === null) return;
    setBusy(true);
    try {
      const page = await adminApi.fetchPlayers({ q, kind, sort, dir, cursor });
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
      <div className={p.header}>
        <h1 className={styles.title}>Joueurs</h1>
        {players !== null && (
          <span className={p.count}>
            {formatNumber(total)} {total > 1 ? "joueurs" : "joueur"}
          </span>
        )}
      </div>
      <search>
        <form className={styles.toolbar} onSubmit={search}>
          <input
            className={`${styles.input} ${styles.grow}`}
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Pseudo, adresse, code joueur ou identifiant"
            aria-label="Rechercher un joueur"
          />
          <fieldset className={styles.segmented} aria-label="Type de joueur">
            {adminPlayerKindSchema.options.map((option) => (
              <button
                key={option}
                type="button"
                className={styles.segment}
                aria-pressed={kind === option}
                onClick={() => navigate({ kind: option })}
              >
                {KIND_LABELS[option]}
              </button>
            ))}
          </fieldset>
        </form>
      </search>
      {error !== null && <p className={styles.error}>{error}</p>}
      {players === null && error === null && <p className={styles.muted}>Chargement…</p>}
      {players !== null && players.length === 0 && (
        <p className={styles.muted}>Aucun joueur ne correspond.</p>
      )}
      {players !== null && players.length > 0 && (
        <div className={`${styles.tableWrap} ${p.list}`} data-busy={loading}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <SortHeader
                    key={column.label}
                    label={column.label}
                    numeric={column.numeric === true}
                    {...(column.sort === undefined
                      ? {}
                      : {
                          active: column.sort === sort ? dir : null,
                          onSort: () => sortBy(column.sort ?? DEFAULTS.sort),
                        })}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <PlayerLine key={player.id} player={player} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor !== null && (
        <button type="button" className={styles.button} disabled={busy} onClick={() => void more()}>
          Afficher plus ({formatNumber(players?.length ?? 0)} sur {formatNumber(total)})
        </button>
      )}
    </>
  );
}

function SortHeader({
  label,
  numeric,
  active,
  onSort,
}: {
  readonly label: string;
  readonly numeric: boolean;
  /** The direction when the list is sorted by this column, null when it is sorted by another. */
  readonly active?: SortDirection | null;
  readonly onSort?: () => void;
}) {
  const className = numeric ? styles.num : undefined;
  if (onSort === undefined) return <th className={className}>{label}</th>;
  const sorted = active !== null && active !== undefined;
  return (
    <th
      className={className}
      aria-sort={sorted ? (active === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" className={p.sort} data-active={sorted} onClick={onSort}>
        {label}
        <span className={p.arrow} aria-hidden="true">
          {active === "asc" ? "▲" : active === "desc" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
}

function PlayerLine({ player }: { readonly player: AdminPlayerRow }) {
  const href = `/admin/joueurs/${encodeURIComponent(player.id)}`;
  const name = playerName(player);
  const secondary = player.pseudo === null ? null : (player.email ?? "Invité");
  return (
    <tr>
      <td>
        <div className={p.who}>
          <Link href={href} className={player.pseudo === null ? p.unnamed : undefined}>
            {name}
          </Link>
          {secondary !== null && <span className={p.email}>{secondary}</span>}
        </div>
      </td>
      <td className={styles.mono}>{player.playerCode ?? "–"}</td>
      <td className={styles.num}>{player.level}</td>
      <td className={styles.num}>{formatNumber(player.cards)}</td>
      <td className={styles.num}>{formatNumber(player.boosters)}</td>
      <td className={styles.num}>{formatNumber(player.answers)}</td>
      <td className={styles.num}>{formatNumber(player.days)}</td>
      <td className={p.date}>{player.lastDay === null ? "–" : formatDay(player.lastDay)}</td>
      <td className={p.date}>{formatDateTime(player.createdAt)}</td>
      <td>
        <PlayerBadges player={player} />
      </td>
    </tr>
  );
}

/** How the back office names a player: their pseudo, else their address, else a short id. */
export function playerName(player: AdminPlayerSummary): string {
  return player.pseudo ?? player.email ?? `Invité ${player.id.slice(0, 8)}`;
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
