import { CHANGELOG, changelogDate } from "@leximon/view-model";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Tailpiece } from "@/ui/ornaments";
import ui from "@/ui/ui.module.css";
import styles from "../confidentialite/privacy.module.css";

export const metadata: Metadata = {
  title: "Nouveautés · Leximon",
  description: "Ce qui a changé dans Leximon, mise à jour après mise à jour.",
};

/** Every entry of the changelog, newest first: the pop-up shows each one once, this page keeps them. */
export default function NewsPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={`${styles.title} ${ui.lettered}`}>Nouveautés</h1>
      {CHANGELOG.map((entry, index) => (
        <Fragment key={entry.date}>
          {index > 0 && <Tailpiece className={styles.tailpiece} />}
          <section className={`${styles.section} ${styles.framed} ${ui.leaf}`}>
            <h2>{entry.title}</h2>
            <p className={styles.updated}>{changelogDate(entry.date)}</p>
            <ul>
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </Fragment>
      ))}
    </main>
  );
}
