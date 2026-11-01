import {
  lettrineFor,
  type PlateName,
  plates,
  type ToolName,
  toolGrid,
  tools,
} from "@leximon/tokens";
import type { ReactNode } from "react";
import styles from "./ui.module.css";

/** A binder's tool, in the color of the text around it. Decorative. */
export function Tool({ name, size = 16 }: { readonly name: ToolName; readonly size?: number }) {
  return (
    <svg
      className={styles.tool}
      width={size}
      height={size}
      viewBox={`0 0 ${toolGrid} ${toolGrid}`}
      aria-hidden="true"
    >
      <path d={tools[name]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** The four rules: a thin one, thick and thin together, a row of dots, a tool in the middle. */
export type FiletKind = "maigre" | "gras-maigre" | "perle" | "fleuron";

const FILET_CLASSES = {
  maigre: styles.filetMaigre,
  "gras-maigre": styles.filetGras,
  perle: styles.filetPerle,
} as const;

export function Filet({
  kind = "maigre",
  tool = "losange",
}: {
  readonly kind?: FiletKind;
  readonly tool?: ToolName;
}) {
  if (kind === "fleuron") {
    return (
      <span className={styles.filetFleuron} role="presentation">
        <Tool name={tool} size={13} />
      </span>
    );
  }
  return <span className={FILET_CLASSES[kind]} role="presentation" />;
}

/** A gold plate with a slow reflection. One on a screen at most: it is the reward's own light. */
export function Gilt({ children }: { readonly children: ReactNode }) {
  return <span className={styles.gilt}>{children}</span>;
}

/** An ornament from an old book, inked in the color of the text around it. Decorative. */
export function Plate({ name, width }: { readonly name: PlateName; readonly width: number }) {
  const plate = plates[name];
  return (
    <span
      className={styles.plate}
      role="presentation"
      style={{
        width,
        aspectRatio: `${plate.width} / ${plate.height}`,
        maskImage: `url(/ornements/${name}.webp)`,
      }}
    />
  );
}

/** A paragraph opened by an ornate capital, when the alphabet has one for its first letter. */
export function LettrineParagraph({ children }: { readonly children: string }) {
  const capital = lettrineFor(children);
  if (capital === null) return <p className={styles.lettrined}>{children}</p>;
  return (
    <p className={styles.lettrined}>
      <Plate name={capital} width={64} />
      <span className={styles.spoken}>{children.charAt(0)}</span>
      {children.slice(1)}
    </p>
  );
}
