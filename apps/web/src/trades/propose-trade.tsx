"use client";

import type { CatalogCard, PlayerBadge, Trade } from "@leximon/contract";
import { rarityRank } from "@leximon/core";
import {
  heldLabel,
  type Notice,
  normalizePlayerCode,
  offerProblem,
  pickHint,
  playerName,
  refusalMessage,
  selectionCount,
  toggleCard,
  tradeFriends,
  tradesLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Catalog, collectionName } from "@/cards/catalog";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { fetchFriendCards } from "@/friends/api";
import { createTrade, fetchTradeable } from "@/lib/api";
import { useNow } from "@/lib/use-now";
import { usePackShape } from "@/lib/use-pack-shape";
import { ownedCards } from "@/player/collection";
import { friends } from "@/player/friends";
import { useShared } from "@/player/resource";
import { CardRow, cardLabel, catalogCard } from "./card-thumb";
import { Counterpart } from "./counterpart";
import styles from "./trades.module.css";

type Step = "code" | "want" | "give" | "review" | "sent";

interface Partner {
  readonly code: string;
  readonly level: number;
  /** How that player shows: avatar, pseudo. */
  readonly badge: PlayerBadge;
  /** Cards that player can give now. */
  readonly cardIds: readonly string[];
  /** Cards per side between the two players: their lower level decides. */
  readonly maxCards: number;
}

/** A card of mine that cannot move yet, and from when it can. */
interface Held {
  readonly cardId: string;
  readonly tradeableFrom: string;
}

const PICK_THUMB = 104;
const REVIEW_THUMB = 92;
const CONNECTION_ERROR = "Ça n'a pas marché. Vérifie ta connexion.";

/** Rarest first, then alphabetical; for the partner's cards, words the player lacks lead. */
function pickOrder(
  catalog: Catalog,
  cardIds: readonly string[],
  owned: ReadonlySet<string> | null,
): CatalogCard[] {
  const isNew = (card: CatalogCard) => (owned !== null && !owned.has(card.id) ? 0 : 1);
  return cardIds
    .map((id) => catalogCard(catalog, id))
    .sort(
      (a, b) =>
        isNew(a) - isNew(b) ||
        rarityRank(b.rarity) - rarityRank(a.rarity) ||
        a.word.localeCompare(b.word, "fr"),
    );
}

