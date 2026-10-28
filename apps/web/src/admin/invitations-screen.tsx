"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./admin.module.css";
import { InvitesScreen } from "./invites-screen";
import { WaitlistScreen } from "./waitlist-screen";

const TABS = [
  { key: "liens", label: "Liens d'invitation", href: "/admin/invitations" },
  { key: "attente", label: "Liste d'attente", href: "/admin/invitations?onglet=attente" },
] as const;

/** Who comes into the closed beta: the invitation links, and the addresses waiting for one. */
export function InvitationsScreen() {
  const tab = useSearchParams().get("onglet") === "attente" ? "attente" : "liens";
  return (
    <>
      <h1 className={styles.title}>Invitations</h1>
      <nav className={`${styles.segmented} ${styles.tabs}`} aria-label="Onglets">
        {TABS.map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            className={styles.segment}
            aria-current={tab === key ? "page" : undefined}
            scroll={false}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "attente" ? <WaitlistScreen /> : <InvitesScreen />}
    </>
  );
}
