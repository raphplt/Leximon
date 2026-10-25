"use client";

import type { AdminTester, RetentionRow } from "@leximon/contract";
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { formatNumber } from "./format";
import { Stat } from "./overview-screen";
import { useLoad } from "./use-load";

function percent(part: number, whole: number): string {
  return whole === 0 ? "—" : `${Math.round((part / whole) * 100)} %`;
}

function rate(value: RetentionRow["d1"]): string {
  return value.eligible === 0
    ? "—"
    : `${percent(value.players, value.eligible)} (${value.players}/${value.eligible})`;
}

/** Retention and funnel of the beta, computed from the game's own database. Admins excluded. */
export function MeasuresScreen() {
  const { state, reload } = useLoad(adminApi.fetchMeasures);
  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Mesure</h1>
        <button type="button" className={styles.button} onClick={reload}>
          Actualiser
        </button>
      </div>
      <p className={styles.muted}>
        Un joueur compte le jour où il ouvre le jeu (heure de Paris). J7 : revenu le 7e jour
        exactement, parmi ceux arrivés il y a 7 jours ou plus. Les admins ne comptent pas.
      </p>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && (
        <>
          <h2 className={styles.subtitle}>Joueurs actifs</h2>
          <div className={styles.stats}>
            <Stat label="Aujourd'hui" value={state.data.activeToday} />
            <Stat label="7 derniers jours" value={state.data.active7d} />
            <Stat label="30 derniers jours" value={state.data.active30d} />
          </div>
          <h2 className={styles.subtitle}>Entonnoir</h2>
          <Funnel funnel={state.data.funnel} />
          <RetentionTable title="Par semaine d'arrivée" rows={state.data.byWeek} />
          <RetentionTable title="Par invitation ou source" rows={state.data.byOrigin} />
          <RetentionTable title="Par âge déclaré" rows={state.data.byAge} />
          <h2 className={styles.subtitle}>Fausse porte « Devenir mécène »</h2>
          <div className={styles.stats}>
            <Stat
              label="Ont ouvert la page"
              value={state.data.interest.patronDoor}
              note={
                percent(state.data.interest.patronDoor, state.data.active30d) +
                " des actifs à 30 jours"
              }
            />
            <Stat label="Ont demandé à être prévenus" value={state.data.interest.patronNotify} />
          </div>
        </>
      )}
      <Testers />
    </>
  );
}

function Funnel({
  funnel,
}: {
  readonly funnel: {
    readonly arrived: number;
    readonly openedBooster: number;
    readonly answeredChallenge: number;
    readonly tradedOnce: number;
    readonly createdAccount: number;
    readonly cameBack: number;
  };
}) {
  const steps = [
    ["Arrivés", funnel.arrived],
    ["Un sachet ouvert", funnel.openedBooster],
    ["Un défi répondu", funnel.answeredChallenge],
    ["Un échange conclu", funnel.tradedOnce],
    ["Compte créé", funnel.createdAccount],
    ["Revenus un autre jour", funnel.cameBack],
  ] as const;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <tbody>
          {steps.map(([label, value]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{formatNumber(value)}</td>
              <td>{percent(value, funnel.arrived)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetentionTable({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: readonly RetentionRow[];
}) {
  return (
    <>
      <h2 className={styles.subtitle}>{title}</h2>
      {rows.length === 0 ? (
        <p className={styles.muted}>Personne encore.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th />
                <th>Joueurs</th>
                <th>J1</th>
                <th>J7</th>
                <th>J30</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.key}</td>
                  <td>{formatNumber(row.players)}</td>
                  <td>{rate(row.d1)}</td>
                  <td>{rate(row.d7)}</td>
                  <td>{rate(row.d30)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const AGE_LABELS: Readonly<Record<string, string>> = { "50+": "50 et +" };

/** Each tester, by the last day they played. */
function Testers() {
  const [testers, setTesters] = useState<readonly AdminTester[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    adminApi
      .fetchTesters()
      .then((page) => {
        if (!live) return;
        setTesters(page.testers);
        setCursor(page.nextCursor);
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      });
    return () => {
      live = false;
    };
  }, []);

  const more = async () => {
    if (cursor === null) return;
    setBusy(true);
    try {
      const page = await adminApi.fetchTesters(cursor);
      setTesters((current) => [...current, ...page.testers]);
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className={styles.subtitle}>Testeurs</h2>
      {error !== null && <p className={styles.error}>{error}</p>}
      {testers.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Origine</th>
                <th>Âge</th>
                <th>Arrivé</th>
                <th>Dernier jour</th>
                <th>Jours</th>
                <th>Sachets</th>
                <th>Défis</th>
                <th>Niveau</th>
              </tr>
            </thead>
            <tbody>
              {testers.map((tester) => (
                <tr key={tester.id}>
                  <td>
                    <Link href={`/admin/joueurs/${encodeURIComponent(tester.id)}`}>
                      {tester.pseudo ?? tester.email ?? "Invité"}
                    </Link>
                  </td>
                  <td>{tester.origin ?? "—"}</td>
                  <td>
                    {tester.ageBracket === null
                      ? "—"
                      : (AGE_LABELS[tester.ageBracket] ?? tester.ageBracket)}
                  </td>
                  <td>{tester.firstDay}</td>
                  <td>{tester.lastDay}</td>
                  <td>{formatNumber(tester.daysPlayed)}</td>
                  <td>{formatNumber(tester.boosters)}</td>
                  <td>{formatNumber(tester.answers)}</td>
                  <td>{tester.level}</td>
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
