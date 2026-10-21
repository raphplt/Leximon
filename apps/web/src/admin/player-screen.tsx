"use client";

import type { AdminAction, AdminPlayerDetail } from "@leximon/contract";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useCallback, useState } from "react";
import { Select } from "@/components/select";
import styles from "./admin.module.css";
import { adminErrorMessage, banPlayer, fetchPlayer, grantBonus, unbanPlayer } from "./admin-api";
import {
  ACTION_LABELS,
  actionSummary,
  formatDateTime,
  formatNumber,
  rarityBreakdown,
} from "./format";
import { PlayerBadges } from "./players-screen";
import { useLoad } from "./use-load";

/** The player of the address `/admin/joueurs/[id]`. */
export function PlayerFromAddress() {
  const params = useParams<{ id: string }>();
  return <PlayerScreen id={decodeURIComponent(params.id)} />;
}

function PlayerScreen({ id }: { readonly id: string }) {
  const fetcher = useCallback(() => fetchPlayer(id), [id]);
  const { state, reload } = useLoad(fetcher);
  return (
    <>
      <p>
        <Link href="/admin/joueurs">← Joueurs</Link>
      </p>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && <PlayerDetail detail={state.data} onChange={reload} />}
    </>
  );
}

function PlayerDetail({
  detail,
  onChange,
}: {
  readonly detail: AdminPlayerDetail;
  readonly onChange: () => void;
}) {
  const { player, wallet, progress, collection, mastery, opens, trades } = detail;
  const archived = player.archivedInto !== null;
  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>{player.email ?? `Invité ${player.id.slice(0, 8)}`}</h1>
        <PlayerBadges player={player} />
      </div>
      <dl className={styles.facts}>
        <dt>Identifiant</dt>
        <dd className={styles.mono}>{player.id}</dd>
        <dt>Code joueur</dt>
        <dd className={styles.mono}>{player.playerCode ?? "–"}</dd>
        <dt>Arrivé le</dt>
        <dd>{formatDateTime(player.createdAt)}</dd>
        {archived && (
          <>
            <dt>Partie reprise par</dt>
            <dd>
              <Link href={`/admin/joueurs/${encodeURIComponent(player.archivedInto ?? "")}`}>
                {player.archivedInto}
              </Link>
            </dd>
          </>
        )}
        {player.banned && (
          <>
            <dt>Motif du bannissement</dt>
            <dd>{player.banReason ?? "–"}</dd>
            <dt>Jusqu'au</dt>
            <dd>
              {player.banExpires === null ? "sans limite" : formatDateTime(player.banExpires)}
            </dd>
          </>
        )}
      </dl>

      <div className={styles.stats}>
        <Figure label="Niveau" value={progress.level} note={`${formatNumber(progress.xp)} XP`} />
        <Figure
          label="Plis en stock"
          value={wallet.stored}
          note={
            wallet.nextRefillAt === null
              ? `plein (${wallet.capacity})`
              : `sur ${wallet.capacity}, prochain le ${formatDateTime(wallet.nextRefillAt)}`
          }
        />
        <Figure label="Plis bonus" value={wallet.bonus} note={`réserve max ${wallet.bonusCap}`} />
        <Figure label="Plis ouverts" value={opens.total} />
        <Figure
          label="Cartes distinctes"
          value={collection.distinctCards}
          note={`${formatNumber(collection.copies)} exemplaires`}
        />
        <Figure
          label="Mots maîtrisés"
          value={mastery.words}
          note={`${formatNumber(mastery.ink)} à l'encre · ${formatNumber(mastery.gilded)} dorés`}
        />
        <Figure
          label="Échanges"
          value={trades.total}
          note={`${formatNumber(trades.pending)} en attente`}
        />
      </div>
      <p className={styles.muted}>Collection : {rarityBreakdown(collection.byRarity)}</p>

      {!archived && (
        <div className={styles.grid2}>
          <BonusForm detail={detail} onChange={onChange} />
          {player.banned ? (
            <UnbanForm id={player.id} onChange={onChange} />
          ) : (
            <BanForm id={player.id} disabled={player.isAdmin} onChange={onChange} />
          )}
        </div>
      )}

      <section className={styles.panel}>
        <h2 className={styles.subtitle}>Derniers plis ouverts</h2>
        {opens.recent.length === 0 ? (
          <p className={styles.muted}>Aucun.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Collection</th>
                  <th>Origine</th>
                </tr>
              </thead>
              <tbody>
                {opens.recent.map((open) => (
                  <tr key={open.openedAt}>
                    <td>{formatDateTime(open.openedAt)}</td>
                    <td className={styles.mono}>{open.collectionId ?? "–"}</td>
                    <td>{open.fromBonus ? "bonus" : "stock"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.subtitle}>Actions de l'équipe sur ce joueur</h2>
        <ActionsTable actions={detail.actions} showTarget={false} />
      </section>
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
  readonly note?: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{formatNumber(value)}</span>
      {note !== undefined && <span className={styles.statNote}>{note}</span>}
    </div>
  );
}

type FormStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "busy" }
  | { readonly kind: "done"; readonly message: string }
  | { readonly kind: "failed"; readonly message: string };

function StatusLine({ status }: { readonly status: FormStatus }) {
  if (status.kind === "done") return <p className={styles.success}>{status.message}</p>;
  if (status.kind === "failed") return <p className={styles.error}>{status.message}</p>;
  return null;
}

function BonusForm({
  detail,
  onChange,
}: {
  readonly detail: AdminPlayerDetail;
  readonly onChange: () => void;
}) {
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  // Kept until the server answers: a retry after a lost answer never gives twice.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const room = Math.max(0, detail.wallet.bonusCap - detail.wallet.bonus);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const key = pendingKey ?? crypto.randomUUID();
    setPendingKey(key);
    setStatus({ kind: "busy" });
    try {
      const result = await grantBonus(detail.player.id, amount, reason.trim(), key);
      setPendingKey(null);
      setReason("");
      setStatus({
        kind: "done",
        message:
          result.added === amount
            ? `${result.added} pli(s) offert(s). Réserve : ${result.bonus}.`
            : `Réserve pleine : ${result.added} pli(s) ajouté(s) sur ${amount}. Réserve : ${result.bonus}.`,
      });
      onChange();
    } catch (error) {
      setStatus({ kind: "failed", message: adminErrorMessage(error) });
    }
  };

  return (
    <form className={`${styles.panel} ${styles.form}`} onSubmit={(event) => void submit(event)}>
      <h2 className={styles.subtitle}>Offrir des plis bonus</h2>
      <p className={styles.muted}>
        Ils vont dans la réserve bonus, plafonnée à {detail.wallet.bonusCap} (place libre : {room}).
      </p>
      <div className={styles.row}>
        <label className={styles.field}>
          Nombre
          <input
            className={styles.input}
            type="number"
            min={1}
            max={10}
            value={amount}
            onChange={(event) => {
              setAmount(Math.min(10, Math.max(1, Number(event.target.value) || 1)));
              setPendingKey(null);
            }}
          />
        </label>
        <label className={`${styles.field} ${styles.grow}`}>
          Motif (visible dans le journal)
          <input
            className={styles.input}
            value={reason}
            maxLength={200}
            required
            onChange={(event) => {
              setReason(event.target.value);
              setPendingKey(null);
            }}
            placeholder="Geste après un incident, gagnant d'un concours…"
          />
        </label>
      </div>
      <button
        type="submit"
        className={styles.primary}
        disabled={status.kind === "busy" || reason.trim() === ""}
      >
        Offrir
      </button>
      <StatusLine status={status} />
    </form>
  );
}

function BanForm({
  id,
  disabled,
  onChange,
}: {
  readonly id: string;
  readonly disabled: boolean;
  readonly onChange: () => void;
}) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const label = days === "" ? "sans limite" : `pour ${days} jour(s)`;
    if (!window.confirm(`Bannir ce joueur ${label} ? Ses sessions seront fermées.`)) return;
    setStatus({ kind: "busy" });
    try {
      await banPlayer(id, { reason: reason.trim(), days: days === "" ? null : Number(days) });
      setStatus({ kind: "done", message: "Joueur banni." });
      onChange();
    } catch (error) {
      setStatus({ kind: "failed", message: adminErrorMessage(error) });
    }
  };

  return (
    <form className={`${styles.panel} ${styles.form}`} onSubmit={(event) => void submit(event)}>
      <h2 className={styles.subtitle}>Bannir</h2>
      {disabled ? (
        <p className={styles.muted}>
          Un admin ne peut pas être banni. Retire d'abord son rôle avec{" "}
          <code>pnpm admin:grant --revoke</code>.
        </p>
      ) : (
        <>
          <p className={styles.muted}>
            Le joueur ne peut plus se connecter ; une session déjà ouverte peut durer jusqu'à cinq
            minutes.
          </p>
          <div className={styles.row}>
            <div className={styles.field}>
              Durée
              <Select
                value={days}
                onChange={setDays}
                ariaLabel="Durée"
                options={[
                  { value: "1", label: "1 jour" },
                  { value: "7", label: "7 jours" },
                  { value: "30", label: "30 jours" },
                  { value: "365", label: "1 an" },
                  { value: "", label: "Sans limite" },
                ]}
              />
            </div>
            <label className={`${styles.field} ${styles.grow}`}>
              Motif
              <input
                className={styles.input}
                value={reason}
                maxLength={200}
                required
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </div>
          <button
            type="submit"
            className={styles.danger}
            disabled={status.kind === "busy" || reason.trim() === ""}
          >
            Bannir
          </button>
          <StatusLine status={status} />
        </>
      )}
    </form>
  );
}

