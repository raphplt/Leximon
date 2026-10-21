import styles from "./ui.module.css";

/** A setting that is on or off (R-03). */
export function Switch({
  label,
  detail,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly detail?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={styles.switchRow}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.switchLabel}>
        {label}
        {detail !== undefined && <span className={styles.switchSub}>{detail}</span>}
      </span>
      <span className={styles.track} aria-hidden="true" />
    </button>
  );
}
