"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import styles from "./help-tip.module.css";
import { Icon, type IconName } from "./icon";

/**
 * A small « ? » that opens a bubble under it: the rule of a game screen, kept off the screen
 * until the player asks. A click outside or Escape closes it.
 */
export function HelpTip({
  label,
  title,
  children,
  align = "end",
  above = false,
  icon = "help",
}: {
  /** The button's name, read by screen readers. */
  readonly label: string;
  readonly title?: string | undefined;
  readonly children: ReactNode;
  /** Which edge of the button the bubble lines up with. */
  readonly align?: "start" | "end" | "center";
  /** Opens upward, for a « ? » at the bottom of a screen. */
  readonly above?: boolean;
  readonly icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !root.current?.contains(event.target as Node)
      ) {
        if (event instanceof KeyboardEvent) event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close, true);
    };
  }, [open]);

  return (
    <span ref={root} className={styles.root}>
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
      >
        <Icon name={icon} size={18} />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className={`${styles.bubble} ${styles[align]} ${above ? styles.above : ""}`}
        >
          {title !== undefined && <strong className={styles.title}>{title}</strong>}
          {children}
        </span>
      )}
    </span>
  );
}