export function ProposeTrade({
  catalog,
  ownCode,
  blocked,
  preset,
  presetPartner,
  onSent,
  onShowSent,
  onOpen,
  notify,
}: {
  readonly catalog: Catalog;
  readonly ownCode: string;
  /** Why the player cannot trade yet: a recent account or a low level. */
  readonly blocked: string | null;
  /** A card to give, chosen on its card sheet. */
  readonly preset: string | null;
  /** A player code, from a public profile. */
  readonly presetPartner: string | null;
  readonly onSent: (trade: Trade) => void;
  readonly onShowSent: () => void;
  readonly onOpen: (cardId: string) => void;
  /** Shows a result in the screen's floating message, which stays in view wherever the player is. */
  readonly notify: (notice: Notice | null) => void;
}) {
  const { noun } = usePackShape();
  const [step, setStep] = useState<Step>("code");
  const [codeInput, setCodeInput] = useState("");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [mine, setMine] = useState<readonly string[]>([]);
  const [held, setHeld] = useState<readonly Held[]>([]);
  const now = useNow(60_000);
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());
  // A friend's whole album: the doubles they lack lead what the player gives.
  const [friendAlbum, setFriendAlbum] = useState<ReadonlySet<string> | null>(null);
  const [want, setWant] = useState<readonly string[]>([]);
  const [give, setGive] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  // Shown under the field rather than floating: the keyboard may hide the bottom of the screen.
  const [codeError, setCodeError] = useState<string | null>(null);
  // Kept until the server answers, so that a retry never sends the same offer twice.
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const onZoom = (card: CatalogCard) => onOpen(card.id);

  useEffect(() => {
    if (preset !== null) setGive([preset]);
  }, [preset]);

  const myFriends = useShared(friends);

  // A sent offer is done: coming back to the page later starts a fresh one.
  const shouldReset = useRef(false);
  useLayoutEffect(
    () => () => {
      if (!shouldReset.current) return;
      shouldReset.current = false;
      setStep("code");
      setCodeInput("");
      setPartner(null);
      setWant([]);
      setGive([]);
      setCodeError(null);
    },
    [],
  );

  const reset = () => {
    shouldReset.current = false;
    setStep("code");
    setCodeInput("");
    setPartner(null);
    setWant([]);
    setGive([]);
    setCodeError(null);
    notify(null);
    setPendingKey(null);
  };

  /** Ticks or unticks a card; past three, explains instead of ignoring the tap. */
  const toggle = (
    selection: readonly string[],
    cardId: string,
    set: (next: readonly string[]) => void,
  ) => {
    const next = toggleCard(selection, cardId, partner?.maxCards ?? 1);
    if (next === selection) {
      notify({ tone: "error", text: refusalMessage("too_many_cards") });
      return;
    }
    set(next);
    // Another offer now: it needs its own idempotency key.
    setPendingKey(null);
    notify(null);
  };

  /** Loads the partner's cards and mine at once, so that the next steps need no waiting. */
  const findPartner = async (typed: string) => {
    const code = normalizePlayerCode(typed);
    if (code === null || code === ownCode) {
      setCodeError(refusalMessage(code === null ? "invalid_code" : "self_trade"));
      return;
    }
    setBusy(true);
    setCodeError(null);
    try {
      const [theirs, mineNow, copies, friendCards] = await Promise.all([
        fetchTradeable(code),
        fetchTradeable(),
        ownedCards.read(),
        fetchFriendCards(code).catch(() => null),
      ]);
      if (theirs === null) {
        setCodeError(refusalMessage("player_not_found"));
        return;
      }
      const myIds = mineNow?.cardIds ?? [];
      setPartner({
        code,
        level: theirs.level,
        badge: theirs.player,
        cardIds: theirs.cardIds,
        maxCards: Math.max(1, theirs.maxCardsPerSide),
      });
      setMine(myIds);
      setHeld(mineNow?.held ?? []);
      setOwned(new Set(copies.keys()));
      setFriendAlbum(friendCards === null ? null : new Set(friendCards.cardIds));
      // Coming back to the same player keeps the choice, minus what can no longer move.
      setWant((current) =>
        code === partner?.code ? current.filter((id) => theirs.cardIds.includes(id)) : [],
      );
      setGive((current) =>
        current.filter((id) => myIds.includes(id)).slice(0, Math.max(1, theirs.maxCardsPerSide)),
      );
      setWant((current) => current.slice(0, Math.max(1, theirs.maxCardsPerSide)));
      setPendingKey(null);
      notify(null);
      setStep("want");
    } catch {
      setCodeError(CONNECTION_ERROR);
    } finally {
      setBusy(false);
    }
  };

  // « Proposer un échange » from a profile or a friend's sheet: their cards at once.
  const presetLoaded = useRef<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per player asked for
  useEffect(() => {
    if (presetPartner === null || presetLoaded.current === presetPartner) return;
    presetLoaded.current = presetPartner;
    setCodeInput(presetPartner);
    void findPartner(presetPartner);
  }, [presetPartner]);

  /** After a `card_not_tradeable` refusal: drop the cards that cannot move any more. */
  const refreshCards = async (recipient: string) => {
    const [theirs, mineNow] = await Promise.all([fetchTradeable(recipient), fetchTradeable()]);
    const theirIds = theirs?.cardIds ?? [];
    const myIds = mineNow?.cardIds ?? [];
    const keptWant = want.filter((id) => theirIds.includes(id));
    const keptGive = give.filter((id) => myIds.includes(id));
    setPartner((current) =>
      current === null
        ? current
        : {
            ...current,
            cardIds: theirIds,
            maxCards: Math.max(1, theirs?.maxCardsPerSide ?? current.maxCards),
          },
    );
    setMine(myIds);
    setHeld(mineNow?.held ?? []);
    setWant(keptWant);
    setGive(keptGive);
    if (keptWant.length === 0) setStep("want");
    else if (keptGive.length === 0) setStep("give");
  };

  const send = async () => {
    if (partner === null) return;
    const problem = offerProblem({
      recipientCode: partner.code,
      ownCode,
      give,
      want,
      max: partner.maxCards,
    });
    if (problem !== null) {
      notify({ tone: "error", text: refusalMessage(problem) });
      return;
    }
    const key = pendingKey ?? crypto.randomUUID();
    setPendingKey(key);
    setBusy(true);
    notify(null);
    try {
      const result = await createTrade(
        { recipientCode: partner.code, give: [...give], want: [...want] },
        key,
      );
      // The server answered: a changed offer needs a new key.
      setPendingKey(null);
      if (result.kind === "ok") {
        onSent(result.trade);
        shouldReset.current = true;
        notify({ tone: "success", text: `Offre envoyée à ${playerName(partner.badge)}.` });
        setStep("sent");
        return;
      }
      if (result.reason === "player_not_found" || result.reason === "self_trade") {
        setCodeError(refusalMessage(result.reason));
        setStep("code");
        return;
      }
      notify({ tone: "error", text: refusalMessage(result.reason) });
      if (result.reason === "card_not_tradeable") {
        await refreshCards(partner.code).catch(() => undefined);
      }
    } catch {
      notify({ tone: "error", text: CONNECTION_ERROR });
    } finally {
      setBusy(false);
    }
  };

  if (blocked !== null) {
    return (
      <section className={styles.panel} aria-labelledby="propose-title">
        <h2 id="propose-title" className={styles.sectionTitle}>
          Proposer un échange
        </h2>
        <p className={styles.hint}>{blocked}</p>
        <p className={styles.muted}>
          En attendant, ouvre des {noun.many}. Seuls les doubles s'échangent.
        </p>
        <Link href="/jouer" className={styles.secondary}>
          Ouvrir un {noun.one}
        </Link>
      </section>
    );
  }

  const partnerCode = partner === null ? "" : playerName(partner.badge);

  return (
    <section className={styles.panel} aria-labelledby="propose-title">
      <h2 id="propose-title" className={styles.sectionTitle}>
        Proposer un échange
      </h2>
      {step !== "sent" && <Steps step={step} />}

      {step === "code" && myFriends !== null && myFriends.friends.length > 0 && (
        <div className={styles.friendPick}>
          <p className={styles.fieldLabel}>Avec un ami</p>
          <ul className={styles.friendList}>
            {tradeFriends(myFriends.friends).map((friend) => {
              const trades = tradesLabel(friend.trades);
              return (
                <li key={friend.player.code}>
                  <button
                    type="button"
                    className={styles.friendRow}
                    disabled={busy}
                    onClick={() => {
                      setCodeInput(friend.player.code);
                      void findPartner(friend.player.code);
                    }}
                  >
                    <Avatar avatar={friend.player.avatar} frame={null} size={36} />
                    <span className={styles.friendName}>{playerName(friend.player)}</span>
                    <span className={trades === null ? styles.muted : styles.friendTrades}>
                      {trades ?? `niv. ${friend.player.level}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {step === "code" && (
        <form
          className={styles.codeForm}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void findPartner(codeInput);
          }}
        >
          <label htmlFor="partner-code" className={styles.fieldLabel}>
            {myFriends !== null && myFriends.friends.length > 0
              ? "Ou le code joueur de quelqu'un d'autre"
              : "Code joueur de la personne"}
          </label>
          <input
            id="partner-code"
            className={styles.input}
            value={codeInput}
            onChange={(event) => {
              setCodeInput(event.target.value);
              setCodeError(null);
            }}
            placeholder="ABCD EFGH"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
            aria-describedby="partner-code-hint partner-code-error"
            aria-invalid={codeError !== null}
          />
          <p id="partner-code-hint" className={styles.muted}>
            Il est en haut de son écran Échanges.
          </p>
          {give.length > 0 && (
            <p className={styles.partnerFound}>
              Tu donnes : {give.map((id) => catalogCard(catalog, id).word).join(", ")}
            </p>
          )}
          <p
            id="partner-code-error"
            className={styles.noticeError}
            role="status"
            aria-live="polite"
          >
            {codeError}
          </p>
          <button
            type="submit"
            className={styles.primary}
            disabled={busy || codeInput.trim() === ""}
          >
            {busy ? "Recherche…" : "Voir ses cartes"}
          </button>
        </form>
      )}

      {step === "want" && partner !== null && (
        <>
          <div className={styles.partnerFound}>
            <Counterpart player={partner.badge} />
          </div>
          <PickHeading
            title={`Ce que tu veux de ${partnerCode}`}
            count={selectionCount(want, partner.maxCards)}
            hint={`${pickHint(partner.maxCards)} parmi ses doubles échangeables.${partner.maxCards === 1 ? " Trois cartes quand vous serez tous les deux niveau 10." : ""}`}
          />
          {partner.cardIds.length === 0 ? (
            <p className={styles.hint}>Ce joueur n'a aucun double à échanger.</p>
          ) : (
            <CardPicker
              catalog={catalog}
              cards={pickOrder(catalog, partner.cardIds, owned)}
              selection={want}
              max={partner.maxCards}
              owned={owned}
              onToggle={(id) => toggle(want, id, setWant)}
              onZoom={onZoom}
            />
          )}
          <StepActions
            back={{ label: "Autre joueur", onClick: () => setStep("code") }}
            next={{
              label: "Choisir ce que je donne",
              disabled: want.length === 0,
              onClick: () => setStep("give"),
            }}
          />
        </>
      )}

      {step === "give" && partner !== null && (
        <>
          <PickHeading
            title="Ce que tu donnes"
            count={selectionCount(give, partner.maxCards)}
            hint="Seulement tes doubles. Une Épique ou une Légendaire attend 7 jours avant de partir."
          />
          {mine.length === 0 && held.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.hint}>Aucun double à échanger. Ouvre des {noun.many}.</p>
              <Link href="/jouer" className={styles.secondary}>
                Ouvrir un {noun.one}
              </Link>
            </div>
          ) : (
            <CardPicker
              catalog={catalog}
              cards={pickOrder(catalog, mine, friendAlbum)}
              selection={give}
              max={partner.maxCards}
              owned={friendAlbum}
              missing="Il lui manque"
              onToggle={(id) => toggle(give, id, setGive)}
              onZoom={onZoom}
              held={held.map((h) => ({
                card: catalogCard(catalog, h.cardId),
                label: now === 0 ? "" : heldLabel(h.tradeableFrom, now),
              }))}
            />
          )}
          <StepActions
            back={{ label: "Retour", onClick: () => setStep("want") }}
            next={{
              label: "Vérifier l'offre",
              disabled: give.length === 0,
              onClick: () => setStep("review"),
            }}
          />
        </>
      )}

      {step === "review" && partner !== null && (
        <>
          <div className={styles.review}>
            <p className={styles.sideLabel}>Tu reçois de {partnerCode}</p>
            <CardRow catalog={catalog} cardIds={want} width={REVIEW_THUMB} onZoom={onZoom} />
            <p className={styles.sideLabel}>Tu donnes</p>
            <CardRow catalog={catalog} cardIds={give} width={REVIEW_THUMB} onZoom={onZoom} />
            <p className={styles.muted}>
              {partnerCode} a 72 heures pour répondre. Tu peux annuler d'ici là.
            </p>
          </div>
          <div className={styles.stepActions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => setStep("give")}
            >
              Modifier
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => void send()}
            >
              {busy ? "Envoi…" : "Envoyer l'offre"}
            </button>
          </div>
        </>
      )}

      {step === "sent" && (
        <div className={styles.empty}>
          <p className={styles.hint}>{partnerCode} a 72 heures pour répondre.</p>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              reset();
              onShowSent();
            }}
          >
            Voir mes offres envoyées
          </button>
          <button type="button" className={styles.secondary} onClick={reset}>
            Proposer un autre échange
          </button>
        </div>
      )}
    </section>
  );
}

const STEP_LABELS: readonly { readonly step: Step; readonly label: string }[] = [
  { step: "code", label: "Joueur" },
  { step: "want", label: "Tu veux" },
  { step: "give", label: "Tu donnes" },
  { step: "review", label: "Envoi" },
];

function Steps({ step }: { readonly step: Step }) {
  const current = STEP_LABELS.findIndex((item) => item.step === step);
  return (
    <ol className={styles.steps}>
      {STEP_LABELS.map((item, index) => (
        <li
          key={item.step}
          className={index <= current ? styles.stepDone : styles.step}
          aria-current={index === current ? "step" : undefined}
        >
          {item.label}
        </li>
      ))}
    </ol>
  );
}

function PickHeading({
  title,
  count,
  hint,
}: {
  readonly title: string;
  readonly count: string;
  readonly hint: string;
}) {
  return (
    <div className={styles.pickHeading}>
      <div className={styles.pickTitleRow}>
        <h3 className={styles.pickTitle}>{title}</h3>
        <span className={styles.pickCount}>
          {count}
          <span className={styles.visuallyHidden}> cartes choisies</span>
        </span>
      </div>
      <p className={styles.muted}>{hint}</p>
    </div>
  );
}

/**
 * Cards to tick, up to `max`; a separate button opens each card in full. Held cards follow,
 * greyed, with the time before they can move.
 */
function CardPicker({
  catalog,
  cards,
  selection,
  max,
  owned,
  onToggle,
  onZoom,
  held = [],
  missing = "Il te manque",
}: {
  readonly catalog: Catalog;
  readonly cards: readonly CatalogCard[];
  readonly selection: readonly string[];
  readonly max: number;
  readonly held?: readonly { readonly card: CatalogCard; readonly label: string }[];
  /** The cards of whoever receives, to flag the words they lack; `null` to flag nothing. */
  readonly owned: ReadonlySet<string> | null;
  /** The flag on a word the receiver lacks. */
  readonly missing?: string;
  readonly onToggle: (cardId: string) => void;
  readonly onZoom: (card: CatalogCard) => void;
}) {
  // With one card per side, a tap swaps the card: nothing is dimmed.
  const full = max > 1 && selection.length >= max;
  return (
    <ul className={styles.picker}>
      {cards.map((card) => {
        const selected = selection.includes(card.id);
        const isNew = owned !== null && !owned.has(card.id);
        return (
          <li key={card.id} className={full && !selected ? styles.pickDimmed : styles.pick}>
            <button
              type="button"
              className={styles.pickButton}
              aria-pressed={selected}
              aria-label={`${cardLabel(card)}${isNew ? `, ${missing.toLowerCase()}` : ""}`}
              onClick={() => onToggle(card.id)}
            >
              <Card
                card={card}
                collectionName={collectionName(catalog, card.collectionId)}
                width={PICK_THUMB}
              />
              {selected && (
                <span className={styles.check} aria-hidden="true">
                  ✓
                </span>
              )}
              {isNew && (
                <span className={styles.newBadge} aria-hidden="true">
                  {missing}
                </span>
              )}
            </button>
            <button
              type="button"
              className={styles.zoomLink}
              onClick={() => onZoom(card)}
              aria-label={`Lire la carte ${card.word}`}
            >
              Lire
            </button>
          </li>
        );
      })}
      {held.map(({ card, label }) => (
        <li key={card.id} className={styles.pickHeld}>
          <span
            className={styles.pickButton}
            role="img"
            aria-label={`${cardLabel(card)}, ${label}`}
          >
            <Card
              card={card}
              collectionName={collectionName(catalog, card.collectionId)}
              width={PICK_THUMB}
            />
          </span>
          <span className={styles.heldLabel}>{label}</span>
        </li>
      ))}
    </ul>
  );
}

function StepActions({
  back,
  next,
}: {
  readonly back: { readonly label: string; readonly onClick: () => void };
  readonly next: {
    readonly label: string;
    readonly disabled: boolean;
    readonly onClick: () => void;
  };
}) {
  return (
    <div className={styles.stepActions}>
      <button type="button" className={styles.secondary} onClick={back.onClick}>
        {back.label}
      </button>
      <button
        type="button"
        className={styles.primary}
        disabled={next.disabled}
        onClick={next.onClick}
      >
        {next.label}
      </button>
    </div>
  );
}
