"use client";

import type { AdminContestsResponse } from "@leximon/contract";
import Link from "next/link";
import { useState } from "react";
import styles from "./admin.module.css";
import { adminErrorMessage, fetchContests, resolveContest } from "./admin-api";
import { formatDateTime, SANCTION_LABELS } from "./format";
import { useLoad } from "./use-load";

type Contest = AdminContestsResponse["contests"][number];

/** Contested sanctions waiting for a human answer (R-08, DSA). */
export function ContestsScreen() {
  const { state, reload } = useLoad(fetchContests);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resolve = async (contest: Contest, outcome: "upheld" | "revoked") => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await resolveContest(contest.sanction.id, outcome);
      setNotice(outcome === "revoked" ? "Sanction levée." : "Sanction maintenue.");
      reload();
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Contestations</h1>
      </div>
      {notice !== null && <p className={styles.success}>{notice}</p>}
      {error !== null && <p className={styles.error}>{error}</p>}
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && state.data.contests.length === 0 && (
        <p className={styles.muted}>Aucune contestation en attente.</p>
      )}
      {state.kind === "ready" &&
        state.data.contests.map((contest) => {
          const { sanction } = contest;
          const who = contest.player?.pseudo ?? contest.player?.code ?? contest.userId.slice(0, 8);
          return (
            <section key={sanction.id} className={styles.panel}>
              <p className={styles.muted}>
                {SANCTION_LABELS[sanction.kind]} · le {formatDateTime(sanction.createdAt)}
                {sanction.contestedAt !== null &&
                  ` · contestée le ${formatDateTime(sanction.contestedAt)}`}
              </p>
              <p>
                <Link href={`/admin/joueurs/${encodeURIComponent(contest.userId)}`}>{who}</Link>
              </p>
              <p>
                <strong>Motif :</strong> {sanction.reason}
              </p>
              {sanction.content !== null && (
                <blockquote className={styles.quote}>« {sanction.content} »</blockquote>
              )}
              <p>
                <strong>Contestation :</strong> {contest.contestText}
              </p>
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => void resolve(contest, "revoked")}
                >
                  Lever la sanction
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={busy}
                  onClick={() => void resolve(contest, "upheld")}
                >
                  Maintenir
                </button>
              </div>
            </section>
          );
        })}
    </>
  );
}
