import { NEW_TAB_BADGE } from "@leximon/view-model";
import styles from "./new-tag.module.css";

/**
 * « Nouveau », pinned to the corner of what holds it (which is `position: relative`), or in the
 * line of a menu entry. It wiggles now and then to catch the eye, then rests.
 */
export function NewTag({ inline = false }: { readonly inline?: boolean }) {
  return <span className={inline ? styles.inline : styles.corner}>{NEW_TAB_BADGE}</span>;
}
