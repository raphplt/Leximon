"use client";

import { claimableMailTitle, coffretsLabel, plural, tierName } from "@leximon/view-model";
import Link from "next/link";
import { useClaim } from "@/clan/claim";
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
  const claim = useClaim();
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
  if (view.claimable.length > 0) {
    letters.push({
      icon: "clan",
      title: claimableMailTitle(view.claimable.length),
      detail: `Objectif de clan · ${view.claimable.map((c) => tierName(c.tier)).join(", ")}`,
      action: () => {
        for (const goal of view.claimable) void claim(goal);
      },
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
