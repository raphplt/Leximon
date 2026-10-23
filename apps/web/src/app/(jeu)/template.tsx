import type { ReactNode } from "react";
import styles from "@/shell/game-shell.module.css";

/** Remounted on every move between game screens, so that each one arrives with a fade. */
export default function GameTemplate({ children }: { readonly children: ReactNode }) {
  return <div className={styles.screen}>{children}</div>;
}
