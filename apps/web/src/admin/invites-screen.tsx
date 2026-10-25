"use client";

import type { AdminInvite } from "@leximon/contract";
import { type FormEvent, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { formatDateTime, formatNumber } from "./format";
import { useLoad } from "./use-load";

function inviteUrl(code: string): string {
  return `${window.location.origin}/invitation/${code}`;
}

function stateOf(invite: AdminInvite): string {
  if (invite.revokedAt !== null) return "Retirée";
  if (invite.expiresAt !== null && Date.parse(invite.expiresAt) <= Date.now()) return "Expirée";
  return invite.uses >= invite.maxUses ? "Pleine" : "Ouverte";
}

/** Invitation links of the closed beta: one per group, with a number of places. */
export function InvitesScreen() {
  const { state, reload } = useLoad(adminApi.fetchInvites);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      setCopied(code);
    } catch {
      setError(`Copie refusée par le navigateur : ${inviteUrl(code)}`);
    }
  };

  const revoke = async (invite: AdminInvite) => {
    if (!window.confirm(`Retirer « ${invite.label} » ? Plus personne n'entrera par ce lien.`)) {
      return;
    }
    try {
      await adminApi.revokeInvite(invite.id);
      reload();
    } catch (caught) {
      setError(adminErrorMessage(caught));
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Invitations</h1>
      </div>
      <p className={styles.muted}>
        Tant que la bêta est fermée, un nouveau joueur n'entre que par un de ces liens. Ceux déjà
        entrés restent, même si le lien est retiré.
      </p>
      <NewInvite onCreated={reload} />
      {error !== null && <p className={styles.error}>{error}</p>}
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && state.data.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Groupe</th>
                <th>Lien</th>
                <th>Places</th>
                <th>État</th>
                <th>Créée le</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.data.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.label}</td>
                  <td className={styles.mono}>/invitation/{invite.code}</td>
                  <td>
                    {formatNumber(invite.uses)} / {formatNumber(invite.maxUses)}
                  </td>
                  <td>
                    {stateOf(invite)}
                    {invite.expiresAt !== null && invite.revokedAt === null && (
                      <> · jusqu'au {formatDateTime(invite.expiresAt)}</>
                    )}
                  </td>
                  <td>{formatDateTime(invite.createdAt)}</td>
                  <td>
                    <div className={styles.row}>
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => void copy(invite.code)}
                      >
                        {copied === invite.code ? "Copié" : "Copier le lien"}
                      </button>
                      {invite.revokedAt === null && (
                        <button
                          type="button"
                          className={styles.danger}
                          onClick={() => void revoke(invite)}
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function NewInvite({ onCreated }: { readonly onCreated: () => void }) {
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("10");
  const [code, setCode] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.createInvite({
        label: label.trim(),
        maxUses: Number(maxUses),
        ...(code.trim() === "" ? {} : { code: code.trim().toLowerCase() }),
        ...(expires === "" ? {} : { expiresAt: new Date(`${expires}T23:59:59`).toISOString() }),
      });
      setLabel("");
      setCode("");
      setExpires("");
      onCreated();
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.subtitle}>Nouvelle invitation</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.row}>
          <label className={styles.field}>
            Groupe (vu dans la mesure)
            <input
              className={styles.input}
              required
              maxLength={80}
              placeholder="Amis, LinkedIn, Prof de Lyon…"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Places
            <input
              className={styles.input}
              type="number"
              min={1}
              max={10000}
              required
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Code (vide : tiré au hasard)
            <input
              className={styles.input}
              pattern="[a-z0-9\-]{3,32}"
              placeholder="amis"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Expire le (facultatif)
            <input
              className={styles.input}
              type="date"
              value={expires}
              onChange={(event) => setExpires(event.target.value)}
            />
          </label>
          <button type="submit" className={styles.primary} disabled={busy || label.trim() === ""}>
            Créer
          </button>
        </div>
        <p className={styles.muted}>
          Un code lisible se devine : garde-le pour un groupe où ça ne gêne pas.
        </p>
        {error !== null && <p className={styles.error}>{error}</p>}
      </form>
    </section>
  );
}
