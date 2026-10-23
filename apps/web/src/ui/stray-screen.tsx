import type { ReactNode } from "react";
import { Icon } from "./icon";
import styles from "./locked-screen.module.css";
import ui from "./ui.module.css";

/** A page off the path (unknown address, crash): what happened, and the way back. */
export function StrayScreen({
  title,
  text,
  children,
}: {
  readonly title: string;
  readonly text: string;
  readonly children: ReactNode;
}) {
  return (
    <main className={`${ui.panel} ${ui.enter} ${styles.screen}`}>
      <span className={styles.icon}>
        <Icon name="carte" size={38} />
      </span>
      <h1 className={`${ui.display} ${styles.title}`}>{title}</h1>
      <p className={styles.text}>{text}</p>
      <div className={styles.actions}>{children}</div>
    </main>
  );
}
