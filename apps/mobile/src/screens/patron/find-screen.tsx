import type { ReserveWord, WordFindView } from "@leximon/contract";
import { toyMatters } from "@leximon/tokens";
import {
  findRefusalLine,
  findsLeftLine,
  PATRON_FIND_BACK,
  PATRON_FIND_BUSY,
  PATRON_FIND_CANCEL,
  PATRON_FIND_CONFIRM,
  PATRON_FIND_EMPTY,
  PATRON_FIND_INTRO,
  PATRON_FIND_MORE,
  PATRON_FIND_PAGE_TITLE,
  PATRON_FIND_PICK,
  PATRON_FIND_SEARCH,
  PATRON_FIND_WARNING,
  PATRON_LOAD_FAILED,
  wordFoundLine,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { MainAction } from "@/library/play-pieces";
import { fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { useInk } from "@/ui/ink";
import { GiltCorners, ORNAMENT_PADDING } from "@/ui/ornaments";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { SearchField } from "@/ui/search-field";
import { Leaf, Lettering, Lettrine, Toy, ToyBody } from "@/ui/toy";

/** Typing pauses this long before the reserve is asked again. */
const SEARCH_PAUSE_MS = 250;

interface Results {
  readonly query: string;
  readonly words: readonly ReserveWord[];
  readonly nextCursor: string | null;
}

/**
 * Finding a word, on the phone too: it buys nothing, it spends a right already paid for. The
 * patron searches the reserve by the beginning of a word, picks one and confirms.
 */
export function FindScreen() {
  const ink = useInk();
  const [left, setLeft] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [found, setFound] = useState<WordFindView | null>(null);

  const loadLeft = useCallback(() => {
    setFailed(false);
    api
      .fetchPatron()
      .then((patron) => setLeft(patron.finds.left))
      .catch(() => setFailed(true));
  }, []);
  useEffect(loadLeft, [loadLeft]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .searchReserve({ q: query })
        .then((page) => {
          if (!cancelled) setResults({ query, words: page.words, nextCursor: page.nextCursor });
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, SEARCH_PAUSE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const more = async () => {
    if (results?.nextCursor == null) return;
    try {
      const page = await api.searchReserve({ q: results.query, cursor: results.nextCursor });
      setResults({
        query: results.query,
        words: [...results.words, ...page.words],
        nextCursor: page.nextCursor,
      });
    } catch {
      setFailed(true);
    }
  };

  if (found !== null) {
    return (
      <Page title={PATRON_FIND_PAGE_TITLE}>
        <View style={styles.found}>
          <ToyBody matter="gold" shape="tile" style={styles.foundIcon}>
            <Lettrine icon="scroll" matter="blue" size={72} />
          </ToyBody>
          <Lettering size={fontSizes.display}>{found.word}</Lettering>
          <Text style={[styles.intro, { color: ink.pageInk }]}>{wordFoundLine(found.word)}</Text>
          <MainAction label={PATRON_FIND_BACK} onPress={() => router.back()} />
        </View>
      </Page>
    );
  }

  return (
    <Page title={PATRON_FIND_PAGE_TITLE}>
      {failed && left === null ? (
        <Panel paper>
          <Paragraph>{PATRON_LOAD_FAILED}</Paragraph>
          <Button label="Réessayer" secondary onPress={loadLeft} />
        </Panel>
      ) : (
        <>
          <Text style={[styles.intro, { color: ink.pageInk }]}>{PATRON_FIND_INTRO}</Text>
          {left !== null && (
            <Text style={styles.left} accessibilityLiveRegion="polite">
              {findsLeftLine(left)}
            </Text>
          )}
          <SearchField
            value={query}
            label={PATRON_FIND_SEARCH}
            maxLength={40}
            onChange={setQuery}
          />
          {results !== null && results.words.length === 0 && (
            <Text style={[styles.intro, { color: ink.pageInk }]}>{PATRON_FIND_EMPTY}</Text>
          )}
          {results?.words.map((word) => (
            <WordRow
              key={word.id}
              word={word}
              canFind={left !== null && left > 0}
              onFound={setFound}
              onLeftChanged={loadLeft}
            />
          ))}
          {results?.nextCursor != null && (
            <Button label={PATRON_FIND_MORE} secondary onPress={() => void more()} />
          )}
        </>
      )}
    </Page>
  );
}

function WordRow({
  word,
  canFind,
  onFound,
  onLeftChanged,
}: {
  readonly word: ReserveWord;
  readonly canFind: boolean;
  readonly onFound: (find: WordFindView) => void;
  readonly onLeftChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.findWord(word.id);
      if (result.kind === "found") {
        onFound(result.find);
        return;
      }
      setError(findRefusalLine(result.reason));
      onLeftChanged();
    } catch {
      setError(PATRON_LOAD_FAILED);
    }
    setBusy(false);
    setConfirming(false);
  };

  return (
    <Leaf style={styles.word}>
      <GiltCorners />
      <View style={styles.wordHead}>
        <Text style={styles.wordName}>{word.word}</Text>
        {word.partOfSpeech !== null && <Text style={styles.pos}>{word.partOfSpeech}</Text>}
      </View>
      <Text style={styles.definition}>{word.definition}</Text>
      {confirming ? (
        <>
          <Text style={styles.warning}>{PATRON_FIND_WARNING}</Text>
          <View style={styles.actions}>
            <Toy
              matter="gold"
              style={styles.action}
              disabled={busy}
              accessibilityRole="button"
              onPress={() => void find()}
            >
              <Lettering size={fontSizes.body}>
                {busy ? PATRON_FIND_BUSY : PATRON_FIND_CONFIRM}
              </Lettering>
            </Toy>
            <Button
              label={PATRON_FIND_CANCEL}
              secondary
              small
              onPress={() => setConfirming(false)}
            />
          </View>
        </>
      ) : (
        canFind && (
          <Toy
            matter="gold"
            style={styles.pick}
            accessibilityRole="button"
            onPress={() => setConfirming(true)}
          >
            <Lettering size={fontSizes.body}>{PATRON_FIND_PICK}</Lettering>
          </Toy>
        )
      )}
      {error !== null && (
        <Text style={styles.warning} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </Leaf>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.body, lineHeight: 22 },
  left: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    lineHeight: 22,
    color: toyMatters.gold.top,
  },
  word: { gap: space.s3, padding: ORNAMENT_PADDING.corners },
  wordHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: space.s4 },
  wordName: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    lineHeight: 28,
    color: paperColors.pageInk,
  },
  pos: {
    fontFamily: fonts.ui.semibold,
    fontStyle: "italic",
    fontSize: fontSizes.small,
    color: paperColors.pageInkMuted,
  },
  definition: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: paperColors.pageInk,
  },
  warning: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: toyMatters.red.bottom,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s4 },
  action: { height: 44, paddingHorizontal: space.s6 },
  pick: { alignSelf: "flex-start", height: 42, paddingHorizontal: space.s6 },
  found: { alignItems: "center", gap: space.s8, paddingTop: space.s16 },
  foundIcon: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
});
