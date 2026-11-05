import type { RiddleResponse } from "@leximon/contract";
import { TYPED_ANSWER_MAX_LENGTH } from "@leximon/core";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  RIDDLE_NEW_DAY,
  RIDDLE_SEND_FAILED,
  RIDDLE_UNAVAILABLE,
  RIDDLE_WRONG,
  riddleAskLabel,
  riddleCells,
  riddleClueLines,
  riddleHeadline,
  riddleNature,
  riddleNextLine,
  riddleResultLine,
  riddleRewardLines,
  riddleRule,
  riddleShareText,
  riddleSquares,
  riddleTriesLine,
} from "@leximon/view-model";
import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { Share, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api/client";
import { play, vibrate } from "@/feedback/feedback";
import {
  cardDates,
  dailyChallenge,
  ownedCards,
  refreshIfRead,
  wordMemory,
} from "@/player/collection";
import { useNow } from "@/player/shared";
import { missions, publishProgress } from "@/player/state";
import { openCard } from "@/screens/trades/card-row";
import { alpha, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { FormError, Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "none" }
  | { readonly state: "ready"; readonly riddle: RiddleResponse };

export function RiddleScreen() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept until the server answers: a retry of the same answer must not cost another try.
  const pendingKey = useRef<string | null>(null);

  const load = useCallback(() => {
    setLoaded({ state: "loading" });
    api
      .fetchRiddle()
      .then((riddle) => setLoaded(riddle === null ? { state: "none" } : { state: "ready", riddle }))
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  useEffect(load, [load]);

  const send = async (riddle: RiddleResponse, guess: string | null) => {
    const key = pendingKey.current ?? randomUUID();
    pendingKey.current = key;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.answerRiddle({ number: riddle.number, guess }, key);
      pendingKey.current = null;
      if (result.kind === "over") {
        setNotice(RIDDLE_NEW_DAY);
        load();
        return;
      }
      publishProgress(result.progress);
      refreshIfRead(missions);
      setLoaded({ state: "ready", riddle: result.riddle });
      setTyped("");
      if (result.riddle.cardGiven) {
        refreshIfRead(ownedCards);
        refreshIfRead(cardDates);
        refreshIfRead(wordMemory);
        refreshIfRead(dailyChallenge);
      }
      if (result.riddle.outcome === "found") {
        play("answerRight");
        vibrate([12, 120, 40]);
      } else if (guess !== null) {
        play("answerWrong");
        vibrate([10, 60, 10]);
        if (result.riddle.outcome === null) setNotice(RIDDLE_WRONG);
      }
    } catch {
      setError(RIDDLE_SEND_FAILED);
    } finally {
      setSending(false);
    }
  };

  return (
    <Page title="Énigme du jour">
      {loaded.state === "loading" && <Paragraph muted>Un instant…</Paragraph>}
      {loaded.state === "failed" && (
        <>
          <Paragraph muted>L'énigme n'a pas pu être chargée. Réessaie.</Paragraph>
          <Button label="Réessayer" secondary onPress={load} />
        </>
      )}
      {loaded.state === "none" && <Paragraph muted>{RIDDLE_UNAVAILABLE}</Paragraph>}
      {loaded.state === "ready" && (
        <Riddle
          riddle={loaded.riddle}
          typed={typed}
          sending={sending}
          notice={notice}
          error={error}
          onType={setTyped}
          onSend={(guess) => void send(loaded.riddle, guess)}
        />
      )}
    </Page>
  );
}

function Riddle({
  riddle,
  typed,
  sending,
  notice,
  error,
  onType,
  onSend,
}: {
  readonly riddle: RiddleResponse;
  readonly typed: string;
  readonly sending: boolean;
  readonly notice: string | null;
  readonly error: string | null;
  readonly onType: (typed: string) => void;
  readonly onSend: (guess: string | null) => void;
}) {
  const playing = riddle.outcome === null;
  const submit = () => {
    if (typed.trim() !== "" && !sending) onSend(typed);
  };
  // Twelve boxes hold on the narrowest phones only with smaller letters.
  const letterSize = riddle.letters > 9 ? 16 : 21;
  return (
    <>
      <Panel paper style={styles.panel}>
        <Text style={styles.kicker}>ÉNIGME N° {riddle.number}</Text>
        {playing && <Text style={styles.line}>{riddleRule(riddle.lastStep)}</Text>}
        <View
          style={styles.cells}
          accessible
          accessibilityLabel={`Mot de ${riddle.letters} lettres`}
        >
          {riddleCells(riddle).map((letter, index) => {
            const tile = letter === "" ? inPaper.hollow : inPaper.found;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a letter's place is its identity
              <View key={index} style={[styles.cell, tile]}>
                <Text style={[styles.letter, { fontSize: letterSize }]}>{letter}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.nature}>{riddleNature(riddle.partOfSpeech, riddle.letters)}</Text>
        {riddleClueLines(riddle).map((clue) => (
          <View key={clue.label} style={styles.clue}>
            <Text style={styles.kicker}>{clue.label.toUpperCase()}</Text>
            <Text style={styles.clueText}>{clue.text}</Text>
          </View>
        ))}
      </Panel>
      {playing ? (
        <Panel paper style={styles.panel}>
          <TextInput
            style={[styles.field, inPaper.field]}
            value={typed}
            onChangeText={onType}
            maxLength={TYPED_ANSWER_MAX_LENGTH}
            accessibilityLabel="Le mot"
            placeholder="Le mot"
            placeholderTextColor={ink.pageInkFaint}
            selectionColor={ink.rubric}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            editable={!sending}
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          {notice !== null && (
            <Text style={styles.notice} accessibilityLiveRegion="polite">
              {notice}
            </Text>
          )}
          <FormError message={error} />
          <Text style={styles.tries}>{riddleTriesLine(riddle)}</Text>
          <Button
            label="Proposer ce mot"
            disabled={sending || typed.trim() === ""}
            onPress={submit}
          />
          <TextButton
            label={riddleAskLabel(riddle)}
            disabled={sending}
            onPress={() => onSend(null)}
          />
        </Panel>
      ) : (
        <Result riddle={riddle} />
      )}
    </>
  );
}

function Result({ riddle }: { readonly riddle: RiddleResponse }) {
  const now = useNow(60_000);
  const answer = riddle.answer;
  return (
    <Panel paper style={styles.panel}>
      <Text style={styles.headline} accessibilityLiveRegion="polite">
        {riddleHeadline(riddle)}
      </Text>
      <Text style={styles.result}>{riddleResultLine(riddle)}</Text>
      <Text style={styles.squares} importantForAccessibility="no" accessibilityElementsHidden>
        {riddleSquares(riddle)}
      </Text>
      {riddleRewardLines(riddle).map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
      <Text style={styles.line}>{riddleNextLine(riddle, now)}</Text>
      <View style={styles.actions}>
        <Button
          label="Partager mon résultat"
          onPress={() => void Share.share({ message: riddleShareText(riddle) })}
        />
        {answer !== null && (
          <Button label="Voir la carte" secondary onPress={() => openCard(answer.cardId)} />
        )}
      </View>
    </Panel>
  );
}

/** What the panels hold is read on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  panel: { gap: space.s6 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  line: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInkMuted,
  },
  cells: { flexDirection: "row", justifyContent: "center", gap: space.s2, marginTop: space.s2 },
  cell: {
    flex: 1,
    maxWidth: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ink.rule,
    borderRadius: radii.sm,
  },
  letter: { fontFamily: fonts.display, color: ink.pageInk, textTransform: "uppercase" },
  nature: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    color: ink.pageInk,
    textAlign: "center",
  },
  clue: { gap: space.s1 },
  clueText: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: ink.pageInk,
  },
  field: {
    minHeight: 60,
    paddingHorizontal: space.s9,
    borderRadius: radii.xxl,
    borderWidth: 2,
    borderColor: ink.track,
    backgroundColor: ink.well,
    color: ink.pageInk,
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    textAlign: "center",
  },
  notice: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    color: ink.danger,
    textAlign: "center",
  },
  tries: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 32,
    color: ink.pageInk,
  },
  result: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  squares: { fontSize: fontSizes.bodyLarge, lineHeight: 22 },
  actions: { gap: space.s5, marginTop: space.s2 },
});

/** Each letter has its hollow in the paper, the ones found are tiles of gold. */
const inPaper = StyleSheet.create({
  hollow: {
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 9,
    backgroundColor: alpha(toyMatters.paper.bottom, 0.55),
    boxShadow: `inset 0 3px 0 ${alpha(toyMatters.paper.edge, 0.55)}`,
  },
  found: {
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 9,
    backgroundImage: `linear-gradient(180deg, ${toyMatters.gold.top} 0%, ${toyMatters.gold.top} 47%, ${toyMatters.gold.bottom} 53%, ${toyMatters.gold.bottom} 100%)`,
    boxShadow: `inset 0 -3px 0 ${toyMatters.gold.edge}, 0 3px 0 ${toyValues.outline}`,
  },
  field: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 16,
    backgroundColor: ink.paper,
    boxShadow: `inset 0 3px 0 ${toyMatters.paper.bottom}`,
  },
});
