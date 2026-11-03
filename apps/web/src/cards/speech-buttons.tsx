"use client";

import { speechToggleLabel } from "@leximon/view-model";
import { useState } from "react";
import { readPreference, writePreference } from "@/booster/feedback";
import { Icon } from "@/ui/icon";
import styles from "./speech-buttons.module.css";
import type { SpokenWord } from "./use-spoken-word";

/**
 * Beside a word the catalogue's voice can say: a button to hear it again, and the speaker that
 * stops the words from being said, through the setting of the same name.
 */
export function SpeechButtons({
  word,
  label,
}: {
  readonly word: SpokenWord;
  /** The word itself, for the button's name. */
  readonly label: string;
}) {
  if (!word.available) return null;
  return (
    <>
      <button
        type="button"
        className={word.playing ? `${styles.listen} ${styles.listening}` : styles.listen}
        onClick={word.play}
        aria-label={`Écouter ${label}`}
      >
        <Icon name="play" size={18} />
      </button>
      <SpeechToggle word={word} />
    </>
  );
}

/** With all sounds off nothing is said anyway: nothing to offer. */
function SpeechToggle({ word }: { readonly word: SpokenWord }) {
  const [on, setOn] = useState(() => readPreference("speech"));
  if (!readPreference("sound")) return null;
  const toggle = () => {
    writePreference("speech", !on);
    setOn(!on);
    if (on) word.stop();
  };
  return (
    <button
      type="button"
      className={styles.listen}
      onClick={toggle}
      aria-label={speechToggleLabel(on)}
    >
      <Icon name={on ? "sound" : "soundOff"} size={18} />
    </button>
  );
}
