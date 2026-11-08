"use client";

import type { InviteStatus } from "@leximon/contract";
import {
  CLOSED_TITLE,
  INVITATION_REQUIRED_TEXT,
  INVITATION_REQUIRED_TITLE,
  INVITE_CLOSED_TEXT,
  INVITED_ACTION,
  INVITED_PITCH,
  INVITED_TITLE,
  SIGN_IN_QUERY,
} from "@leximon/view-model";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "@/app/confidentialite/privacy.module.css";
import { WaitlistForm } from "@/landing/waitlist-form";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";
import ui from "@/ui/ui.module.css";
import { rememberInvite } from "./arrival";

type State = { readonly kind: "loading" } | { readonly kind: "failed" } | InviteStatus;

/** Where an invitation link leads: it opens the closed beta to whoever holds it. */
export function InvitationScreen() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code).toLowerCase();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    api
      .fetchInviteStatus(code)
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
      <h1 className={`${styles.title} ${ui.lettered}`}>
        {"status" in state && state.status !== "open" ? CLOSED_TITLE : INVITED_TITLE}
      </h1>
      <section className={`${styles.section} ${ui.leaf}`}>
        {"kind" in state && state.kind === "loading" && <p>Un instant…</p>}
        {"kind" in state && state.kind === "failed" && <p>Le serveur ne répond pas. Réessaie.</p>}
        {"status" in state && state.status === "open" && (
          <>
            <p>{INVITED_PITCH}</p>
            <div style={{ marginTop: 24 }}>
              <Button onClick={enter}>{INVITED_ACTION}</Button>
            </div>
          </>
        )}
        {"status" in state && state.status !== "open" && (
          <>
            <p>{INVITE_CLOSED_TEXT[state.status]}</p>
            <div style={{ marginTop: 24 }}>
              <WaitlistForm />
            </div>
          </>
        )}
        <p style={{ marginTop: 32 }}>
          Déjà un compte ? <Link href={`/compte?${SIGN_IN_QUERY}`}>Me connecter</Link>
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
      <h1 className={`${styles.title} ${ui.lettered}`}>{INVITATION_REQUIRED_TITLE}</h1>
      <section className={`${styles.section} ${ui.leaf}`}>
        <p>{INVITATION_REQUIRED_TEXT}</p>
        <div style={{ marginTop: 24 }}>
          <WaitlistForm />
        </div>
        <p style={{ marginTop: 32 }}>
          Déjà un compte ? <Link href={`/compte?${SIGN_IN_QUERY}`}>Me connecter</Link>
        </p>
      </section>
    </main>
  );
}
