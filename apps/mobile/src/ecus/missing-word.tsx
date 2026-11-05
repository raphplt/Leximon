import type { Rarity } from "@leximon/core";
import {
  ecuRules,
  ecusLabel,
  MISSING_WORD_BUSY,
  MISSING_WORD_FAILED,
  MISSING_WORD_GOT,
  MISSING_WORD_RULE,
  MISSING_WORD_TITLE,
  missingWordAction,
  missingWordBlocked,
  missingWordCollections,
  missingWordLockedLine,
  missingWordOptions,
  missingWordRefusalMessage,
  shortName,
} from "@leximon/view-model";
import { useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCatalog } from "@/cards/use-catalog";
import { play } from "@/feedback/feedback";
import { ownedCards } from "@/player/collection";
import { buyMissingWord } from "@/player/ecus";
import { useShared } from "@/player/shared";
import { progress, wallet } from "@/player/state";
import { openCard } from "@/screens/trades/card-row";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { RarityChip } from "@/ui/rarity-icon";
import { Sheet } from "@/ui/sheet";
import { toast } from "@/ui/toast";

let shown: { readonly collectionId: string | null } | null = null;
const listeners = new Set<() => void>();

function show(next: typeof shown): void {
  shown = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Spending écus on a missing word over any screen, from `collectionId` when given. */
export function openMissingWord(collectionId?: string): void {
  show({ collectionId: collectionId ?? null });
}

/** Choose a collection and a rarity, see the price, and get a word drawn among the missing ones. */
export function MissingWordHost() {
  const open = useSyncExternalStore(subscribe, () => shown);
  return (
    <Sheet open={open !== null} title={MISSING_WORD_TITLE} onClose={() => show(null)}>
      {open !== null && <MissingWordChoice collectionId={open.collectionId} />}
    </Sheet>
  );
}

function MissingWordChoice({ collectionId }: { readonly collectionId: string | null }) {
  const catalog = useCatalog();
  const owned = useShared(ownedCards);
  const currentWallet = useShared(wallet);
  const level = useShared(progress);
  const [picked, setPicked] = useState<string | null>(collectionId);
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [busy, setBusy] = useState(false);
  if (catalog === null || owned === null || currentWallet === null || level === null) {
    return <Text style={styles.text}>{MISSING_WORD_RULE}</Text>;
  }

  const now = Date.now();
  const ecus = currentWallet.ecus;
  const collections = missingWordCollections(catalog.collections, level.level, now);
  const collection = collections.find((c) => c.id === picked) ?? collections[0];
  if (collection === undefined) return <Text style={styles.text}>{MISSING_WORD_RULE}</Text>;
  const options = missingWordOptions(ecuRules(now), collection.cards, owned, ecus);
  const option =
    options.find((o) => o.rarity === rarity) ??
    options.find((o) => o.state === "open") ??
    options.find((o) => o.state === "too_poor") ??
    options[0];
  const blocked = option === undefined ? null : missingWordBlocked(option, ecus);
  const lockedLine = missingWordLockedLine(level.level, now);

  const buy = () => {
    if (option === undefined) return;
    setBusy(true);
    buyMissingWord({ collectionId: collection.id, rarity: option.rarity })
      .then((result) => {
        if (result.kind === "refused") {
          toast(missingWordRefusalMessage(result.reason));
          return;
        }
        play("newCard");
        toast(MISSING_WORD_GOT);
        show(null);
        openCard(result.cardId);
      })
      .catch(() => toast(MISSING_WORD_FAILED))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <Text style={styles.text}>{MISSING_WORD_RULE}</Text>
      <Text style={styles.balance}>Tu as {ecusLabel(ecus)}.</Text>
      <View style={styles.collections}>
        {collections.map((c) => (
          <Chip
            key={c.id}
            label={shortName(c.name)}
            on={c.id === collection.id}
            onPress={() => {
              setPicked(c.id);
              setRarity(null);
            }}
          />
        ))}
      </View>
      {lockedLine !== null && <Text style={styles.muted}>{lockedLine}</Text>}
      <View style={styles.options}>
        {options.map((o) => (
          <Pressable
            key={o.rarity}
            accessibilityRole="button"
            accessibilityState={{
              selected: o.rarity === option?.rarity,
              disabled: o.state === "complete",
            }}
            disabled={o.state === "complete"}
            onPress={() => setRarity(o.rarity)}
            style={[
              styles.option,
              o.rarity === option?.rarity && styles.optionOn,
              o.state === "complete" && styles.optionOff,
            ]}
          >
            <RarityChip rarity={o.rarity} size={30} />
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{o.label}</Text>
              <Text style={styles.muted}>{o.missingLine}</Text>
            </View>
            <Text style={styles.price}>{o.priceLabel}</Text>
          </Pressable>
        ))}
      </View>
      {blocked !== null && <Text style={styles.blocked}>{blocked}</Text>}
      {option !== undefined && (
        <Button
          label={busy ? MISSING_WORD_BUSY : missingWordAction(option)}
          disabled={busy || blocked !== null}
          onPress={buy}
        />
      )}
    </>
  );
}

/** It is read on a sheet, a leaf of paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInk,
  },
  balance: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInk },
  muted: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInkMuted,
  },
  collections: { flexDirection: "row", flexWrap: "wrap", gap: space.s3 },
  options: { gap: space.s3 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s5,
    paddingVertical: space.s3,
    paddingHorizontal: space.s5,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: ink.pageRaised,
  },
  optionOn: { borderColor: ink.gilt },
  optionOff: { opacity: 0.55 },
  optionText: { flex: 1, minWidth: 0 },
  optionLabel: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInk },
  price: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInk },
  blocked: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.rubric },
});
