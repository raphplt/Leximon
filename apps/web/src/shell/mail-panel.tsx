"use client";

import { coffretsLabel, plural } from "@leximon/view-model";
import Link from "next/link";
import { Dialog } from "@/ui/dialog";
import { Icon, type IconName } from "@/ui/icon";
import styles from "./panels.module.css";
import { useShell } from "./shell-context";
import { usePlayerView } from "./use-player-view";

interface Letter {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
  readonly href?: string;
  readonly action?: () => void;
}

/**
 * The mail (R-01, first form): what waits for the player, read from the game's state. Read
 * marks and notifications sent by the queue come with lot 3.
 */
export function MailPanel({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const view = usePlayerView();
  const { openCoffret } = useShell();
  const letters: Letter[] = [];
  if (view.coffrets.length > 0) {
    letters.push({
      icon: "coffret",
      title: `${coffretsLabel(view.coffrets.length)} à ouvrir`,
      detail: "Chemin des niveaux",
      action: () => openCoffret(),
    });
  }
  if (view.cardChoices.length > 0) {
    letters.push({
      icon: "carte",
      title: "Une carte au choix t'attend",
      detail: "Une Courante ou Peu courante qui te manque",
      href: "/niveaux/carte",
    });
  }
  if (view.offers > 0) {
    letters.push({
      icon: "echange",
      title: plural(view.offers, "offre reçue", "offres reçues"),
      detail: "Échanges",
      href: "/echanges",
    });
  }

  return (
    <Dialog open={open} title="Courrier" onClose={onClose}>
      {letters.length === 0 ? (
        <p className={styles.empty}>Boîte vide. Le facteur repassera.</p>
      ) : (
        <ul className={styles.letters}>
          {letters.map((letter) => {
            const content = (
              <>
                <span className={styles.letterIcon}>
                  <Icon name={letter.icon} size={20} />
                </span>
                <span className={styles.letterText}>
                  <span className={styles.letterTitle}>{letter.title}</span>
                  <span className={styles.letterDetail}>{letter.detail}</span>
                </span>
              </>
            );
            return (
              <li key={letter.title}>
                {letter.href !== undefined ? (
                  <Link href={letter.href} className={styles.letter} onClick={onClose}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.letter}
                    onClick={() => {
                      onClose();
                      letter.action?.();
                    }}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
