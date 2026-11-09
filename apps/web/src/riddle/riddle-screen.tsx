"use client";

import type { RiddleResponse } from "@leximon/contract";
import { TYPED_ANSWER_MAX_LENGTH } from "@leximon/core";
import {
  RIDDLE_COPIED,
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
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { play, vibrate } from "@/booster/feedback";
import { DefinitionText } from "@/components/definition-text";
import { api } from "@/lib/api";
import { refreshIfRead } from "@/player/collection";
import { missions } from "@/player/player";
import { publishProgress } from "@/progress/use-progress";
import { Button, ButtonLink } from "@/ui/button";
import { LoadFailed } from "@/ui/load-failed";
import { Tailpiece } from "@/ui/ornaments";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./riddle-screen.module.css";

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
    const key = pendingKey.current ?? crypto.randomUUID();
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
    <main className={styles.page}>
      <h1 className={`${ui.display} ${styles.title}`}>Énigme du jour</h1>
      {loaded.state === "failed" && <LoadFailed onRetry={load} />}
      {loaded.state === "none" && <p className={styles.line}>{RIDDLE_UNAVAILABLE}</p>}
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
    </main>
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
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (typed.trim() !== "" && !sending) onSend(typed);
  };
  return (
    <div className={styles.riddle}>
      <section className={`${ui.panel} ${styles.panel}`}>
        <p className={ui.kicker}>Énigme n° {riddle.number}</p>
        {playing && <p className={styles.line}>{riddleRule(riddle.lastStep)}</p>}
        <ol className={styles.cells} aria-label={`Mot de ${riddle.letters} lettres`}>
          {riddleCells(riddle).map((letter, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a letter's place is its identity
            <li key={index} className={`${ui.display} ${styles.cell}`}>
              {letter}
            </li>
          ))}
        </ol>
        <p className={styles.nature}>{riddleNature(riddle.partOfSpeech, riddle.letters)}</p>
        {riddleClueLines(riddle).map((clue) => (
          <div key={clue.label} className={styles.clue}>
            <p className={ui.kicker}>{clue.label}</p>
            <p className={styles.clueText}>
              <DefinitionText text={clue.text} />
            </p>
          </div>
        ))}
      </section>
      {playing ? (
        <form className={`${ui.panel} ${styles.panel}`} onSubmit={submit}>
          <input
            className={`${ui.field} ${ui.display} ${styles.field}`}
            value={typed}
            maxLength={TYPED_ANSWER_MAX_LENGTH}
            aria-label="Le mot"
            placeholder="Le mot"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            // biome-ignore lint/a11y/noAutofocus: the field is the whole screen
            autoFocus
            disabled={sending}
            onChange={(event) => onType(event.target.value)}
          />
          {notice !== null && (
            <p className={styles.notice} role="status">
              {notice}
            </p>
          )}
          {error !== null && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <p className={styles.tries}>{riddleTriesLine(riddle)}</p>
          <div className={styles.actions}>
            <Button type="submit" disabled={sending || typed.trim() === ""}>
              Proposer ce mot
            </Button>
            <Button type="button" variant="ghost" disabled={sending} onClick={() => onSend(null)}>
              {riddleAskLabel(riddle)}
            </Button>
          </div>
        </form>
      ) : (
        <Result riddle={riddle} />
      )}
    </div>
  );
}

function Result({ riddle }: { readonly riddle: RiddleResponse }) {
  const toast = useToast();
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);

  const share = async () => {
    const text = riddleShareText(riddle);
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Closed without sharing, or refused: the copy below still helps.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast(RIDDLE_COPIED);
    } catch {
      toast("Copie impossible sur cet appareil.");
    }
  };

  return (
    <section className={`${ui.panel} ${styles.panel}`} aria-live="polite">
      <h2 className={`${ui.display} ${styles.headline}`}>{riddleHeadline(riddle)}</h2>
      {riddle.outcome === "found" && <Tailpiece className={styles.tailpiece} />}
      <p className={styles.result}>
        {riddleResultLine(riddle)} <span aria-hidden="true">{riddleSquares(riddle)}</span>
      </p>
      {riddleRewardLines(riddle).map((line) => (
        <p key={line} className={styles.line}>
          {line}
        </p>
      ))}
      {now !== 0 && <p className={styles.line}>{riddleNextLine(riddle, now)}</p>}
      <div className={styles.actions}>
        <Button type="button" onClick={() => void share()}>
          Partager mon résultat
        </Button>
        {riddle.answer !== null && (
          <ButtonLink href={`/carte/${riddle.answer.cardId}`} variant="secondary">
            Voir la carte
          </ButtonLink>
        )}
      </div>
      <Link href="/defis" className={styles.back}>
        Retour aux défis
      </Link>
    </section>
  );
}
