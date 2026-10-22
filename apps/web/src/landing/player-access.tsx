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

/** In the top bar, for those who already play. */
export function ResumeLink() {
  if (useShared(hasGame) !== true) return null;
  return (
    <Link href="/jouer" className={styles.resumeSmall}>
      {RESUME}
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
