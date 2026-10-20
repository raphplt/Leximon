"use client";

import { type FormEvent, useState } from "react";
import { joinWaitlist } from "@/lib/api";
import styles from "./landing-page.module.css";

type FormState =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "joined" }
  | { readonly kind: "error"; readonly message: string };

const ERRORS = {
  invalid_email: "Cette adresse ne semble pas valide.",
  rate_limited: "Trop d'essais d'un coup. Réessaie dans une minute.",
  unavailable: "L'inscription ne répond pas pour l'instant. Réessaie un peu plus tard.",
} as const;

/** Leaves an address to be warned when the game opens. Nothing else is asked or promised. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const result = await joinWaitlist(email);
      setState(
        result.kind === "joined"
          ? { kind: "joined" }
          : { kind: "error", message: ERRORS[result.reason] },
      );
    } catch {
      setState({ kind: "error", message: ERRORS.unavailable });
    }
  };

  if (state.kind === "joined") {
    return (
      <p className={styles.joined} role="status">
        C'est noté ! Tu recevras un seul e-mail : celui qui t'annonce l'ouverture.
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.label} htmlFor="waitlist-email">
        Préviens-moi de l'ouverture
      </label>
      <div className={styles.fields}>
        <input
          id="waitlist-email"
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ton@adresse.fr"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby="waitlist-note waitlist-error"
        />
        <button className={styles.primary} type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Envoi…" : "M'inscrire"}
        </button>
      </div>
      <p id="waitlist-error" className={styles.error} role="alert">
        {state.kind === "error" ? state.message : ""}
      </p>
      <p id="waitlist-note" className={styles.note}>
        Ton adresse sert seulement à te prévenir de l'ouverture, puis elle est effacée. Pour la
        retirer avant, écris à <a href="mailto:contact@leximon.fr">contact@leximon.fr</a>.
      </p>
    </form>
  );
}
