"use client";

import { COMMUNITY_SECTIONS, COMMUNITY_TITLE, communitySectionOf } from "@leximon/view-model";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./community.module.css";

/** Goes between the player's clan, their friends, the players and the clans. */
export function CommunityNav() {
  const pathname = usePathname();
  const current = communitySectionOf(pathname, useSearchParams().get("onglet"));
  return (
    <nav className={styles.nav} aria-label={COMMUNITY_TITLE}>
      {COMMUNITY_SECTIONS.map((section) => (
        <Link
          key={section.id}
          href={section.href}
          className={styles.section}
          aria-current={current === section.id ? "page" : undefined}
          scroll={false}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
