import type { ClanEntryMode, CreateClanRequest, EmblemView } from "@leximon/contract";
import { emblemColor } from "@leximon/tokens";
import { capitalize, emblemColorName, entryModeLabel } from "@leximon/view-model";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { catalogInHand } from "@/cards/catalog";
import { Emblem } from "@/clan/emblem";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { FormError } from "@/ui/page";
import { TextField } from "@/ui/text-field";

const ENTRY_MODES: readonly ClanEntryMode[] = ["open", "request", "invite"];

/**
 * Name, motto, entry and emblem of a clan: founding it or changing it, chief only.
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
  const catalog = catalogInHand();

  const setColor = (index: 0 | 1, color: string) =>
    setEmblem((current) => ({
      ...current,
      colors: index === 0 ? [color, current.colors[1]] : [current.colors[0], color],
    }));

  return (
    <View style={styles.form}>
      <View style={styles.preview}>
        <Emblem emblem={emblem} size={64} />
        <View style={styles.previewText}>
          <Text style={styles.previewName}>{name.trim() || "Ton clan"}</Text>
          {motto.trim() !== "" && <Text style={styles.small}>« {motto.trim()} »</Text>}
        </View>
      </View>

      <TextField label="Nom" value={name} maxLength={30} onChangeText={setName} />
      <TextField
        label="Devise"
        value={motto}
        maxLength={80}
        placeholder="Facultative"
        onChangeText={setMotto}
      />

      <Text style={styles.label}>Entrée</Text>
      <View style={styles.chips}>
        {ENTRY_MODES.map((mode) => (
          <Chip
            key={mode}
            label={capitalize(entryModeLabel(mode))}
            on={entryMode === mode}
            onPress={() => setEntryMode(mode)}
          />
        ))}
      </View>

      <Text style={styles.label}>Gravure</Text>
      <View style={styles.engravings}>
        {choices.engravings.map((engraving) => {
          const picked = emblem.engraving === engraving;
          return (
            <Pressable
              key={engraving}
              onPress={() => setEmblem((current) => ({ ...current, engraving }))}
              accessibilityRole="radio"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={catalog?.cardsById.get(engraving)?.word ?? engraving}
              style={[styles.engraving, picked && styles.picked]}
            >
              <Emblem emblem={{ ...emblem, engraving }} size={40} />
            </Pressable>
          );
        })}
      </View>

      {([0, 1] as const).map((index) => (
        <View key={index} style={styles.group}>
          <Text style={styles.label}>{index === 0 ? "Fond" : "Encre"}</Text>
          <View style={styles.swatches}>
            {choices.colors.map((color) => {
              const picked = emblem.colors[index] === color;
              return (
                <Pressable
                  key={color}
                  onPress={() => setColor(index, color)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: picked }}
                  accessibilityLabel={emblemColorName(color)}
                  style={[
                    styles.swatch,
                    { backgroundColor: emblemColor(color) },
                    picked && styles.swatchPicked,
                  ]}
                />
              );
            })}
          </View>
        </View>
      ))}

      <FormError message={error} />
      <Button
        label={submitLabel}
        disabled={busy || name.trim() === ""}
        onPress={() => onSubmit({ name: name.trim(), motto: motto.trim(), entryMode, emblem })}
      />
    </View>
  );
}

/** It is read on a sheet, a leaf of paper in « La Bibliothèque ». */
const ink = paperColors;

const styles = StyleSheet.create({
  form: { gap: space.s7 },
  preview: { flexDirection: "row", alignItems: "center", gap: space.s8 },
  previewText: { flex: 1, gap: space.s1 },
  previewName: { fontFamily: fonts.display, fontSize: fontSizes.title, color: ink.pageInk },
  small: { fontFamily: fonts.ui.medium, fontSize: fontSizes.label, color: ink.pageInkMuted },
  label: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInkMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s4 },
  group: { gap: space.s4 },
  engravings: { flexDirection: "row", flexWrap: "wrap", gap: space.s4 },
  engraving: {
    padding: space.s3,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  picked: { borderColor: ink.gilt },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: space.s5 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: ink.rule },
  swatchPicked: { borderWidth: 3, borderColor: ink.gilt },
});
