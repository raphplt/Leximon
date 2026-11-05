"use client";

import { sharedResource } from "@leximon/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Desk, MainAction } from "@/library/play-pieces";
import { useShared } from "@/player/resource";
import { Lettering, toyClass } from "@/ui/toy";
import type { Door } from "./door";
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

/** Props that hide one of two pieces sharing a cell, and keep it out of reach. */
function shownIf(shown: boolean, className: string | undefined) {
  return {
    className: shown ? className : `${className ?? ""} ${styles.away}`,
    inert: !shown,
    "aria-hidden": shown ? undefined : true,
  } as const;
}

/** In the top bar: the way back for those who play, the sign-in for everyone else. */
export function TopAction() {
  const playing = useShared(hasGame) === true;
  return (
    <div className={styles.topAction}>
      <Link href="/jouer" {...shownIf(playing, toyClass("gold", "box", false, styles.topButton))}>
        <Lettering>{RESUME}</Lettering>
      </Link>
      <Link
        href="/compte"
        {...shownIf(!playing, toyClass("paper", "box", false, styles.topButton))}
      >
        <Lettering>Me connecter</Lettering>
      </Link>
    </div>
  );
}

/**
 * The main action: the game, or the waitlist while the beta is closed; for a player, the way
 * back. Both answers keep their room in one cell, so nothing below jumps once it comes.
 */
export function DoorAction({ door }: { readonly door: Door }) {
  const router = useRouter();
  const playing = useShared(hasGame) === true;
  return (
    <div className={styles.doorCell}>
      <div {...shownIf(playing, styles.door)}>
        <MainAction label={RESUME} onClick={() => router.push("/jouer")} />
      </div>
      <div {...shownIf(!playing, styles.door)}>
        {door === "open" ? (
          <>
            <MainAction label="Jouer" onClick={() => router.push("/jouer")} />
            <span className={styles.doorNote}>Gratuit, sans compte pour commencer.</span>
          </>
        ) : (
          <WaitlistForm className={styles.waitlist} />
        )}
      </div>
    </div>
  );
}

/** The end of the page: the promise again, on the desk. */
export function Closing({ door }: { readonly door: Door }) {
  const playing = useShared(hasGame) === true;
  return (
    <section className={styles.closing} aria-labelledby="closing-title">
      <Desk className={styles.closingDesk} />
      <h2 id="closing-title" className={styles.closingTitle}>
        <Lettering>
          {playing || door === "open" ? "Tes sachets sont prêts." : "L'ouverture approche."}
        </Lettering>
      </h2>
      <DoorAction door={door} />
    </section>
  );
}
