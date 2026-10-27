"use client";

import { pseudoHint } from "@leximon/view-model";
import { type FormEvent, useEffect, useId, useState } from "react";
import { useNow } from "@/lib/use-now";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import ui from "@/ui/ui.module.css";
import styles from "./pseudo-dialog.module.css";
import { useProfileActions } from "./use-profile-actions";

/** Choosing or changing the pseudo: the server checks it and says why it refuses. */
export function PseudoDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const actions = useProfileActions();
  const me = actions.profile;
  const now = useNow(60_000);
  const id = useId();
  const [pseudo, setPseudo] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPseudo(me?.pseudo ?? "");
    setProblem(null);
  }, [open, me?.pseudo]);

  const locked =
    me?.pseudoChangeableFrom != null && Date.parse(me.pseudoChangeableFrom) > now && now > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const chosen = pseudo.trim();
    if (chosen === "" || chosen === me?.pseudo) return;
    const failed = await actions.update(
      { pseudo: chosen },
      { success: `Tu t'appelles maintenant ${chosen}.`, quiet: true },
    );
    setProblem(failed);
    if (failed === null) onClose();
  };

  return (
    <Dialog open={open} title="Ton pseudo" onClose={onClose} variant="center">
      {me !== null && (
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <label htmlFor={id} className={styles.label}>
            Pseudo
          </label>
          <input
            id={id}
            className={ui.field}
            type="text"
            autoComplete="nickname"
            maxLength={20}
            value={pseudo}
            disabled={locked}
            aria-invalid={problem !== null}
            aria-describedby={`${id}-hint`}
            onChange={(event) => {
              setPseudo(event.target.value);
              setProblem(null);
            }}
          />
          <p
            id={`${id}-hint`}
            className={problem === null ? styles.hint : styles.problem}
            role={problem === null ? undefined : "alert"}
          >
            {problem ?? (now === 0 ? "" : pseudoHint(me, now))}
          </p>
          <Button
            type="submit"
            wide
            disabled={locked || actions.busy || pseudo.trim() === "" || pseudo.trim() === me.pseudo}
          >
            {actions.busy ? "Vérification…" : "Prendre ce pseudo"}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
