"use client";

import type { AdminReport, SanctionKind } from "@leximon/contract";
import { TIMED_SANCTIONS } from "@leximon/core";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Select } from "@/components/select";
import styles from "./admin.module.css";
import { adminErrorMessage, createSanction, dismissReport, fetchReports } from "./admin-api";
import { formatDateTime, SANCTION_LABELS } from "./format";
import { useLoad } from "./use-load";

const TARGET_LABELS: Readonly<Record<AdminReport["targetKind"], string>> = {
  message: "Message de clan",
  pseudo: "Pseudo",
  clan_name: "Nom de clan",
};

/** The sanction that answers each kind of report first; the others stay in the list. */
const FIRST_SANCTION: Readonly<Record<AdminReport["targetKind"], SanctionKind>> = {
  message: "hide_message",
  pseudo: "reset_pseudo",
  clan_name: "reset_clan_name",
};

const SANCTIONS_BY_TARGET: Readonly<Record<AdminReport["targetKind"], readonly SanctionKind[]>> = {
  message: ["hide_message", "mute", "trade_ban", "suspend", "close"],
  pseudo: ["reset_pseudo", "mute", "trade_ban", "suspend", "close"],
  clan_name: ["reset_clan_name", "mute", "trade_ban", "suspend", "close"],
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Reports grouped by what they point at, oldest first (lot 4, R-08). */
export function ReportsScreen() {
  const { state, reload } = useLoad(fetchReports);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Signalements</h1>
      </div>
      <p className={styles.subtitle}>
        Chaque décision est motivée : le joueur lit le motif et peut contester (DSA).
      </p>
      {notice !== null && <p className={styles.success}>{notice}</p>}
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && state.data.reports.length === 0 && (
        <p className={styles.muted}>Rien à traiter.</p>
      )}
      {state.kind === "ready" &&
        state.data.reports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onDone={(text) => {
              setNotice(text);
              reload();
            }}
          />
        ))}
    </>
  );
}

function ReportCard({
  report,
  onDone,
}: {
  readonly report: AdminReport;
  readonly onDone: (notice: string) => void;
}) {
  const [kind, setKind] = useState<SanctionKind>(FIRST_SANCTION[report.targetKind]);
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Kept until the server answers: a retry after a lost answer sanctions once.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const timed = TIMED_SANCTIONS.includes(kind);
  const who = report.reported?.pseudo ?? report.reported?.code ?? report.reportedUserId.slice(0, 8);

  const sanction = async (event: FormEvent) => {
    event.preventDefault();
    const durationDays = Number(days);
    if (timed && !(durationDays > 0)) {
      setError("Une durée en jours, plus grande que zéro.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createSanction(
        {
          userId: report.reportedUserId,
          kind,
          reason: reason.trim(),
          reportId: report.id,
          ...(timed ? { durationMs: Math.round(durationDays * DAY_MS) } : {}),
          ...(report.messageId !== null && kind === "hide_message"
            ? { messageId: report.messageId }
            : {}),
          ...(report.clanId !== null && kind === "reset_clan_name"
            ? { clanId: report.clanId }
            : {}),
        },
        key,
      );
      setKey(crypto.randomUUID());
      onDone(`Sanction appliquée à ${who}.`);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    setBusy(true);
    setError(null);
    try {
      await dismissReport(report.id);
      onDone("Signalement classé sans suite.");
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel}>
      <p className={styles.muted}>
        {TARGET_LABELS[report.targetKind]} · {report.reporters} signalement
        {report.reporters > 1 ? "s" : ""} · depuis le {formatDateTime(report.firstReportedAt)}
      </p>
      <p>
        <Link href={`/admin/joueurs/${encodeURIComponent(report.reportedUserId)}`}>{who}</Link>
        {report.clanName !== null && <> · clan {report.clanName}</>}
        {report.previousSanctions > 0 && (
          <span className={styles.badgeWarn}>
            {report.previousSanctions} sanction{report.previousSanctions > 1 ? "s" : ""} déjà
          </span>
        )}
      </p>
      <blockquote className={styles.quote}>« {report.content} »</blockquote>
      {report.context.length > 0 && (
        <ol className={styles.context}>
          {report.context.map((line) => (
            <li key={line.id} className={line.id === report.messageId ? styles.contextHit : ""}>
              <strong>{line.author ?? "Un joueur parti"}</strong> : {line.body ?? "(effacé)"}
            </li>
          ))}
        </ol>
      )}

      <form className={styles.form} onSubmit={(event) => void sanction(event)}>
        <div className={styles.row}>
          <Select
            value={kind}
            ariaLabel="Sanction"
            onChange={(value) => {
              const next = SANCTIONS_BY_TARGET[report.targetKind].find((k) => k === value);
              if (next !== undefined) setKind(next);
            }}
            options={SANCTIONS_BY_TARGET[report.targetKind].map((option) => ({
              value: option,
              label: SANCTION_LABELS[option],
            }))}
          />
          {timed && (
            <label className={styles.field}>
              Jours
              <input
                className={styles.input}
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
            </label>
          )}
        </div>
        <label className={styles.field}>
          Motif lu par le joueur (règle de la charte enfreinte)
          <textarea
            className={styles.input}
            rows={2}
            minLength={10}
            maxLength={1000}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error !== null && <p className={styles.error}>{error}</p>}
        <div className={styles.row}>
          <button
            type="submit"
            className={styles.danger}
            disabled={busy || reason.trim().length < 10}
          >
            Sanctionner
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={() => void dismiss()}
          >
            Classer sans suite
          </button>
        </div>
      </form>
    </section>
  );
}
