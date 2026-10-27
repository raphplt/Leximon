"use client";

import { sharedResource } from "@leximon/view-model";
import Link from "next/link";
import { api } from "@/lib/api";
import { useShared } from "@/player/resource";
import styles from "./landing-page.module.css";
import { WaitlistForm } from "./waitlist-form";

/**
 * Whether this browser already has a game, guest or member. A visitor who only reads the page
 * must not get a guest account.
 */
const hasGame = sharedResource<boolean>(async () => {
  try {
    return await api.hasSession();
  } catch {
    return false;
  }
});

const RESUME = "Reprendre la partie";

/**
 * In the top bar: the way back for those who play, the sign-in for everyone else. Both sit in
 * one cell, only one shown: the bar keeps its size whatever the answer.
 */
export function TopAction() {
  const playing = useShared(hasGame) === true;
  return (
    <div className={styles.topAction}>
      <Link
        href="/jouer"
        className={playing ? styles.resumeSmall : `${styles.resumeSmall} ${styles.away}`}
        inert={!playing}
        aria-hidden={playing ? undefined : true}
      >
        {RESUME}
      </Link>
      <Link
        href="/compte"
        className={playing ? `${styles.signIn} ${styles.away}` : styles.signIn}
        inert={playing}
        aria-hidden={playing ? true : undefined}
      >
        Me connecter
      </Link>
    </div>
  );
}

/**
 * The waitlist for a visitor; for a player, the way back to the game. With `keepRoom`, the form
 * keeps its room, hidden, around the button: at the top of the page, nothing below jumps once
 * the answer comes.
 */
export function JoinOrResume({ keepRoom = false }: { readonly keepRoom?: boolean }) {
  const playing = useShared(hasGame);
  const resume = (
    <Link href="/jouer" className={`${styles.primary} ${styles.resume}`}>
      {RESUME}
    </Link>
  );
  if (!keepRoom) return playing === true ? resume : <WaitlistForm />;
  return (
    <div className={styles.join}>
      <div className={styles.joinResume} hidden={playing === true ? undefined : true}>
        {resume}
      </div>
      <div className={playing === true ? `${styles.joinForm} ${styles.away}` : styles.joinForm}>
        <WaitlistForm />
      </div>
    </div>
  );
}

/** The end of the page: the waitlist again, or the game for those already in it. */
export function Closing() {
  const playing = useShared(hasGame);
  return (
    <section className={styles.closing} aria-labelledby="closing-title">
      <h2 id="closing-title" className={styles.closingTitle}>
        {playing === true ? "Tes sachets sont prêts." : "Laisse ton adresse pour l'ouverture."}
      </h2>
      <JoinOrResume />
    </section>
  );
}
