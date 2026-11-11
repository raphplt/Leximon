"use client";

import type { UnsubscribeStopped } from "@leximon/contract";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import styles from "@/app/confidentialite/privacy.module.css";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";
import ui from "@/ui/ui.module.css";

type State = "ready" | "sending" | UnsubscribeStopped | "invalid" | "failed";

const STOPPED: Readonly<Record<UnsubscribeStopped, string>> = {
  campaigns: "Tu ne recevras plus nos nouvelles par e-mail.",
  news: "Tu ne recevras plus d'e-mail pour ton courrier en jeu. Tes messages restent dans le jeu.",
  reminders: "Tu ne recevras plus de rappel pour tes sachets.",
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
      <h1 className={`${styles.title} ${ui.lettered}`}>{done ? "C'est fait" : "Se désinscrire"}</h1>
      <section className={`${styles.section} ${styles.framed} ${ui.leaf}`}>
        {done && <p>{STOPPED[state]}</p>}
        {state === "invalid" && (
          <p>Ce lien de désinscription n'est pas valide. Recopie-le en entier depuis l'e-mail.</p>
        )}
        {state === "failed" && <p>Le serveur ne répond pas. Réessaie.</p>}
        {(state === "ready" || state === "sending" || state === "failed") && (
          <>
            <p>Confirme ci-dessous pour ne plus recevoir ces e-mails.</p>
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
