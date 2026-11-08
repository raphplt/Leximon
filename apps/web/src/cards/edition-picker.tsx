"use client";

import { editionColors } from "@leximon/tokens";
import {
  EDITION_ALBUM_ACTION,
  EDITION_FAILED,
  EDITION_PLAIN,
  EDITIONS_NOTE,
  EDITIONS_TITLE,
  editionAlbumDone,
  editionName,
  editionOfCard,
} from "@leximon/view-model";
import type { CSSProperties } from "react";
import { useState } from "react";
import { api } from "@/lib/api";
import { editions } from "@/player/player";
import { useShared } from "@/player/resource";
import { Button } from "@/ui/button";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./edition-picker.module.css";

/**
 * The library editions a patron prints this owned card in, or the whole album. Nothing shows for
 * a player who owns none: the offer is never made here.
 */
export function EditionPicker({ cardId }: { readonly cardId: string }) {
  const mine = useShared(editions);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (mine === null || mine.owned.length === 0) return null;
  const current = editionOfCard(mine, cardId);

  const choose = async (edition: string | null) => {
    if (busy || edition === current) return;
    setBusy(true);
    editions.publish({ ...mine, cards: { ...mine.cards, [cardId]: edition } });
    try {
      const result = await api.setCardEdition(cardId, edition);
      if (result.kind === "refused") throw new Error(result.reason);
    } catch {
      toast(EDITION_FAILED);
      editions.refresh();
    } finally {
      setBusy(false);
    }
  };

  const wholeAlbum = async () => {
    if (busy) return;
    setBusy(true);
    editions.publish({ ...mine, album: current, cards: {} });
    try {
      const result = await api.setAlbumEdition(current);
      if (result.kind === "refused") throw new Error(result.reason);
      toast(editionAlbumDone(current));
    } catch {
      toast(EDITION_FAILED);
      editions.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.picker}>
      <p className={ui.kicker}>{EDITIONS_TITLE}</p>
      <fieldset className={styles.options} aria-label={EDITIONS_TITLE}>
        {[null, ...mine.owned].map((edition) => {
          const colors = editionColors(edition);
          const swatch =
            colors === null
              ? undefined
              : ({ "--paper": colors.paper, "--ink": colors.ink } as CSSProperties);
          return (
            <button
              key={edition ?? "plain"}
              type="button"
              aria-pressed={edition === current}
              className={styles.option}
              disabled={busy}
              onClick={() => void choose(edition)}
            >
              <span className={colors === null ? styles.plain : styles.swatch} style={swatch} />
              {edition === null ? EDITION_PLAIN : editionName(edition)}
            </button>
          );
        })}
      </fieldset>
      <Button variant="ghost" small disabled={busy} onClick={() => void wholeAlbum()}>
        {EDITION_ALBUM_ACTION}
      </Button>
      <p className={styles.note}>{EDITIONS_NOTE}</p>
    </div>
  );
}
