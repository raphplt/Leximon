"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import styles from "./help-tip.module.css";
import { Icon, type IconName } from "./icon";

const GAP = 10;
const MARGIN = 12;

/**
 * A small « ? » and the popover it opens, pointing at it: the rule of a game screen, kept off
 * the screen until the player asks. The browser's popover lays it above everything, closes it
 * on a click outside or Escape; it opens on the side where it fits.
 */
export function HelpTip({
  label,
  title,
  children,
  side = "below",
  tone = "paper",
  icon = "help",
}: {
  /** The button's name, read by screen readers. */
  readonly label: string;
  readonly title?: string | undefined;
  readonly children: ReactNode;
  /** The side it prefers, when both fit. */
  readonly side?: "below" | "above";
  /** The surface the button sits on: dark ink on paper, cream on the felt. */
  readonly tone?: "paper" | "felt";
  readonly icon?: IconName;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    const element = popover.current;
    const anchor = button.current;
    if (element === null || anchor === null) return;
    const place = () => {
      const from = anchor.getBoundingClientRect();
      const size = element.getBoundingClientRect();
      // The page's width, without the gutter its scrollbar keeps even while a panel locks it.
      const width = Math.min(
        document.documentElement.clientWidth,
        document.body.getBoundingClientRect().right,
      );
      const height = document.documentElement.clientHeight;
      const fitsBelow = from.bottom + GAP + size.height <= height - MARGIN;
      const fitsAbove = from.top - GAP - size.height >= MARGIN;
      const below = side === "below" ? fitsBelow || !fitsAbove : !fitsAbove && fitsBelow;
      const center = from.left + from.width / 2;
      const left = Math.min(Math.max(center - size.width / 2, MARGIN), width - MARGIN - size.width);
      element.style.top = `${below ? from.bottom + GAP : from.top - GAP - size.height}px`;
      element.style.left = `${left}px`;
      element.style.setProperty("--arrow-x", `${center - left}px`);
      element.dataset["side"] = below ? "below" : "above";
    };
    const onToggle = (event: Event) => {
      const open = (event as ToggleEvent).newState === "open";
      anchor.setAttribute("aria-expanded", String(open));
      if (open) {
        place();
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
      } else {
        delete element.dataset["side"];
        window.removeEventListener("resize", place);
        window.removeEventListener("scroll", place, true);
      }
    };
    element.addEventListener("toggle", onToggle);
    return () => {
      element.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [side]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`${styles.button} ${styles[tone]}`}
        aria-label={label}
        aria-expanded="false"
        popoverTarget={id}
      >
        <Icon name={icon} size={20} />
      </button>
      <div ref={popover} id={id} popover="auto" role="note" className={styles.popover}>
        {title !== undefined && <strong className={styles.title}>{title}</strong>}
        {children}
      </div>
    </>
  );
}
