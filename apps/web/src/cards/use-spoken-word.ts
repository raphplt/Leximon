"use client";

import type { CatalogCard } from "@leximon/contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { catalogFileUrl } from "./catalog";

export interface SpokenWord {
  /** False when the card has no pronunciation yet: show no button. */
  readonly available: boolean;
  readonly playing: boolean;
  /** From the start, even when it is already playing. */
  readonly play: () => void;
}

/**
 * The word of a card read by the catalogue's voice, free for everyone. The file
 * is fetched on the first play only, and the sound stops when the component goes away.
 */
export function useSpokenWord(card: CatalogCard): SpokenWord {
  const path = card.pronunciation?.audio ?? null;
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // A new card drops the previous card's sound: `path` is the trigger, not a value read here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the word changes
  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
      setPlaying(false);
    },
    [path],
  );

  const play = useCallback(() => {
    if (path === null) return;
    audio.current ??= new Audio(catalogFileUrl(path));
    const sound = audio.current;
    sound.currentTime = 0;
    sound.onended = () => setPlaying(false);
    setPlaying(true);
    // Refused before any gesture on the page, or a network error: the button just stays quiet.
    sound.play().catch(() => setPlaying(false));
  }, [path]);

  return { available: path !== null, playing, play };
}
