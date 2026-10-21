import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./ui.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface Look {
  readonly variant?: ButtonVariant | undefined;
  readonly small?: boolean | undefined;
  readonly wide?: boolean | undefined;
  readonly glow?: boolean | undefined;
}

function classes(
  { variant = "primary", small, wide, glow }: Look,
  extra?: string | undefined,
): string {
  return [
    styles[variant],
    small ? styles.small : "",
    wide ? styles.wide : "",
    glow ? styles.glow : "",
    extra ?? "",
  ].join(" ");
}

/** Main, secondary or discreet button: a verb and an object (voix.md). */
export function Button({
  variant,
  small,
  wide,
  glow,
  className,
  type = "button",
  ...props
}: Look & ComponentProps<"button">) {
  return (
    <button type={type} className={classes({ variant, small, wide, glow }, className)} {...props} />
  );
}

/** A link that looks like a button: it leads to another screen. */
export function ButtonLink({
  variant,
  small,
  wide,
  glow,
  className,
  ...props
}: Look & ComponentProps<typeof Link>) {
  return <Link className={classes({ variant, small, wide, glow }, className)} {...props} />;
}

/** A round icon button (back, close, mail); `label` is its accessible name. */
export function RoundButton({
  label,
  children,
  className,
  ...props
}: { readonly label: string; readonly children: ReactNode } & Omit<
  ComponentProps<"button">,
  "aria-label"
>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`${styles.round} ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
