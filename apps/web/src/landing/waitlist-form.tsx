"use client";

import Link from "next/link";
import { type FormEvent, useId, useState } from "react";
import { joinWaitlist } from "@/lib/api";
import styles from "./landing-page.module.css";

type FormState =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "joined" }
  | { readonly kind: "closed" }
  | { readonly kind: "error"; readonly message: string };

const ERRORS = {
  invalid_email: "Il manque quelque chose à cette adresse.",
  rate_limited: "Doucement. Réessaie dans une minute.",
  unavailable: "Le serveur lambine. Réessaie.",
} as const;

/** Leaves an address to be warned when the game opens. Nothing else is asked or promised. */
export function WaitlistForm() {
  // The page shows the form twice, so its ids must differ.
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const result = await joinWaitlist(email);
      setState(
        result.kind === "refused" ? { kind: "error", message: ERRORS[result.reason] } : result,
      );
    } catch {
      setState({ kind: "error", message: ERRORS.unavailable });
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
        Trop tard pour attendre : c'est ouvert. <Link href="/jouer">Viens jouer.</Link>
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.label} htmlFor={`${id}-email`}>
        Sois là à l'ouverture
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
        <button className={styles.primary} type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Envoi…" : "Préviens-moi"}
        </button>
      </div>
      <p id={`${id}-error`} className={styles.error} role="alert">
        {state.kind === "error" ? state.message : ""}
      </p>
      <p id={`${id}-note`} className={styles.note}>
        On t'écrit le jour de l'ouverture, puis on oublie ton adresse.{" "}
        <Link href="/confidentialite">Tes données</Link>
      </p>
    </form>
  );
}
