"use client";

import { SIGN_IN_QUERY, sharedResource } from "@leximon/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { MainAction } from "@/library/play-pieces";
import { useShared } from "@/player/resource";
import { Fleurons, Tooling } from "@/ui/ornaments";
import { Kicker, Lettering, toyClass } from "@/ui/toy";
import type { Door } from "./door";
import styles from "./landing-page.module.css";
import { WaitlistForm } from "./waitlist-form";

const hasGame = sharedResource<boolean>(async () => {
  try {
    return await api.hasSession();
  } catch {
    return false;
  }
});

const RESUME = "Reprendre la partie";

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
        href={`/compte?${SIGN_IN_QUERY}`}
        {...shownIf(!playing, toyClass("paper", "box", false, styles.topButton))}
      >
        <Lettering>Me connecter</Lettering>
      </Link>
    </div>
  );
}

/** The main action: the game, or the waitlist while the beta is closed. */
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

/** Grand Finale banner: sculpted diamond cabinet with Fleurons and the main call to action. */
export function Closing({ door }: { readonly door: Door }) {
  const playing = useShared(hasGame) === true;
  return (
    <section
      className={`${styles.cabinet} ${styles.closing}`}
      data-tone="emeraude"
      aria-labelledby="closing-title"
    >
      <Tooling />
      <Fleurons />
      <Kicker>Entrer dans la Bibliothèque</Kicker>
      <h2 id="closing-title" className={styles.closingTitle}>
        <Lettering>
          {playing || door === "open" ? "Tes sachets sont prêts." : "L'ouverture approche."}
        </Lettering>
      </h2>
      <p className={styles.closingSub}>
        Six sachets gratuits t'attendent pour tirer tes trente premiers mots rares.
      </p>
      <DoorAction door={door} />
    </section>
  );
}
