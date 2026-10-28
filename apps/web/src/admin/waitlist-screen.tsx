"use client";

import {
  type AdminWaitlistInviteRequest,
  type AdminWaitlistInviteResponse,
  type AdminWaitlistOpening,
  type AdminWaitlistResponse,
  MAX_WAITLIST_INVITES,
  WAITLIST_INVITE_SUBJECT,
} from "@leximon/contract";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { STATUS_LABELS } from "./campaigns-screen";
import { formatDateTime, formatNumber } from "./format";

type Entry = AdminWaitlistResponse["entries"][number];

export function WaitlistScreen() {
  const [total, setTotal] = useState<number | null>(null);
  const [invitable, setInvitable] = useState(0);
  const [opening, setOpening] = useState<AdminWaitlistOpening | null>(null);
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `nonce` asks for a fresh read.
  useEffect(() => {
    let live = true;
    adminApi
      .fetchWaitlist()
      .then((page) => {
        if (!live) return;
        setTotal(page.total);
        setInvitable(page.invitable);
        setOpening(page.opening);
        setEntries(page.entries);
        setCursor(page.nextCursor);
        setChosen(new Set());
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      });
    return () => {
      live = false;
    };
  }, [nonce]);

  const more = async () => {
    if (cursor === null) return;
    setBusy(true);
    try {
      const page = await adminApi.fetchWaitlist(cursor);
      setEntries((current) => [...current, ...page.entries]);
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await adminApi.downloadWaitlist();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `liste-attente-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (email: string) => {
    setChosen((current) => {
      const next = new Set(current);
      if (!next.delete(email)) next.add(email);
      return next;
    });
  };

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.muted}>
          Adresses laissées sur la page d'accueil. Chaque export est inscrit au journal.
        </p>
        <button
          type="button"
          className={styles.button}
          disabled={busy || total === 0}
          onClick={() => void download()}
        >
          Exporter en CSV
        </button>
      </div>
      {error !== null && <p className={styles.error}>{error}</p>}
      {total === null && error === null && <p className={styles.muted}>Chargement…</p>}
      {total !== null && (
        <InvitePanel
          invitable={invitable}
          chosen={[...chosen]}
          onInvited={() => setNonce((n) => n + 1)}
        />
      )}
      {opening !== null && total !== null && (
        <OpeningPanel
          opening={opening}
          total={total}
          onErased={(erasedAt) => {
            setTotal(0);
            setEntries([]);
            setCursor(null);
            setOpening({ ...opening, erasedAt });
          }}
        />
      )}
      {total !== null && (
        <>
          <p>
            <strong>{formatNumber(total)}</strong> inscrit(s).
          </p>
          {entries.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th aria-label="Choisir" />
                    <th>Adresse</th>
                    <th>Inscrit le</th>
                    <th>Invitation</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.email}>
                      <td>
                        {entry.invitedAt === null && !entry.hasAccount && (
                          <input
                            type="checkbox"
                            aria-label={`Choisir ${entry.email}`}
                            checked={chosen.has(entry.email)}
                            onChange={() => toggle(entry.email)}
                          />
                        )}
                      </td>
                      <td>{entry.email}</td>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td>
                        {entry.invitedAt !== null ? (
                          <>Invitée le {formatDateTime(entry.invitedAt)}</>
                        ) : entry.hasAccount ? (
                          <span className={styles.muted}>Déjà un compte</span>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cursor !== null && (
            <button
              type="button"
              className={styles.button}
              disabled={busy}
              onClick={() => void more()}
            >
              Afficher plus
            </button>
          )}
        </>
      )}
    </>
  );
}

/**
 * Sends the invitation e-mail to the oldest addresses left, or to the ones ticked in the list.
 * The server builds the link (one place per address) and launches the campaign that carries it.
 */
function InvitePanel({
  invitable,
  chosen,
  onInvited,
}: {
  readonly invitable: number;
  readonly chosen: readonly string[];
  readonly onInvited: () => void;
}) {
  const [count, setCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AdminWaitlistInviteResponse | null>(null);
  const max = Math.min(invitable, MAX_WAITLIST_INVITES);
  // Asking for more than are left invites those left.
  const oldest = Math.min(Number(count), max);
  const validCount = Number.isInteger(oldest) && oldest >= 1;

  const invite = async (request: AdminWaitlistInviteRequest, size: number) => {
    if (
      !window.confirm(
        `Envoyer l'invitation à ${formatNumber(size)} adresse(s) ? L'e-mail part tout de suite.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setDone(await adminApi.inviteWaitlist(request, crypto.randomUUID()));
      onInvited();
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.subtitle}>Inviter dans la bêta</h2>
      <p className={styles.muted}>
        <strong>{formatNumber(invitable)}</strong> adresse(s) à inviter : ni invitées, ni
        désinscrites, sans compte. Chacune reçoit « {WAITLIST_INVITE_SUBJECT} » avec un lien qui a
        une place par adresse, à suivre dans l'onglet des liens.
      </p>
      <form
        className={styles.row}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (validCount) void invite({ target: "oldest", count: oldest }, oldest);
        }}
      >
        <label className={styles.field}>
          Combien
          <input
            className={styles.input}
            type="number"
            min={1}
            value={count}
            onChange={(event) => setCount(event.target.value)}
          />
        </label>
        <button type="submit" className={styles.primary} disabled={busy || !validCount}>
          Inviter les {validCount ? formatNumber(oldest) : ""} plus anciens
        </button>
        {chosen.length > 0 && (
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={() => void invite({ target: "chosen", emails: [...chosen] }, chosen.length)}
          >
            Inviter la sélection ({formatNumber(chosen.length)})
          </button>
        )}
      </form>
      {done !== null && (
        <p>
          {formatNumber(done.invited)} invitation(s) parties, lien{" "}
          <span className={styles.mono}>/invitation/{done.inviteCode}</span>.{" "}
          <Link href={`/admin/campagnes/${done.campaignId}`}>Suivre l'envoi</Link>
        </p>
      )}
      {error !== null && <p className={styles.error}>{error}</p>}
    </section>
  );
}

