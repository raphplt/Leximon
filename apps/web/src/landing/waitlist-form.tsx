"use client";

import { WAITLIST_ERRORS } from "@leximon/view-model";
import Link from "next/link";
import { type FormEvent, useId, useState } from "react";
import { api } from "@/lib/api";
import { Lettering, Toy } from "@/ui/toy";
import styles from "./waitlist-form.module.css";

type FormState =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "joined" }
  | { readonly kind: "closed" }
  | { readonly kind: "error"; readonly message: string };

/** Leaves an address to be warned when the game opens. Nothing else is asked or promised. */
export function WaitlistForm({ className }: { readonly className?: string | undefined } = {}) {
  // The page shows the form twice, so its ids must differ.
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const result = await api.joinWaitlist(email);
      setState(
        result.kind === "refused"
          ? { kind: "error", message: WAITLIST_ERRORS[result.reason] }
          : result,
      );
    } catch {
      setState({ kind: "error", message: WAITLIST_ERRORS.unavailable });
    }
  };

  if (state.kind === "joined") {
    return (
      <p className={styles.joined} role="status">
        Noté. On se revoit à l'ouverture.
      </p>
    );
  }

  if (state.kind === "closed") {
    return (
      <p className={styles.joined} role="status">
        Le jeu est ouvert. <Link href="/jouer">Viens jouer.</Link>
      </p>
    );
  }

  return (
    <form
      className={className === undefined ? styles.form : `${styles.form} ${className}`}
      onSubmit={submit}
      noValidate
    >
      <label className={styles.label} htmlFor={`${id}-email`}>
        Ton adresse e-mail
      </label>
      <div className={styles.fields}>
        <input
          id={`${id}-email`}
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ton@adresse.fr"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={`${id}-note ${id}-error`}
        />
        <Toy
          matter="gold"
          type="submit"
          className={styles.send}
          disabled={state.kind === "sending"}
        >
          <Lettering>{state.kind === "sending" ? "Envoi…" : "Préviens-moi"}</Lettering>
        </Toy>
      </div>
      <p id={`${id}-error`} className={styles.error} role="alert">
        {state.kind === "error" ? state.message : ""}
      </p>
      <p id={`${id}-note`} className={styles.note}>
        On t'écrit à l'ouverture, puis quand le jeu a du nouveau.{" "}
        <Link href="/confidentialite">Tes données</Link>
      </p>
    </form>
  );
}
