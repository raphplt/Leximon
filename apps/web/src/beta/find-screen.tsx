"use client";

import type { ReserveWord, WordFindView } from "@leximon/contract";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MainAction } from "@/library/play-pieces";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { GiltCorners } from "@/ui/ornaments";
import { ParticleStage } from "@/ui/stage";
import { Leaf, Lettering, Lettrine, Toy, ToyBody } from "@/ui/toy";
import styles from "./find-screen.module.css";

/** Typing pauses this long before the reserve is asked again. */
const SEARCH_PAUSE_MS = 250;

interface Results {
  readonly query: string;
  readonly words: readonly ReserveWord[];
  readonly nextCursor: string | null;
}

/**
 * Finding a word: the patron searches the reserve by the beginning of a word, picks one and
 * confirms. The server says whether a right is left; this screen only shows it.
 */
export function FindScreen() {
  return (
    <ParticleStage dust>
      <FindPage />
    </ParticleStage>
  );
}

function FindPage() {
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

  if (failed && left === null) {
    return (
      <main className={styles.page}>
        <LoadFailed onRetry={loadLeft} />
      </main>
    );
  }
  if (found !== null) return <Found find={found} />;

  return (
    <main className={styles.page}>
      <Link href="/mecene" className={styles.back}>
        <Icon name="back" size={18} />
        {PATRON_FIND_BACK}
      </Link>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Lettering>{PATRON_FIND_PAGE_TITLE}</Lettering>
        </h1>
        <p className={styles.intro}>{PATRON_FIND_INTRO}</p>
        {left !== null && (
          <p className={styles.left} role="status">
            {findsLeftLine(left)}
          </p>
        )}
      </header>
      <label className={styles.search}>
        <span className={styles.searchIcon}>
          <Icon name="search" size={18} />
        </span>
        <input
          className={styles.input}
          type="search"
          placeholder={PATRON_FIND_SEARCH}
          aria-label={PATRON_FIND_SEARCH}
          maxLength={40}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {results !== null && results.words.length === 0 && (
        <p className={styles.empty}>{PATRON_FIND_EMPTY}</p>
      )}
      <ul className={styles.words}>
        {results?.words.map((word) => (
          <WordRow
            key={word.id}
            word={word}
            canFind={left !== null && left > 0}
            onFound={setFound}
            onLeftChanged={loadLeft}
          />
        ))}
      </ul>
      {results?.nextCursor != null && (
        <Toy matter="paper" className={styles.more} onClick={() => void more()}>
          {PATRON_FIND_MORE}
        </Toy>
      )}
    </main>
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
    <li>
      <Leaf className={styles.word}>
        <GiltCorners />
        <div className={styles.wordHead}>
          <span className={styles.wordName}>{word.word}</span>
          {word.partOfSpeech !== null && <span className={styles.pos}>{word.partOfSpeech}</span>}
        </div>
        <p className={styles.definition}>{word.definition}</p>
        {confirming ? (
          <div className={styles.confirm}>
            <p className={styles.warning}>{PATRON_FIND_WARNING}</p>
            <div className={styles.actions}>
              <Toy matter="gold" disabled={busy} onClick={() => void find()}>
                <Lettering>{busy ? PATRON_FIND_BUSY : PATRON_FIND_CONFIRM}</Lettering>
              </Toy>
              <Toy
                matter="paper"
                className={styles.cancel}
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                {PATRON_FIND_CANCEL}
              </Toy>
            </div>
          </div>
        ) : (
          canFind && (
            <Toy matter="gold" className={styles.pick} onClick={() => setConfirming(true)}>
              <Lettering>{PATRON_FIND_PICK}</Lettering>
            </Toy>
          )
        )}
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </Leaf>
    </li>
  );
}

/** The word is theirs: a small reward, then back to the patron page. */
function Found({ find }: { readonly find: WordFindView }) {
  const router = useRouter();
  return (
    <main className={`${styles.page} ${styles.found}`}>
      <ToyBody matter="gold" shape="tile" className={styles.foundIcon}>
        <Lettrine icon="scroll" matter="blue" size={72} />
      </ToyBody>
      <h1 className={styles.title}>
        <Lettering>{find.word}</Lettering>
      </h1>
      <p className={styles.intro}>{wordFoundLine(find.word)}</p>
      <MainAction label={PATRON_FIND_BACK} onClick={() => router.push("/mecene")} />
    </main>
  );
}
