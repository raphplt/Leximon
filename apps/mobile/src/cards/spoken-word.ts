import type { CatalogCard } from "@leximon/contract";
import { type AudioPlayer, createAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { catalogFileUrl } from "./catalog";

export interface SpokenWord {
  /** False when the card has no pronunciation yet: show no button. */
  readonly available: boolean;
  readonly playing: boolean;
  /** From the start, even when it is already playing. */
  readonly play: () => void;
  readonly stop: () => void;
}

/** Sounds already loading before their card shows, by path: only the latest pack's are kept. */
const prepared = new Map<string, AudioPlayer>();

/**
 * Starts loading the words of cards about to show, so that each is said the moment its card
 * settles instead of after a download.
 */
export function prepareSpokenWords(cards: readonly CatalogCard[]): void {
  const paths = new Set(cards.flatMap((card) => card.pronunciation?.audio ?? []));
  for (const [path, player] of prepared) {
    if (paths.has(path)) continue;
    player.remove();
    prepared.delete(path);
  }
  for (const path of paths) {
    if (!prepared.has(path)) prepared.set(path, createAudioPlayer(catalogFileUrl(path)));
  }
}

/**
 * The word of a card read by the catalogue's voice, free for everyone. Unless it was prepared,
 * the file is fetched on the first play only, and the sound stops when the component goes away.
 */
export function useSpokenWord(card: CatalogCard): SpokenWord {
  const path = card.pronunciation?.audio ?? null;
  const audio = useRef<{
    player: AudioPlayer;
    owned: boolean;
    listener: { remove: () => void };
  } | null>(null);
  const [playing, setPlaying] = useState(false);

  // A new card drops the previous card's sound: `path` is the trigger, not a value read here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the word changes
  useEffect(
    () => () => {
      const current = audio.current;
      audio.current = null;
      setPlaying(false);
      if (current === null) return;
      current.listener.remove();
      current.player.pause();
      // A prepared player belongs to the pack: the next card of the same word may use it.
      if (current.owned) current.player.remove();
    },
    [path],
  );

  const play = useCallback(() => {
    if (path === null) return;
    if (audio.current === null) {
      const ready = prepared.get(path);
      const player = ready ?? createAudioPlayer(catalogFileUrl(path));
      const listener = player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) setPlaying(false);
      });
      audio.current = { player, owned: ready === undefined, listener };
    }
    const { player } = audio.current;
    setPlaying(true);
    void player.seekTo(0);
    player.play();
  }, [path]);

  const stop = useCallback(() => {
    audio.current?.player.pause();
    setPlaying(false);
  }, []);

  return { available: path !== null, playing, play, stop };
}
