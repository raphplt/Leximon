import { THANKS_PAGE_INTRO, THANKS_PAGE_TITLE } from "@leximon/view-model";
import type { Metadata } from "next";
import Link from "next/link";
import { PatronsList } from "@/beta/patrons-list";
import listStyles from "@/beta/patrons-list.module.css";
import ui from "@/ui/ui.module.css";
import styles from "../confidentialite/privacy.module.css";

export const metadata: Metadata = {
  title: "Les mécènes · Leximon",
  description: THANKS_PAGE_INTRO,
};

/** The public page of thanks. It sells nothing: no price, no button, no link to the offer. */
export default function PatronsPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={`${styles.title} ${ui.lettered}`}>{THANKS_PAGE_TITLE}</h1>
      <p className={listStyles.intro}>{THANKS_PAGE_INTRO}</p>
      <PatronsList />
    </main>
  );
}
