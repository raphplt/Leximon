import type { ComponentProps, ReactNode } from "react";
import styles from "./ui.module.css";

/** A small label that states something. */
export function Chip({
  gold = false,
  className,
  children,
}: {
  readonly gold?: boolean;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <span className={`${styles.chip} ${gold ? styles.chipGold : ""} ${className ?? ""}`}>
      {children}
    </span>
  );
}

/** A small label that can be pressed: a filter, or one choice among a few. */
export function ChipButton({
  on,
  className,
  type = "button",
  ...button
}: { readonly on?: boolean } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      aria-pressed={on}
      className={`${styles.chip} ${className ?? ""}`}
      {...button}
    />
  );
}
