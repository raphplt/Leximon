"use client";

import { usePathname } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./feedback-dialog.module.css";

/**
 * A note to the team, from the screen the tester is on unless `screen` names another, such as
 * the card a mistake was spotted on. Read by us only.
 */
export function FeedbackDialog({
  open,
  onClose,
  screen,
  title = "Un retour ?",
  label = "Signale un bug, une erreur sur une carte ou partage une idée.",
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly screen?: string;
  readonly title?: string;
  readonly label?: string;
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
      await api.sendFeedback({ body: body.trim(), screen: screen ?? pathname });
      setBody("");
      onClose();
      toast("Bien reçu. Merci.");
    } catch {
      setError("L'envoi a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} title={title} onClose={onClose} variant="center">
      <form className={styles.form} onSubmit={submit}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <textarea
          id={id}
          className={`${ui.field} ${styles.text}`}
          rows={5}
          maxLength={1000}
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button type="submit" wide disabled={busy || body.trim().length < 3}>
          {busy ? "Envoi…" : "Envoyer"}
        </Button>
        <p className={styles.error} role="alert">
          {error}
        </p>
      </form>
    </Dialog>
  );
}
