"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { capitalize } from "@/lib/pack-shape";
import { usePackShape } from "@/lib/use-pack-shape";
import { levelDescription, levelRatio } from "@/progress/progress";
import { useProgress } from "@/progress/use-progress";
import styles from "./nav-bar.module.css";

const LINKS = [
  // The pack's own word: « Plis » or « Sachets », depending on the shape the player sees (P53).
  { href: "/jouer", label: null },
  { href: "/album", label: "Album" },
  { href: "/defis", label: "Défis" },
  { href: "/echanges", label: "Échanges" },
] as const;

export function NavBar() {
  const pathname = usePathname();
  const { noun } = usePackShape();
  const progress = useProgress();
  return (
    <nav className={styles.bar} aria-label="Navigation principale">
      <Link href="/jouer" className={styles.logo} aria-label="Leximon">
        L<span className={styles.logoRest}>eximon</span>
      </Link>
      <ul className={styles.links}>
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={styles.link}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label ?? capitalize(noun.many)}
            </Link>
          </li>
        ))}
      </ul>
      {/* An icon, or the level once known: four words already fill a phone's width. */}
      <Link
        href="/compte"
        className={progress === null ? styles.account : styles.level}
        aria-label={progress === null ? "Compte" : `Compte, ${levelDescription(progress)}`}
        title={progress === null ? "Compte" : levelDescription(progress)}
        aria-current={pathname === "/compte" ? "page" : undefined}
        style={
          progress === null
            ? undefined
            : ({ "--ratio": `${(levelRatio(progress) * 360).toFixed(1)}deg` } as CSSProperties)
        }
      >
        {progress !== null ? (
          <span className={styles.levelNumber} aria-hidden="true">
            {progress.level}
          </span>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path
              d="M4.5 20.5c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        )}
      </Link>
    </nav>
  );
}
