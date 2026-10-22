"use client";

import { usePathname } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import styles from "@/account/account-screen.module.css";
import { sendFeedback } from "@/lib/api";
import { Dialog } from "@/ui/dialog";
import { useToast } from "@/ui/toast";

/** A note to the team, from the screen the tester is on. Read by us only. */
export function FeedbackDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const pathname = usePathname();
  const toast = useToast();
  const id = useId();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendFeedback({ body: body.trim(), screen: pathname });
      setBody("");
      onClose();
      toast("Bien reçu. Merci.");
    } catch {
      setError("Pas parti. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} title="Un retour ?" onClose={onClose} variant="center">
      <form className={styles.panel} onSubmit={submit}>
        <label htmlFor={id} className={styles.label}>
          Un bug, une idée, un mot qui cloche : dis-le.
        </label>
        <textarea
          id={id}
          className={styles.input}
          rows={5}
          maxLength={1000}
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <button type="submit" className={styles.primary} disabled={busy || body.trim().length < 3}>
          {busy ? "Envoi…" : "Envoyer"}
        </button>
        <p className={styles.error} role="alert">
          {error}
        </p>
      </form>
    </Dialog>
  );
}
