"use client";

import type { UnsubscribeStopped } from "@leximon/contract";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import styles from "@/app/confidentialite/privacy.module.css";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";

type State = "ready" | "sending" | UnsubscribeStopped | "invalid" | "failed";

const STOPPED: Readonly<Record<UnsubscribeStopped, string>> = {
  campaigns: "Plus de nouvelles de notre part.",
  news: "Plus d'e-mail quand on t'écrit. Le courrier reste dans le jeu.",
  reminders: "Plus de rappel pour tes sachets.",
};

/**
 * Where the link at the bottom of a campaign or notification e-mail leads. Opening it changes nothing (mail
 * scanners open links too): the button does. Mail clients use the one-click header instead.
 */
export function UnsubscribeFromAddress() {
  const params = useParams<{ jeton: string }>();
  const token = decodeURIComponent(params.jeton);
  const [state, setState] = useState<State>("ready");

  const confirm = async () => {
    setState("sending");
    try {
      setState(await api.unsubscribeFromLink(token));
    } catch {
      setState("failed");
    }
  };

  const done = state === "campaigns" || state === "news" || state === "reminders";
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={styles.title}>{done ? "C'est fait" : "Plus d'e-mails ?"}</h1>
      <section className={styles.section}>
        {done && <p>{STOPPED[state]}</p>}
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
