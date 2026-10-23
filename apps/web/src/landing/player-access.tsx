"use client";

import Link from "next/link";
import { send } from "@/lib/api";
import { sharedResource, useShared } from "@/player/resource";
import styles from "./landing-page.module.css";
import { WaitlistForm } from "./waitlist-form";

/**
 * Whether this browser already has a game, guest or member. Asked without `sendAsPlayer`: a
 * visitor who only reads the page must not get a guest account.
 */
const hasGame = sharedResource<boolean>(async () => {
  try {
    return (await send("/me/account")).ok;
  } catch {
    return false;
  }
});

const RESUME = "Reprendre la partie";

/** In the top bar: the way back for those who play, the sign-in for those who have an account elsewhere. */
export function TopAction() {
  const playing = useShared(hasGame);
  if (playing === null) return null;
  return playing ? (
    <Link href="/jouer" className={styles.resumeSmall}>
      {RESUME}
    </Link>
  ) : (
    <Link href="/compte" className={styles.signIn}>
      Me connecter
    </Link>
  );
}

/** The waitlist for a visitor; for a player, the way back to the game. */
export function JoinOrResume() {
  const playing = useShared(hasGame);
  if (playing === true) {
    return (
      <Link href="/jouer" className={`${styles.primary} ${styles.resume}`}>
        {RESUME}
      </Link>
    );
  }
  return <WaitlistForm />;
}

/** The end of the page: the waitlist again, or the game for those already in it. */
export function Closing() {
  const playing = useShared(hasGame);
  return (
    <section className={styles.closing} aria-labelledby="closing-title">
      <h2 id="closing-title" className={styles.closingTitle}>
        {playing === true ? "Tes sachets t'attendent." : "Les premiers sachets partent bientôt."}
      </h2>
      <JoinOrResume />
    </section>
  );
}
