"use client";

import type { ClanEntryMode, CreateClanRequest, EmblemView } from "@leximon/contract";
import { emblemColor } from "@leximon/tokens";
import { capitalize, emblemColorName, entryModeLabel } from "@leximon/view-model";
import { type FormEvent, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { Button } from "@/ui/button";
import ui from "@/ui/ui.module.css";
import styles from "./clan.module.css";
import { Emblem } from "./emblem";

const ENTRY_MODES: readonly ClanEntryMode[] = ["open", "request", "invite"];

/**
 * Name, motto, entry and emblem of a clan: founding it (K-09) or changing it, chief only (K-10).
 * The server checks everything again; its refusal comes back in `error`.
 */
export function ClanForm({
  initial,
  choices,
  submitLabel,
  busy,
  error,
  onSubmit,
}: {
  readonly initial: CreateClanRequest;
  readonly choices: { readonly engravings: readonly string[]; readonly colors: readonly string[] };
  readonly submitLabel: string;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSubmit: (value: CreateClanRequest) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [motto, setMotto] = useState(initial.motto);
  const [entryMode, setEntryMode] = useState(initial.entryMode);
  const [emblem, setEmblem] = useState<EmblemView>(initial.emblem);
  const catalog = useCatalog();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ name: name.trim(), motto: motto.trim(), entryMode, emblem });
  };
  const setColor = (index: 0 | 1, color: string) =>
    setEmblem((current) => ({
      ...current,
      colors: index === 0 ? [color, current.colors[1]] : [current.colors[0], color],
    }));

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formPreview}>
        <Emblem emblem={emblem} size={64} />
        <div>
          <p className={`${ui.display} ${styles.previewName}`}>{name.trim() || "Ton clan"}</p>
          {motto.trim() !== "" && <p className={styles.small}>« {motto.trim()} »</p>}
        </div>
      </div>

      <label className={styles.formField}>
        <span className={styles.formLabel}>Nom</span>
        <input
          className={ui.field}
          value={name}
          maxLength={30}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className={styles.formField}>
        <span className={styles.formLabel}>Devise</span>
        <input
          className={ui.field}
          value={motto}
          maxLength={80}
          placeholder="Facultative"
          onChange={(event) => setMotto(event.target.value)}
        />
      </label>

      <fieldset className={styles.fieldset}>
        <legend className={styles.formLabel}>Entrée</legend>
        <div className={styles.chips}>
          {ENTRY_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={ui.chip}
              aria-pressed={entryMode === mode}
              onClick={() => setEntryMode(mode)}
            >
              {capitalize(entryModeLabel(mode))}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.formLabel}>Gravure</legend>
        <div className={styles.engravings}>
          {choices.engravings.map((engraving) => (
            <button
              key={engraving}
              type="button"
              className={styles.engravingChoice}
              aria-pressed={emblem.engraving === engraving}
              aria-label={catalog?.cardsById.get(engraving)?.word ?? engraving}
              onClick={() => setEmblem((current) => ({ ...current, engraving }))}
            >
              <Emblem emblem={{ ...emblem, engraving }} size={40} />
            </button>
          ))}
        </div>
      </fieldset>

      {([0, 1] as const).map((index) => (
        <fieldset key={index} className={styles.fieldset}>
          <legend className={styles.formLabel}>{index === 0 ? "Fond" : "Encre"}</legend>
          <div className={styles.swatches}>
            {choices.colors.map((color) => (
              <button
                key={color}
                type="button"
                className={styles.swatch}
                style={{ background: emblemColor(color) }}
                aria-pressed={emblem.colors[index] === color}
                aria-label={emblemColorName(color)}
                title={emblemColorName(color)}
                onClick={() => setColor(index, color)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {error !== null && (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      )}
      <Button type="submit" wide disabled={busy || name.trim() === ""}>
        {submitLabel}
      </Button>
    </form>
  );
}
