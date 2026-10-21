"use client";

import { type ReactNode, useEffect, useRef } from "react";
import styles from "./dialog.module.css";
import { Icon } from "./icon";

/**
 * Secondary content over the screen (C-05): a panel on the right on the web, a sheet rising from
 * the bottom under 760 px, or a window in the middle (`center`, or `wide` for a card sheet). A native modal `<dialog>`: the
 * focus stays inside and goes back where it was on closing; Escape, the cross and the backdrop
 * close it.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  variant = "side",
  hideTitle = false,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** `wide`: a large window in the middle on the web (a card sheet), a sheet on phones. */
  readonly variant?: "side" | "center" | "wide";
  /** The content draws its own heading; the title still names the dialog. */
  readonly hideTitle?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard closes it with Escape (`cancel`)
    <dialog
      ref={ref}
      className={styles[variant]}
      aria-label={title}
      onCancel={(event) => {
        // Escape: React keeps the state, the dialog closes through it.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself, outside its box.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={styles.box}>
          {variant !== "center" && <span className={styles.handle} aria-hidden="true" />}
          <div className={hideTitle ? styles.headFloating : styles.head}>
            {!hideTitle && <h2 className={styles.title}>{title}</h2>}
            <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer">
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className={styles.body}>{children}</div>
        </div>
      )}
    </dialog>
  );
}