function UnbanForm({ id, onChange }: { readonly id: string; readonly onChange: () => void }) {
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const lift = async () => {
    setStatus({ kind: "busy" });
    try {
      await unbanPlayer(id);
      setStatus({ kind: "done", message: "Bannissement levé." });
      onChange();
    } catch (error) {
      setStatus({ kind: "failed", message: adminErrorMessage(error) });
    }
  };
  return (
    <div className={`${styles.panel} ${styles.form}`}>
      <h2 className={styles.subtitle}>Bannissement</h2>
      <p className={styles.muted}>Le joueur pourra de nouveau se connecter.</p>
      <button
        type="button"
        className={styles.primary}
        disabled={status.kind === "busy"}
        onClick={() => void lift()}
      >
        Lever le bannissement
      </button>
      <StatusLine status={status} />
    </div>
  );
}

export function ActionsTable({
  actions,
  showTarget,
}: {
  readonly actions: readonly AdminAction[];
  readonly showTarget: boolean;
}) {
  if (actions.length === 0) return <p className={styles.muted}>Aucune action.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Détail</th>
            {showTarget && <th>Joueur</th>}
            <th>Par</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => (
            <tr key={action.id}>
              <td>{formatDateTime(action.createdAt)}</td>
              <td>{ACTION_LABELS[action.action] ?? action.action}</td>
              <td>{actionSummary(action.details)}</td>
              {showTarget && (
                <td>
                  {action.targetUserId === null ? (
                    "–"
                  ) : (
                    <Link href={`/admin/joueurs/${encodeURIComponent(action.targetUserId)}`}>
                      {action.targetUserId.slice(0, 8)}
                    </Link>
                  )}
                </td>
              )}
              <td>{action.adminEmail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
