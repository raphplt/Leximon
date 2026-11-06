import type { ClanEntryMode } from "@leximon/contract";
import { type ClanFact, clanFacts } from "@leximon/view-model";
import { Icon, type IconName } from "@/ui/icon";
import styles from "./clan.module.css";

const FACT_ICONS: Readonly<Record<ClanFact["kind"], IconName>> = {
  members: "amis",
  open: "porte",
  request: "courrier",
  invite: "cle",
};

/** The clan's size and how one enters it, each behind its icon, above the header's buttons. */
export function ClanFacts({
  clan,
}: {
  readonly clan: { readonly memberCount: number; readonly entryMode: ClanEntryMode };
}) {
  return (
    <ul className={styles.heroFacts}>
      {clanFacts(clan).map((fact) => (
        <li key={fact.kind} className={styles.heroFact}>
          <Icon name={FACT_ICONS[fact.kind]} size={18} />
          {fact.label}
        </li>
      ))}
    </ul>
  );
}
