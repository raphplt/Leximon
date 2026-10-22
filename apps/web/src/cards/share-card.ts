"use client";

import type { CatalogCard } from "@leximon/contract";
import { cardPath, shareText } from "@leximon/view-model";
import { useCallback, useRef } from "react";

export type ShareOutcome = "shared" | "copied" | "cancelled";

/**
 * Shares a card: its text and the link to its public page, whose preview shows the card's
 * image. Where the phone takes files, the image itself goes along too, if it was fetched in
 * time: it is asked for when the finger or the pointer reaches the button, because the share
 * sheet must open within the click, without waiting for a download.
 */
export function useCardShare(card: CatalogCard) {
  const image = useRef<{ readonly cardId: string; file: File | null } | null>(null);

  const prepare = useCallback(() => {
    if (image.current?.cardId === card.id || !canShareFiles()) return;
    const entry: { readonly cardId: string; file: File | null } = { cardId: card.id, file: null };
    image.current = entry;
    fetch(`${cardPath(card.id)}/opengraph-image`)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (blob !== null) {
          entry.file = new File([blob], `leximon-${card.id}.png`, { type: "image/png" });
        }
      })
      .catch(() => {
        // No image: the link alone is shared.
      });
  }, [card.id]);

  const share = useCallback(async (): Promise<ShareOutcome> => {
    const text = shareText(card.word, card.perBillion);
    const url = new URL(cardPath(card.id), window.location.origin).toString();
    const file = image.current?.cardId === card.id ? image.current.file : null;
    try {
      if (typeof navigator.share === "function") {
        const files = file !== null && navigator.canShare?.({ files: [file] }) ? [file] : [];
        await navigator.share({
          title: "Leximon",
          text,
          url,
          ...(files.length > 0 ? { files } : {}),
        });
        return "shared";
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      return "copied";
    } catch {
      // Share sheet closed, or clipboard refused: nothing to report.
      return "cancelled";
    }
  }, [card]);

  return { prepare, share };
}

function canShareFiles(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function";
}
