"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import styles from "@/app/confidentialite/privacy.module.css";
import { unsubscribeFromLink } from "@/lib/api";
import { Button } from "@/ui/button";

type State = "ready" | "sending" | "done" | "invalid" | "failed";

/**
 * Where the link at the bottom of a campaign e-mail leads. Opening it changes nothing (mail
 * scanners open links too): the button does. Mail clients use the one-click header instead.
 */
export function UnsubscribeFromAddress() {
  const params = useParams<{ jeton: string }>();
  const token = decodeURIComponent(params.jeton);
  const [state, setState] = useState<State>("ready");

  const confirm = async () => {
    setState("sending");
    try {
      setState((await unsubscribeFromLink(token)) === "done" ? "done" : "invalid");
    } catch {
      setState("failed");
    }
  };

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={styles.title}>{state === "done" ? "C'est fait" : "Plus d'e-mails ?"}</h1>
      <section className={styles.section}>
        {state === "done" && <p>Plus de nouvelles de notre part.</p>}
        {state === "invalid" && (
          <p>Ce lien ne mène nulle part. Recopie-le en entier depuis l'e-mail.</p>
        )}
        {state === "failed" && <p>Le serveur lambine. Réessaie.</p>}
        {(state === "ready" || state === "sending" || state === "failed") && (
          <>
            <p>Un clic, et on arrête de t'écrire.</p>
            <div style={{ marginTop: 24 }}>
              <Button disabled={state === "sending"} onClick={() => void confirm()}>
                {state === "sending" ? "Un instant…" : "Me désinscrire"}
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
