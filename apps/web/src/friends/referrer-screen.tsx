"use client";

import type { ReferrerResponse } from "@leximon/contract";
import {
  REFERRER_ACTION,
  REFERRER_FULL,
  REFERRER_PITCH,
  REFERRER_UNKNOWN,
  referrerTitle,
} from "@leximon/view-model";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "@/app/confidentialite/privacy.module.css";
import { rememberReferrer } from "@/beta/arrival";
import { Avatar } from "@/components/avatar";
import { WaitlistForm } from "@/landing/waitlist-form";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";

type State =
  | { readonly kind: "loading" | "failed" | "unknown" }
  | { readonly kind: "found"; readonly referrer: ReferrerResponse };

/** Where a friend link leads: who invites, and the door of the closed beta while it has room. */
export function ReferrerScreen() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code).toUpperCase();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    api
      .fetchReferrer(code)
      .then((referrer) => {
        if (live) setState(referrer === null ? { kind: "unknown" } : { kind: "found", referrer });
      })
      .catch(() => {
        if (live) setState({ kind: "failed" });
      });
    return () => {
      live = false;
    };
  }, [code]);

  const enter = () => {
    rememberReferrer(code);
    window.location.assign("/jouer");
  };

  const referrer = state.kind === "found" ? state.referrer : null;
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      {referrer !== null && (
        <div style={{ margin: "28px 0 8px" }}>
          <Avatar
            avatar={referrer.player.avatar}
            frame={referrer.player.frame}
            size={88}
            label={referrer.player.pseudo}
          />
        </div>
      )}
      <h1 className={styles.title}>
        {referrer === null ? "Lien d'ami" : referrerTitle(referrer.player.pseudo)}
      </h1>
      <section className={styles.section}>
        {state.kind === "loading" && <p>Un instant…</p>}
        {state.kind === "failed" && <p>Le serveur lambine. Réessaie.</p>}
        {state.kind === "unknown" && <p>{REFERRER_UNKNOWN}</p>}
        {referrer !== null && referrer.status === "open" && (
          <>
            <p>{REFERRER_PITCH}</p>
            <div style={{ marginTop: 24 }}>
              <Button onClick={enter}>{REFERRER_ACTION}</Button>
            </div>
            <p style={{ marginTop: 32 }}>
              Déjà joueur ?{" "}
              <Link href={`/amis?ajouter=${code}`}>Ajouter {referrer.player.pseudo} en ami</Link>
            </p>
          </>
        )}
        {referrer !== null && referrer.status === "full" && (
          <>
            <p>{REFERRER_FULL}</p>
            <div style={{ marginTop: 24 }}>
              <WaitlistForm />
            </div>
            <p style={{ marginTop: 32 }}>
              Déjà un compte ? <Link href="/compte">Me connecter</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
