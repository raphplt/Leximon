"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/lib/api";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import styles from "./settings.module.css";

/** Signing out from the menu, where it sits one slip of the finger from the other entries. */
export function SignOutDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      // A full load: the next screen starts a new guest from scratch.
      window.location.assign("/jouer");
    } catch {
      setBusy(false);
      setError("Le serveur lambine. Réessaie.");
    }
  };

  return (
    <Dialog open={open} title="Te déconnecter ?" onClose={onClose} variant="center">
      <div className={styles.pad}>
        <div className={styles.buttons}>
          <Button disabled={busy} onClick={() => void leave()}>
            {busy ? "Déconnexion…" : "Me déconnecter"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Rester
          </Button>
        </div>
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
