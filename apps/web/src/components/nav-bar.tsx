"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePackShape } from "@/lib/experiments";
import { capitalize } from "@/lib/pack-shape";
import styles from "./nav-bar.module.css";

const LINKS = [
  // The pack's own word: « Plis » or « Sachets », depending on the shape the player sees (P53).
  { href: "/", label: null },
  { href: "/album", label: "Album" },
  { href: "/defis", label: "Défis" },
  { href: "/echanges", label: "Échanges" },
] as const;

export function NavBar() {
  const pathname = usePathname();
  const { noun } = usePackShape();
  return (
    <nav className={styles.bar} aria-label="Navigation principale">
      <Link href="/" className={styles.logo} aria-label="Leximon">
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
    </nav>
  );
}
