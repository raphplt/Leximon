import type { PatronMarkView } from "@leximon/contract";
import { patronMarkHint, patronMarkLabel } from "@leximon/view-model";
import { Icon } from "@/ui/icon";
import styles from "./patron-badge.module.css";

/** The patron's badge, beside the pseudo; `compact` keeps only the crown, for a list. */
export function PatronBadge({
  mark,
  compact = false,
}: {
  readonly mark: PatronMarkView;
  readonly compact?: boolean;
}) {
  const label = patronMarkLabel(mark);
  const hint = patronMarkHint(mark);
  if (label === null || hint === null) return null;
  return (
    <span
      className={styles.badge}
      data-founder={mark === "founder"}
      title={hint}
      {...(compact ? { role: "img", "aria-label": label } : {})}
    >
      <Icon name="crown" size={compact ? 14 : 16} />
      {!compact && label}
    </span>
  );
}
