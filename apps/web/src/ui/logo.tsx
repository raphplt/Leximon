import Image from "next/image";
import styles from "./logo.module.css";

interface LogoProps {
  readonly size?: "sm" | "md" | "lg";
  readonly markOnly?: boolean;
  readonly className?: string | undefined;
}

const MARK_SIZES = {
  sm: 24,
  md: 32,
  lg: 42,
} as const;

/**
 * The official Leximon brand logo: the crimson wax seal mark paired with the Fraunces logotype.
 */
export function Logo({ size = "md", markOnly = false, className }: LogoProps) {
  const markDim = MARK_SIZES[size];
  const sizeClass = styles[size];
  const classes = [styles.logo, sizeClass, className].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      <Image
        src="/logo-mark.svg"
        alt=""
        aria-hidden="true"
        width={markDim}
        height={markDim}
        className={styles.mark}
        priority={size !== "sm"}
      />
      {!markOnly && <span className={styles.text}>Leximon</span>}
    </span>
  );
}
