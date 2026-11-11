import type { CatalogCard, PlayerBadge, Trade } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import {
  FRIENDS_FOLD,
  heldLabel,
  matchesFriend,
  type Notice,
  normalizePlayerCode,
  offerProblem,
  PACK_NOUNS,
  pickHint,
  pickOrder,
  playerName,
  refusalMessage,
  selectionCount,
  toggleCard,
  tradeFriends,
  tradesLabel,
} from "@leximon/view-model";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { memo, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { api } from "@/api/client";
import { Card } from "@/cards/card";
import { ownedCards } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { friends } from "@/player/state";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { LevelMedal } from "@/ui/level";
import { TitleRule } from "@/ui/ornaments";
import { FormError } from "@/ui/page";
import { ON_PAPER_INSET, OnPaper } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";
import { TextField } from "@/ui/text-field";
import { CardRow, cardLabel, catalogCard, openCard } from "./card-row";
import { Counterpart } from "./counterpart";

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

const NOUN = PACK_NOUNS.sachet;
const COLUMNS = 3;
const GAP = 10;
/** The screen's side padding, on each side. */
const GUTTER = 16 + ON_PAPER_INSET;
const REVIEW_THUMB = 92;
const CONNECTION_ERROR = "Ça n'a pas marché. Vérifie ta connexion.";

/** The cards behind the ids, in the order to pick them. */
function pickCards(
  catalog: Catalog,
  cardIds: readonly string[],
  owned: ReadonlySet<string> | null,
): CatalogCard[] {
  return pickOrder(
    cardIds.map((id) => catalogCard(catalog, id)),
    owned,
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
  onStep,
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
  /** Each step starts at the top of the screen, not where the long list of the last one ended. */
  readonly onStep: () => void;
  /** Shows a result in the screen's floating message, which stays in view wherever the player is. */
  readonly notify: (notice: Notice | null) => void;
}) {
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
  // Shown under the field rather than floating: the keyboard may hide the top of the screen.
  const [codeError, setCodeError] = useState<string | null>(null);
  // Kept until the server answers, so that a retry never sends the same offer twice.
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (preset !== null) setGive([preset]);
  }, [preset]);

  const firstStep = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: on each new step only
  useEffect(() => {
    if (firstStep.current) firstStep.current = false;
    else onStep();
  }, [step]);

  const myFriends = useShared(friends);
  const [friendQuery, setFriendQuery] = useState("");
  const hasFriends = myFriends !== null && myFriends.friends.length > 0;
  const pickable = tradeFriends(myFriends?.friends ?? []).filter((friend) =>
    matchesFriend(friend, friendQuery),
  );

  const reset = () => {
    setStep("code");
    setCodeInput("");
    setPartner(null);
    setWant([]);
    setGive([]);
    setCodeError(null);
    notify(null);
    setPendingKey(null);
  };

  /** Ticks or unticks a card; past the most allowed, explains instead of ignoring the tap. */
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
        api.fetchTradeable(code),
        api.fetchTradeable(),
        ownedCards.read(),
        api.fetchFriendCards(code).catch(() => null),
      ]);
      if (theirs === null) {
        setCodeError(refusalMessage("player_not_found"));
        return;
      }
      const myIds = mineNow?.cardIds ?? [];
      const max = Math.max(1, theirs.maxCardsPerSide);
      setPartner({
        code,
        level: theirs.level,
        badge: theirs.player,
        cardIds: theirs.cardIds,
        maxCards: max,
      });
      setMine(myIds);
      setHeld(mineNow?.held ?? []);
      setOwned(new Set(copies.keys()));
      setFriendAlbum(friendCards === null ? null : new Set(friendCards.cardIds));
      // Coming back to the same player keeps the choice, minus what can no longer move.
      setWant((current) =>
        code === partner?.code
          ? current.filter((id) => theirs.cardIds.includes(id)).slice(0, max)
          : [],
      );
      setGive((current) => current.filter((id) => myIds.includes(id)).slice(0, max));
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
    const [theirs, mineNow] = await Promise.all([
      api.fetchTradeable(recipient),
      api.fetchTradeable(),
    ]);
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
    const key = pendingKey ?? randomUUID();
    setPendingKey(key);
    setBusy(true);
    notify(null);
    try {
      const result = await api.createTrade(
        { recipientCode: partner.code, give: [...give], want: [...want] },
        key,
      );
      // The server answered: a changed offer needs a new key.
      setPendingKey(null);
      if (result.kind === "ok") {
        onSent(result.trade);
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
      <OnPaper>
        <View style={styles.section}>
          <View style={styles.titled}>
            <Text style={styles.sectionTitle}>Proposer un échange</Text>
            <TitleRule />
          </View>
          <Text style={styles.hint}>{blocked}</Text>
          <Text style={styles.muted}>
            En attendant, ouvre des {NOUN.many}. Tu pourras échanger tes doubles.
          </Text>
          <Button label={`Ouvrir un ${NOUN.one}`} secondary onPress={() => router.navigate("/")} />
        </View>
      </OnPaper>
    );
  }

  const partnerName = partner === null ? "" : playerName(partner.badge);

  return (
    <OnPaper>
      <View style={styles.section}>
        <View style={styles.titled}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Proposer un échange
          </Text>
          <TitleRule />
        </View>
        {step !== "sent" && <Steps step={step} />}

        {step === "code" && hasFriends && (
          <View style={styles.friendPick}>
            <Text style={styles.fieldLabel}>Avec un ami</Text>
            {myFriends.friends.length > FRIENDS_FOLD && (
              <TextField
                label="Chercher un ami"
                value={friendQuery}
                onChangeText={setFriendQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
            {pickable.length === 0 && (
              <Text style={styles.muted}>Personne de ce nom parmi tes amis.</Text>
            )}
            {pickable.map((friend) => {
              const trades = tradesLabel(friend.trades);
              return (
                <Pressable
                  key={friend.player.code}
                  style={({ pressed }) => [styles.friendRow, pressed && styles.pressed]}
                  disabled={busy}
                  accessibilityRole="button"
                  onPress={() => {
                    setCodeInput(friend.player.code);
                    void findPartner(friend.player.code);
                  }}
                >
                  <Avatar avatar={friend.player.avatar} frame={null} size={36} />
                  <Text style={styles.friendName} numberOfLines={1}>
                    {playerName(friend.player)}
                  </Text>
                  {trades === null ? (
                    <LevelMedal level={friend.player.level} size={26} labelled />
                  ) : (
                    <Text style={styles.friendTrades}>{trades}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {step === "code" && (
          <View style={styles.codeForm}>
            <TextField
              label={
                hasFriends ? "Ou le code joueur de quelqu'un d'autre" : "Code joueur de la personne"
              }
              value={codeInput}
              onChangeText={(text) => {
                setCodeInput(text);
                setCodeError(null);
              }}
              placeholder="ABCD EFGH"
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              maxLength={12}
              returnKeyType="search"
              onSubmitEditing={() => void findPartner(codeInput)}
            />
            <Text style={styles.muted}>Il est en haut de son écran Échanges.</Text>
            {give.length > 0 && (
              <Text style={styles.presetGive}>
                Tu donnes : {give.map((id) => catalogCard(catalog, id).word).join(", ")}
              </Text>
            )}
            <FormError message={codeError} />
            <Button
              label={busy ? "Recherche…" : "Voir ses cartes"}
              disabled={busy || codeInput.trim() === ""}
              onPress={() => void findPartner(codeInput)}
            />
          </View>
        )}

        {step === "want" && partner !== null && (
          <>
            <Counterpart player={partner.badge} />
            <PickHeading
              title={`Ce que tu veux de ${partnerName}`}
              count={selectionCount(want, partner.maxCards)}
              hint={`${pickHint(partner.maxCards)} parmi ses doubles échangeables.${partner.maxCards === 1 ? " Vous pourrez échanger trois cartes à la fois quand vous serez tous les deux niveau 10." : ""}`}
            />
            {partner.cardIds.length === 0 ? (
              <Text style={styles.hint}>Ce joueur n'a aucun double à échanger.</Text>
            ) : (
              <CardPicker
                catalog={catalog}
                cards={pickCards(catalog, partner.cardIds, owned)}
                selection={want}
                max={partner.maxCards}
                owned={owned}
                onToggle={(id) => toggle(want, id, setWant)}
              />
            )}
            <StepActions
              back={{ label: "Autre joueur", onPress: () => setStep("code") }}
              next={{
                label: "Choisir ce que je donne",
                disabled: want.length === 0,
                onPress: () => setStep("give"),
              }}
            />
          </>
        )}

        {step === "give" && partner !== null && (
          <>
            <PickHeading
              title="Ce que tu donnes"
              count={selectionCount(give, partner.maxCards)}
              hint="Choisis parmi tes doubles. Les cartes Épiques et Légendaires peuvent être échangées 7 jours après avoir été tirées."
            />
            {mine.length === 0 && held.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.hint}>Aucun double à échanger. Ouvre des {NOUN.many}.</Text>
                <Button
                  label={`Ouvrir un ${NOUN.one}`}
                  secondary
                  onPress={() => router.navigate("/")}
                />
              </View>
            ) : (
              <CardPicker
                catalog={catalog}
                cards={pickCards(catalog, mine, friendAlbum)}
                selection={give}
                max={partner.maxCards}
                owned={friendAlbum}
                missing="Il lui manque"
                onToggle={(id) => toggle(give, id, setGive)}
                held={held.map((h) => ({
                  card: catalogCard(catalog, h.cardId),
                  label: heldLabel(h.tradeableFrom, now),
                }))}
              />
            )}
            <StepActions
              back={{ label: "Retour", onPress: () => setStep("want") }}
              next={{
                label: "Vérifier l'offre",
                disabled: give.length === 0,
                onPress: () => setStep("review"),
              }}
            />
          </>
        )}

        {step === "review" && partner !== null && (
          <>
            <Text style={styles.sideLabel}>Tu reçois de {partnerName}</Text>
            <CardRow catalog={catalog} cardIds={want} width={REVIEW_THUMB} />
            <Text style={styles.sideLabel}>Tu donnes</Text>
            <CardRow catalog={catalog} cardIds={give} width={REVIEW_THUMB} />
            <Text style={styles.muted}>
              {partnerName} a 72 heures pour répondre. Tu peux annuler d'ici là.
            </Text>
            <Button
              label={busy ? "Envoi…" : "Envoyer l'offre"}
              disabled={busy}
              onPress={() => void send()}
            />
            <TextButton label="Modifier" disabled={busy} onPress={() => setStep("give")} />
          </>
        )}

        {step === "sent" && (
          <View style={styles.empty}>
            <Text style={styles.hint}>{partnerName} a 72 heures pour répondre.</Text>
            <Button
              label="Voir mes offres envoyées"
              onPress={() => {
                reset();
                onShowSent();
              }}
            />
            <Button label="Proposer un autre échange" secondary onPress={reset} />
          </View>
        )}
      </View>
    </OnPaper>
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
    <View style={styles.steps}>
      {STEP_LABELS.map((item, index) => (
        <View
          key={item.step}
          style={styles.step}
          accessible
          accessibilityLabel={`${item.label}${index === current ? ", étape en cours" : ""}`}
        >
          <View style={[styles.stepBar, index <= current && styles.stepBarDone]} />
          <Text style={[styles.stepLabel, index <= current && styles.stepLabelDone]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
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
    <View style={styles.pickHeading}>
      <View style={styles.pickTitleRow}>
        <Text style={styles.pickTitle}>{title}</Text>
        <Text style={styles.pickCount} accessibilityLabel={`${count} cartes choisies`}>
          {count}
        </Text>
      </View>
      <Text style={styles.muted}>{hint}</Text>
    </View>
  );
}

/**
 * Cards to tick, up to `max`; « Lire » under each opens the card in full. Held cards follow,
 * greyed, with the time before they can move.
 */
function CardPicker({
  catalog,
  cards,
  selection,
  max,
  owned,
  onToggle,
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
}) {
  const window = useWindowDimensions();
  const width = Math.floor((window.width - 2 * GUTTER - (COLUMNS - 1) * GAP) / COLUMNS);
  // With one card per side, a tap swaps the card: nothing is dimmed.
  const full = max > 1 && selection.length >= max;
  return (
    <View style={styles.picker}>
      {cards.map((card) => {
        const selected = selection.includes(card.id);
        return (
          <PickTile
            key={card.id}
            card={card}
            collection={collectionName(catalog, card.collectionId)}
            width={width}
            selected={selected}
            dimmed={full && !selected}
            flag={owned !== null && !owned.has(card.id) ? missing : null}
            onToggle={onToggle}
          />
        );
      })}
      {held.map(({ card, label }) => (
        <View
          key={card.id}
          style={[styles.pick, styles.held, { width }]}
          accessible
          accessibilityLabel={`${cardLabel(card)}, ${label}`}
        >
          <Card
            card={card}
            collectionName={collectionName(catalog, card.collectionId)}
            width={width}
          />
          <Text style={styles.heldLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const PickTile = memo(function PickTile({
  card,
  collection,
  width,
  selected,
  dimmed,
  flag,
  onToggle,
}: {
  readonly card: CatalogCard;
  readonly collection: string;
  readonly width: number;
  readonly selected: boolean;
  readonly dimmed: boolean;
  /** « Il te manque »: a word the receiver lacks. */
  readonly flag: string | null;
  readonly onToggle: (cardId: string) => void;
}) {
  return (
    <View style={[styles.pick, { width }, dimmed && styles.dimmed]}>
      <Pressable
        onPress={() => onToggle(card.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${cardLabel(card)}${flag === null ? "" : `, ${flag.toLowerCase()}`}`}
      >
        <View importantForAccessibility="no-hide-descendants">
          <Card card={card} collectionName={collection} width={width} />
        </View>
        {selected && (
          <View style={styles.check}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        )}
        {flag !== null && (
          <Text style={styles.flag} numberOfLines={1}>
            {flag}
          </Text>
        )}
      </Pressable>
      <Pressable
        onPress={() => openCard(card.id)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Lire la carte ${card.word}`}
      >
        <Text style={styles.read}>Lire</Text>
      </Pressable>
    </View>
  );
});

function StepActions({
  back,
  next,
}: {
  readonly back: { readonly label: string; readonly onPress: () => void };
  readonly next: {
    readonly label: string;
    readonly disabled: boolean;
    readonly onPress: () => void;
  };
}) {
  return (
    <View style={styles.stepActions}>
      <Button label={next.label} disabled={next.disabled} onPress={next.onPress} />
      <TextButton label={back.label} onPress={back.onPress} />
    </View>
  );
}

/** The offer is prepared on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  titled: { gap: space.s3 },
  section: { gap: space.s7 },
  sectionTitle: { fontFamily: fonts.display, fontSize: fontSizes.title, color: ink.pageInk },
  hint: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: ink.pageInk,
  },
  muted: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInkMuted,
  },
  fieldLabel: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInkMuted },
  friendPick: { gap: space.s4 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    minHeight: 56,
    paddingHorizontal: space.s6,
    borderRadius: radii.xxl,
    backgroundColor: ink.pageRaised,
  },
  pressed: { opacity: 0.7 },
  friendName: {
    flex: 1,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: ink.pageInk,
  },
  friendTrades: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.success },
  codeForm: { gap: space.s5 },
  presetGive: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.rubric },
  empty: { gap: space.s6 },
  steps: { flexDirection: "row", gap: space.s3 },
  step: { flex: 1, gap: space.s3 },
  stepBar: { height: 4, borderRadius: 2, backgroundColor: ink.well },
  stepBarDone: { backgroundColor: ink.action },
  stepLabel: { fontFamily: fonts.ui.bold, fontSize: fontSizes.caption, color: ink.pageInkFaint },
  stepLabelDone: { color: ink.pageInk },
  pickHeading: { gap: space.s2 },
  pickTitleRow: { flexDirection: "row", alignItems: "baseline", gap: space.s5 },
  pickTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: fontSizes.subtitle,
    color: ink.pageInk,
  },
  pickCount: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.rubric },
  picker: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  pick: { gap: space.s2, alignItems: "center" },
  dimmed: { opacity: 0.4 },
  held: { opacity: 0.5 },
  heldLabel: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.caption,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  check: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ink.action,
    borderWidth: 2,
    borderColor: ink.page,
  },
  checkMark: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.actionInk },
  flag: {
    position: "absolute",
    bottom: 6,
    left: 4,
    right: 4,
    overflow: "hidden",
    paddingVertical: space.s1,
    borderRadius: radii.sm,
    backgroundColor: ink.sticker,
    color: ink.inkOnColor,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    textAlign: "center",
  },
  read: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    color: ink.rubric,
    textDecorationLine: "underline",
    paddingVertical: space.s1,
  },
  sideLabel: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  stepActions: { gap: space.s2, marginTop: space.s2 },
});
