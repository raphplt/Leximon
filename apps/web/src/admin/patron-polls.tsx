"use client";

import type { AdminPollRefusal, AdminPollsResponse } from "@leximon/contract";
import { PATRON_SCHEDULE, patronRulesAt } from "@leximon/core";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { formatDateTime } from "./format";

const REFUSALS: Readonly<Record<AdminPollRefusal, string>> = {
  poll_open: "Un vote est déjà ouvert : il faut attendre qu'il se ferme.",
  theme_count: "Le nombre de thèmes ne correspond pas aux règles.",
};

const emptyThemes = (count: number) =>
  Array.from({ length: count }, () => ({ name: "", description: "" }));

/** The patrons' vote: the themes of the next one, which opens at once, and the past results. */
export function PatronPolls() {
  const { pollThemes, pollDays } = patronRulesAt(PATRON_SCHEDULE, Date.now());
  const [polls, setPolls] = useState<AdminPollsResponse["polls"] | null>(null);
  const [themes, setThemes] = useState(() => emptyThemes(pollThemes));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let live = true;
    adminApi
      .fetchPolls()
      .then((read) => {
        if (live) setPolls(read.polls);
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  const now = Date.now();
  const open = polls?.some((poll) => Date.parse(poll.closesAt) > now) ?? false;

  const set = (index: number, field: "name" | "description", value: string) =>
    setThemes((current) =>
      current.map((theme, at) => (at === index ? { ...theme, [field]: value } : theme)),
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!window.confirm(`Ouvrir le vote aux mécènes pour ${pollDays} jours ?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await adminApi.openPoll(themes);
      if (result.kind === "refused") {
        setError(REFUSALS[result.reason]);
      } else {
        setNotice("Vote ouvert.");
        setThemes(emptyThemes(pollThemes));
        load();
      }
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.subtitle}>Vote des mécènes</h2>
      <p className={styles.muted}>
        Les mécènes payants votent pendant {pollDays} jours sur la page Mécène, une voix chacun. Le
        résultat s'y affiche à la fermeture ; à annoncer ensuite dans les nouveautés et sur le
        Discord.
      </p>
      {notice !== null && <p className={styles.success}>{notice}</p>}
      {error !== null && <p className={styles.error}>{error}</p>}
      {!open && polls !== null && (
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          {themes.map((theme, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots, never reordered
            <div key={index} className={styles.row}>
              <label className={styles.field}>
                Thème {index + 1}
                <input
                  className={styles.input}
                  value={theme.name}
                  minLength={2}
                  maxLength={40}
                  required
                  onChange={(event) => set(index, "name", event.target.value)}
                />
              </label>
              <label className={`${styles.field} ${styles.grow}`}>
                Ce que la collection contiendrait
                <input
                  className={styles.input}
                  value={theme.description}
                  minLength={10}
                  maxLength={200}
                  required
                  onChange={(event) => set(index, "description", event.target.value)}
                />
              </label>
            </div>
          ))}
          <div>
            <button type="submit" className={styles.primary} disabled={busy}>
              Ouvrir le vote
            </button>
          </div>
        </form>
      )}
      {polls !== null && polls.length === 0 && <p className={styles.muted}>Aucun vote encore.</p>}
      {polls !== null && polls.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ouvert le</th>
                <th>Se ferme le</th>
                <th>Voix par thème</th>
              </tr>
            </thead>
            <tbody>
              {polls.map((poll) => (
                <tr key={poll.id}>
                  <td>{formatDateTime(poll.opensAt)}</td>
                  <td>
                    {formatDateTime(poll.closesAt)}
                    {Date.parse(poll.closesAt) > now && " (ouvert)"}
                  </td>
                  <td>
                    {poll.themes.map((theme, index) => (
                      <div key={theme.name}>
                        {theme.name} : {poll.votes[index] ?? 0} voix
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
