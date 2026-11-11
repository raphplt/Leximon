"use client";

import type { PatronThanksResponse } from "@leximon/contract";
import { THANKS_EMPTY, THANKS_FAILED, thanksGroups } from "@leximon/view-model";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PatronBadge } from "@/components/patron-badge";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";
import { Tailpiece } from "@/ui/ornaments";
import ui from "@/ui/ui.module.css";
import styles from "./patrons-list.module.css";

/** The patrons thanked, founders first; each pseudo leads to its public profile. */
export function PatronsList() {
  const [thanks, setThanks] = useState<PatronThanksResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api
      .fetchPatronThanks()
      .then(setThanks)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) {
    return (
      <section className={`${styles.group} ${ui.leaf}`}>
        <p>{THANKS_FAILED}</p>
        <Button variant="secondary" onClick={load}>
          Réessayer
        </Button>
      </section>
    );
  }
  if (thanks === null) return null;
  const groups = thanksGroups(thanks.patrons);
  if (groups.length === 0) {
    return (
      <section className={`${styles.group} ${ui.leaf}`}>
        <p>{THANKS_EMPTY}</p>
      </section>
    );
  }
  return (
    <>
      {groups.map((group) => (
        <section key={group.title} className={`${styles.group} ${styles.framed} ${ui.leaf}`}>
          <h2 className={styles.heading}>
            {group.title}
            <PatronBadge mark={group.founder ? "founder" : "patron"} compact />
          </h2>
          <ul className={styles.names}>
            {group.pseudos.map((pseudo) => (
              <li key={pseudo}>
                <Link href={`/joueur/${encodeURIComponent(pseudo)}`} className={styles.name}>
                  {pseudo}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Tailpiece className={styles.tailpiece} />
    </>
  );
}