/** The opening e-mail: the list is closed, then erased once the e-mail has left. */
function OpeningPanel({
  opening,
  total,
  onErased,
}: {
  readonly opening: AdminWaitlistOpening;
  readonly total: number;
  readonly onErased: (erasedAt: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [count, setCount] = useState(total);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = opening.status === "completed" || opening.status === "cancelled";

  const erase = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi.eraseWaitlist(count);
      if (result.kind === "count_changed") {
        setCount(result.count);
        setTyped("");
        setError(
          `Le nombre a changé : ${formatNumber(result.count)} adresse(s). Confirme ce nombre.`,
        );
        return;
      }
      onErased(new Date().toISOString());
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.subtitle}>Liste fermée</h2>
      <p className={styles.muted}>
        L'e-mail d'ouverture est lancé :{" "}
        <Link href={`/admin/campagnes/${opening.campaignId}`}>
          {STATUS_LABELS[opening.status].toLowerCase()}
        </Link>
        . Plus aucune inscription, plus aucun second envoi.
      </p>
      {opening.erasedAt !== null ? (
        <p>Adresses effacées le {formatDateTime(opening.erasedAt)}.</p>
      ) : !sent ? (
        <p className={styles.muted}>L'effacement s'ouvre quand l'envoi est fini.</p>
      ) : (
        <form className={styles.form} onSubmit={(event) => void erase(event)}>
          <p>
            Effacer les {formatNumber(count)} adresse(s) de la liste. Les désinscriptions restent.
            Pas de retour en arrière.
          </p>
          <div className={styles.row}>
            <label className={styles.field}>
              Tape {formatNumber(count)} pour confirmer
              <input
                className={styles.input}
                inputMode="numeric"
                value={typed}
                onChange={(event) => setTyped(event.target.value.replace(/\s/g, ""))}
              />
            </label>
            <button
              type="submit"
              className={styles.danger}
              disabled={busy || typed !== String(count)}
            >
              Effacer la liste
            </button>
          </div>
          {error !== null && <p className={styles.error}>{error}</p>}
        </form>
      )}
    </section>
  );
}
