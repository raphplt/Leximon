"use client";

import {
  DELETE_ACCOUNT_ADMIN,
  DELETE_ACCOUNT_CANCEL,
  DELETE_ACCOUNT_CONFIRM,
  DELETE_ACCOUNT_WARNING,
  deleteAccountLabel,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import styles from "./settings.module.css";
import { failureMessage } from "./use-profile-actions";

/**
 * Deleting the account: erased at once, for good. Two steps: the button that names what
 * goes, then the confirmation.
 */
export function DeleteAccountDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const me = useShared(profile);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirming(false);
    setError(null);
  }, [open]);

  const erase = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.deleteAccount();
      if (result.kind === "refused") {
        setError(DELETE_ACCOUNT_ADMIN);
        setBusy(false);
        return;
      }
      // A full load: nothing of the erased player stays in memory.
      window.location.assign("/");
    } catch (caught) {
      setError(failureMessage(caught));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} title="Supprimer mon compte" onClose={onClose} variant="center">
      <div>
        <p className={styles.warning}>{DELETE_ACCOUNT_WARNING}</p>
        {confirming ? (
          <div className={styles.buttons}>
            <Button className={styles.destroy} disabled={busy} onClick={() => void erase()}>
              {busy ? "Effacement…" : DELETE_ACCOUNT_CONFIRM}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              {DELETE_ACCOUNT_CANCEL}
            </Button>
          </div>
        ) : (
          <Button className={styles.destroy} wide onClick={() => setConfirming(true)}>
            {deleteAccountLabel(me?.stats.words ?? 0)}
          </Button>
        )}
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
