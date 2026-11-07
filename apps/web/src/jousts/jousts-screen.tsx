"use client";

import type {
  JoustDeckResponse,
  JoustSummary,
  JoustsResponse,
  PlayerBadge,
} from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import {
  accessText,
  CLASSEMENT,
  COMPOSE_DECK,
  DECK_NOT_SAVED,
  EDIT_DECK_SHORT,
  GUIDE_AGAIN,
  JOUST,
  JOUSTS_HELP_LABEL,
  JOUSTS_TITLE,
  joustHelp,
  joustRowState,
  joustSections,
  LAUNCH_FREE,
  LAUNCH_FRIENDLY,
  launchRefusalText,
  NO_FRIENDS_TO_DEFY,
  NO_JOUSTS,
  outcomeWord,
  PLAY_JOUST,
  playerName,
  runSize,
  SEALED_RESULT,
} from "@leximon/view-model";
import Link from "next/link";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { useNow } from "@/lib/use-now";
import { MainAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { catalogCard } from "@/trades/card-thumb";
import { Button, ButtonLink } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { HelpTip } from "@/ui/help-tip";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { ParticleStage } from "@/ui/stage";
import { Lettering, Toy, ToyBody, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import { DeckBuilder } from "./deck-builder";
import { Guide } from "./guide";
import styles from "./jousts.module.css";
import { LeagueHeader } from "./league-pieces";
import { MiniCard, rise } from "./pieces";
import { useLaunch } from "./use-launch";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly jousts: JoustsResponse; readonly deck: JoustDeckResponse };

/** The jousts' hall: the first visit, then « Jouter », the deck and the player's jousts. */
export function JoustsScreen() {
  return (
    <ParticleStage>
      <JoustsHall />
    </ParticleStage>
  );
}

function JoustsHall() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [guideOpen, setGuideOpen] = useState(false);
  const me = useShared(profile);
  const opensAt = loaded.state === "ready" ? loaded.jousts.opensAtLevel : 0;
  const { launch, busy, refusal } = useLaunch(opensAt);

  const load = useCallback(() => {
    Promise.all([api.fetchJousts(), api.fetchJoustDeck()])
      .then(([jousts, deck]) => setLoaded({ state: "ready", jousts, deck }))
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  useEffect(load, [load]);

  if (loaded.state === "failed") {
    return (
      <main className={styles.page}>
        <LoadFailed onRetry={load} />
      </main>
    );
  }
  if (loaded.state === "loading") return <main className={styles.page} />;
  const { jousts, deck } = loaded;
  const closed = accessText(jousts.access, jousts.opensAtLevel);

  if (closed !== null) {
    return (
      <main className={styles.page}>
        <section className={`${ui.leaf} ${styles.closed}`}>
          <Lettering className={styles.homeTitle}>{JOUSTS_TITLE}</Lettering>
          <p className={styles.line}>{closed}</p>
          {jousts.access === "account_required" && (
            <ButtonLink href="/compte">Créer mon compte</ButtonLink>
          )}
          {jousts.access === "pseudo_required" && (
            <ButtonLink href="/profil">Choisir mon pseudo</ButtonLink>
          )}
        </section>
      </main>
    );
  }

  const closeGuide = () => {
    setGuideOpen(false);
    // Shown once: the server keeps it done, for the web and the phone.
    api
      .markJoustGuideDone()
      .catch(() => undefined)
      .finally(load);
  };

  if (!jousts.guideDone || guideOpen) {
    return (
      <main className={styles.page}>
        <Guide
          deck={deck}
          deckSaved={jousts.deckSaved}
          jousted={jousts.jousts.length > 0}
          size={runSize(Date.now())}
          me={{ name: me?.pseudo ?? "Toi", avatar: me?.avatar ?? null, frame: me?.frame ?? null }}
          busy={busy}
          refusal={refusal}
          onDeckSaved={load}
          onLaunch={() => {
            api.markJoustGuideDone().catch(() => undefined);
            void launch({ kind: "ranked" });
          }}
          onClose={closeGuide}
        />
      </main>
    );
  }

  return (
    <Home
      jousts={jousts}
      deck={deck}
      busy={busy}
      refusal={refusal}
      onLaunch={(request) => void launch(request)}
      onGuide={() => setGuideOpen(true)}
      onDeckSaved={load}
    />
  );
}

function Home({
  jousts,
  deck,
  busy,
  refusal,
  onLaunch,
  onGuide,
  onDeckSaved,
}: {
  readonly jousts: JoustsResponse;
  readonly deck: JoustDeckResponse;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onLaunch: (request: Parameters<typeof api.launchJoust>[0]) => void;
  readonly onGuide: () => void;
  readonly onDeckSaved: () => void;
}) {
  const catalog = useCatalog();
  const now = useNow(60_000) || Date.now();
  const [deckOpen, setDeckOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const sections = joustSections(jousts.jousts);
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  const spent = deck.cardIds.reduce((total, id) => total + (costs.get(id) ?? 0), 0);
  const ready = jousts.deckSaved && jousts.deckReady;

  return (
    <main className={styles.page}>
      <div className={styles.home}>
        <section className={`${ui.leaf} ${styles.homeTop} ${desk.rising}`} style={rise(0)}>
          <header className={styles.homeHead}>
            <Lettering className={styles.homeTitle}>{JOUSTS_TITLE}</Lettering>
            <span className={styles.homeTools}>
              <Link href="/joutes/classement" className={styles.iconButton}>
                <Icon name="crown" size={18} /> {CLASSEMENT}
                {jousts.standing.rewardsWaiting > 0 && (
                  <span className={styles.dot} role="img" aria-label="Récompense à réclamer" />
                )}
              </Link>
              <HelpTip label={JOUSTS_HELP_LABEL} title="La joute">
                <ul className={styles.helpList}>
                  {joustHelp(runSize(now)).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <button type="button" className={styles.helpLink} onClick={onGuide}>
                  {GUIDE_AGAIN}
                </button>
              </HelpTip>
            </span>
          </header>
          <LeagueHeader standing={jousts.standing} today={gameDayOf(now).key} />
          {ready ? (
            <div className={styles.launch}>
              {jousts.standing.rankedLeft > 0 ? (
                <>
                  <MainAction
                    label={JOUST}
                    disabled={busy}
                    onClick={() => onLaunch({ kind: "ranked" })}
                  />
                  <Toy
                    matter="paper"
                    className={styles.friendAction}
                    disabled={busy}
                    onClick={() => onLaunch({ kind: "free" })}
                  >
                    <Icon name="joutes" size={18} /> {LAUNCH_FREE}
                  </Toy>
                </>
              ) : (
                <MainAction
                  label={LAUNCH_FREE}
                  disabled={busy}
                  onClick={() => onLaunch({ kind: "free" })}
                />
              )}
              <Toy
                matter="paper"
                className={styles.friendAction}
                disabled={busy}
                onClick={() => setFriendsOpen(true)}
              >
                <Icon name="amis" size={18} /> {LAUNCH_FRIENDLY}
              </Toy>
            </div>
          ) : (
            <div className={styles.launch}>
              <MainAction
                label={COMPOSE_DECK}
                disabled={!jousts.deckReady}
                onClick={() => setDeckOpen(true)}
              />
            </div>
          )}
          {!jousts.deckReady && (
            <p className={styles.line}>{launchRefusalText("deck_too_small", 0)}</p>
          )}
          {jousts.deckReady && !jousts.deckSaved && <p className={styles.line}>{DECK_NOT_SAVED}</p>}
          {refusal !== null && (
            <p className={styles.notice} role="alert">
              {refusal}
            </p>
          )}
        </section>

        {jousts.deckSaved && (
          <section className={`${ui.leaf} ${styles.deckLeaf} ${desk.rising}`} style={rise(1)}>
            <header className={styles.deckHead}>
              <span className={desk.leafKicker}>
                Ton deck · {spent} / {deck.budget} points
              </span>
              <Toy matter="paper" className={styles.control} onClick={() => setDeckOpen(true)}>
                {EDIT_DECK_SHORT}
              </Toy>
            </header>
            {catalog !== null && (
              <div className={styles.fan}>
                {deck.cardIds.map((cardId, index) => (
                  <MiniCard
                    key={cardId}
                    card={catalogCard(catalog, cardId)}
                    className={styles.fanCard}
                    style={{ "--i": index - (deck.cardIds.length - 1) / 2 } as CSSProperties}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <section className={`${ui.leaf} ${styles.list} ${desk.rising}`} style={rise(2)}>
          {jousts.jousts.length === 0 && <p className={styles.line}>{NO_JOUSTS}</p>}
          <JoustGroup title="À toi de jouer" jousts={sections.toPlay}>
            {(joust) => (
              <JoustRow joust={joust} now={now} pulse>
                <ToyBody matter="gold" className={styles.rowAction}>
                  {PLAY_JOUST}
                </ToyBody>
              </JoustRow>
            )}
          </JoustGroup>
          <JoustGroup title="Résultats à découvrir" jousts={sections.toDiscover}>
            {(joust) => (
              <JoustRow joust={joust} now={now} sealed>
                <span className={styles.seal} role="img" aria-label={SEALED_RESULT}>
                  <ToyIcon name="mail" size={38} />
                </span>
              </JoustRow>
            )}
          </JoustGroup>
          <JoustGroup title="En attente" jousts={sections.waiting}>
            {(joust) => (
              <JoustRow joust={joust} now={now} clock>
                {null}
              </JoustRow>
            )}
          </JoustGroup>
          <JoustGroup title="Terminées" jousts={sections.ended}>
            {(joust) => (
              <JoustRow joust={joust} now={now}>
                <span className={styles.outcome} data-won={joust.outcome === "won" || undefined}>
                  {outcomeWord(joust.outcome)}
                </span>
              </JoustRow>
            )}
          </JoustGroup>
        </section>
      </div>

      <Dialog open={deckOpen} title="Ton deck" onClose={() => setDeckOpen(false)} large>
        {deckOpen && (
          <DeckBuilder
            deck={deck}
            initial={deck.saved || jousts.jousts.length > 0 ? deck.cardIds : []}
            onSaved={() => {
              setDeckOpen(false);
              onDeckSaved();
            }}
          />
        )}
      </Dialog>
      <FriendsDialog
        open={friendsOpen}
        busy={busy}
        onClose={() => setFriendsOpen(false)}
        onPick={(code) => {
          setFriendsOpen(false);
          onLaunch({ kind: "friendly", opponentCode: code });
        }}
      />
    </main>
  );
}

function JoustGroup({
  title,
  jousts,
  children,
}: {
  readonly title: string;
  readonly jousts: readonly JoustSummary[];
  readonly children: (joust: JoustSummary) => ReactNode;
}) {
  if (jousts.length === 0) return null;
  return (
    <div className={styles.group}>
      <span className={desk.leafKicker}>{title}</span>
      <ul className={styles.rows}>
        {jousts.map((joust) => (
          <li key={joust.id}>{children(joust)}</li>
        ))}
      </ul>
    </div>
  );
}

function JoustRow({
  joust,
  now,
  pulse = false,
  sealed = false,
  clock = false,
  children,
}: {
  readonly joust: JoustSummary;
  readonly now: number;
  readonly pulse?: boolean;
  readonly sealed?: boolean;
  readonly clock?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Link
      href={`/joutes/${joust.id}`}
      className={styles.row}
      data-pulse={pulse || undefined}
      data-sealed={sealed || undefined}
    >
      <Avatar
        avatar={joust.opponent?.avatar ?? null}
        frame={joust.opponent?.frame ?? null}
        size={40}
      />
      <span className={styles.rowName}>{playerName(joust.opponent)}</span>
      <span className={styles.rowState}>
        {clock && <Icon name="clock" size={14} />} {joustRowState(joust, now)}
      </span>
      {children}
    </Link>
  );
}

function FriendsDialog({
  open,
  busy,
  onClose,
  onPick,
}: {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onPick: (code: string) => void;
}) {
  const [players, setPlayers] = useState<readonly PlayerBadge[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    setFailed(false);
    api
      .fetchJoustOpponents()
      .then((response) => setPlayers(response.players))
      .catch(() => setFailed(true));
  }, [open]);

  return (
    <Dialog open={open} title={LAUNCH_FRIENDLY} onClose={onClose}>
      <div className={styles.friends}>
        {failed && <p className={styles.notice}>Le serveur ne répond pas. Réessaie.</p>}
        {players !== null && players.length === 0 && (
          <p className={styles.line}>{NO_FRIENDS_TO_DEFY}</p>
        )}
        {players !== null && players.length > 0 && (
          <ul className={styles.rows}>
            {players.map((player) => (
              <li key={player.code} className={styles.friendRow}>
                <Avatar avatar={player.avatar} frame={player.frame} size={40} />
                <span className={styles.rowName}>{playerName(player)}</span>
                <Button small disabled={busy} onClick={() => onPick(player.code)}>
                  Défier
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
