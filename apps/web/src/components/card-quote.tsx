"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * The quote on a card face takes the room the definition leaves, in whole lines: the last one ends
 * with « … » instead of being cut through, and the quote leaves the face when not one line fits.
 * The card scales as a whole, so the count holds at any width: it is measured once, then again
 * when the fonts arrive.
 */
export function CardQuote({
  text,
  author,
  className,
  authorClassName,
}: {
  readonly text: string;
  readonly author: string;
  readonly className: string | undefined;
  readonly authorClassName: string | undefined;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  /** Lines that fit; null while measuring, the quote then filling all the room left. */
  const [lines, setLines] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (lines !== null || element === null) return;
    const style = getComputedStyle(element);
    const lineHeight =
      Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.3;
    setLines(Math.floor(element.clientHeight / lineHeight + 0.1));
  }, [lines]);

  useLayoutEffect(() => {
    if (document.fonts.status === "loaded") return;
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) setLines(null);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <p
      ref={ref}
      className={className}
      style={
        lines === null ? undefined : lines === 0 ? { display: "none" } : { WebkitLineClamp: lines }
      }
    >
      « {text} » <span className={authorClassName}>{author}</span>
    </p>
  );
}
