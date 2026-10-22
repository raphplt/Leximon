"use client";

import type { InviteStatus } from "@leximon/contract";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "@/app/confidentialite/privacy.module.css";
import { WaitlistForm } from "@/landing/waitlist-form";
import { fetchInviteStatus } from "@/lib/api";
import { Button } from "@/ui/button";
import { rememberInvite } from "./arrival";

type State = { readonly kind: "loading" } | { readonly kind: "failed" } | InviteStatus;

const CLOSED_TEXT = {
  full: "Ce lien a fait le plein. Laisse ton adresse, on te prévient à l'ouverture.",
  expired: "Ce lien a fait son temps. Laisse ton adresse, on te prévient à l'ouverture.",
  unknown: "Ce lien ne mène nulle part. Recopie-le en entier, ou laisse ton adresse.",
} as const;

/** Where an invitation link leads: it opens the closed beta to whoever holds it. */
export function InvitationScreen() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code).toLowerCase();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    fetchInviteStatus(code)
      .then((status) => {
        if (live) setState({ status });
      })
      .catch(() => {
        if (live) setState({ kind: "failed" });
      });
    return () => {
      live = false;
    };
  }, [code]);

  const enter = () => {
    rememberInvite(code);
    window.location.assign("/jouer");
  };

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={styles.title}>
        {"status" in state && state.status !== "open" ? "Porte close" : "Tu es invité"}
      </h1>
      <section className={styles.section}>
        {"kind" in state && state.kind === "loading" && <p>Un instant…</p>}
        {"kind" in state && state.kind === "failed" && <p>Le serveur lambine. Réessaie.</p>}
        {"status" in state && state.status === "open" && (
          <>
            <p>
              Des mots que plus personne ne dit, en cartes à collectionner. La bêta est fermée, ce
              lien t'ouvre la porte.
            </p>
            <div style={{ marginTop: 24 }}>
              <Button onClick={enter}>Ouvrir mon premier sachet</Button>
            </div>
          </>
        )}
        {"status" in state && state.status !== "open" && (
          <>
            <p>{CLOSED_TEXT[state.status]}</p>
            <div style={{ marginTop: 24 }}>
              <WaitlistForm />
            </div>
          </>
        )}
        <p style={{ marginTop: 32 }}>
          Déjà un compte ? <Link href="/compte">Me connecter</Link>
        </p>
      </section>
    </main>
  );
}

/** Where a visitor without an invitation lands when they try to play. */
export function InvitationRequiredScreen() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={styles.title}>Sur invitation</h1>
      <section className={styles.section}>
        <p>La bêta est fermée. Il te faut un lien d'invitation.</p>
        <div style={{ marginTop: 24 }}>
          <WaitlistForm />
        </div>
        <p style={{ marginTop: 32 }}>
          Déjà un compte ? <Link href="/compte">Me connecter</Link>
        </p>
      </section>
    </main>
  );
}
