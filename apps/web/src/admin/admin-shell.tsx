"use client";

import { SIGN_IN_QUERY } from "@leximon/view-model";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { adminApi } from "@/admin/admin-api";
import styles from "./admin.module.css";

const LINKS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/joueurs", label: "Joueurs" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/mesure", label: "Mesure" },
  { href: "/admin/emails", label: "E-mails" },
  { href: "/admin/retours", label: "Retours" },
  { href: "/admin/campagnes", label: "Campagnes" },
  { href: "/admin/echanges", label: "Échanges" },
  { href: "/admin/signalements", label: "Signalements" },
  { href: "/admin/contestations", label: "Contestations" },
  { href: "/admin/cartes", label: "Cartes" },
  { href: "/admin/catalogue", label: "Collections" },
  { href: "/admin/journal", label: "Journal" },
] as const;

type Access =
  | { readonly kind: "loading" }
  | { readonly kind: "signed_out" }
  | { readonly kind: "denied" }
  | { readonly kind: "failed" }
  | { readonly kind: "admin"; readonly email: string };

/**
 * Frame of the back office. Hides the pages from anyone who is not an admin; the real protection
 * is on the server, which checks the role on every `/admin` route.
 */
export function AdminShell({ children }: { readonly children: ReactNode }) {
  const [access, setAccess] = useState<Access>({ kind: "loading" });

  useEffect(() => {
    adminApi
      .fetchAdminAccess()
      .then(setAccess)
      .catch(() => setAccess({ kind: "failed" }));
  }, []);

  // The pages stay mounted while access is checked: they render in the prerendered shell (Cache
  // Components) and start loading at once. A refused request only shows nothing.
  const showPages = access.kind === "loading" || access.kind === "admin";
  const gate =
    access.kind === "admin" ? null : (
      <main className={styles.center}>
        <div>
          <h1 className={styles.title}>Administration</h1>
          {access.kind === "loading" && <p className={styles.muted}>Un instant…</p>}
          {access.kind === "failed" && <p className={styles.error}>L'API ne répond pas.</p>}
          {access.kind === "signed_out" && (
            <>
              <p className={styles.muted}>Connecte-toi avec ton adresse admin pour continuer.</p>
              <Link href={`/compte?${SIGN_IN_QUERY}`} className={styles.primary}>
                Me connecter
              </Link>
            </>
          )}
          {access.kind === "denied" && (
            <p className={styles.muted}>Ce compte n'a pas accès à l'administration.</p>
          )}
        </div>
      </main>
    );

  return (
    <>
      {gate}
      {showPages && (
        <div
          className={styles.shell}
          style={access.kind === "admin" ? undefined : { display: "none" }}
        >
          <aside className={styles.side}>
            <Link href="/admin" className={styles.brand}>
              Leximon
              <small>Administration</small>
            </Link>
            {/* The address is known only per request: the current link is marked once it streams in. */}
            <Suspense fallback={<NavLinks pathname={null} />}>
              <CurrentNavLinks />
            </Suspense>
            <p className={styles.who}>{access.kind === "admin" ? access.email : ""}</p>
          </aside>
          <main className={styles.main}>{children}</main>
        </div>
      )}
    </>
  );
}

function CurrentNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { readonly pathname: string | null }) {
  return (
    <ul className={styles.nav}>
      {LINKS.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className={styles.navLink}
            aria-current={pathname !== null && isCurrent(pathname, link.href) ? "page" : undefined}
          >
            {link.label}
          </Link>
        </li>
      ))}
      <li>
        <Link href="/jouer" className={styles.navLink}>
          Retour au jeu
        </Link>
      </li>
    </ul>
  );
}

function isCurrent(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}
