import type { BoosterWalletResponse, ClaimRefusal, LevelRewardView } from "@leximon/contract";
import { lettering, room, toyMatters } from "@leximon/tokens";
import {
  COFFRET_ACTION,
  COFFRET_ROAD,
  claimedToast,
  claimRefusalMessage,
  coffretHint,
  coffretReached,
  coffretsLabel,
  givesSachets,
  OPENING_ALL_TITLE,
  openAllLabel,
  openAllStopped,
  openedAllTitle,
  openedLevelsLabel,
  openingAllLabel,
  opensAt,
  reserveAfterClaim,
  rewardItem,
  tallyRewards,
  waitingCoffrets,
} from "@leximon/view-model";
import { router } from "expo-router";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { api } from "@/api/client";
import { Desk } from "@/library/play-pieces";
import { useNow, useShared } from "@/player/shared";
import { levelRewards, progress, publishClaimed, wallet } from "@/player/state";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level";
import { TextButton } from "@/ui/text-button";
import { toast } from "@/ui/toast";
import { Leaf, Lettering, ToyBody, ToyIcon } from "@/ui/toy";
import { RewardSign } from "./reward-toy";

/** The coffret shown, and whether every coffret waiting opens at once from it. */
interface Shown {
  readonly level: number;
  readonly all: boolean;
}

let shown: Shown | null = null;
const listeners = new Set<() => void>();

function show(next: Shown | null): void {
  shown = next;
  for (const listener of listeners) listener();
}

function lowestWaiting(): number | undefined {
  const current = progress.current();
  const claimed = levelRewards.current()?.claimed;
  return current === null || claimed === undefined
    ? undefined
    : waitingCoffrets(current.level, claimed)[0];
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Shows a level's coffret over any screen; without a level, the lowest one waiting. With none
 * waiting, the level road says what comes next.
 */
export function openCoffret(level?: number): void {
  const target = level ?? lowestWaiting();
  if (target === undefined) router.push("/niveaux");
  else show({ level: target, all: false });
}

/** Every coffret waiting, opened one after another, their rewards shown together. */
export function openAllCoffrets(): void {
  const lowest = lowestWaiting();
  if (lowest !== undefined) show({ level: lowest, all: true });
}

type Step =
  | { readonly name: "closed" }
  | { readonly name: "claiming" }
  | {
      readonly name: "opened";
      readonly rewards: readonly LevelRewardView[];
      readonly wallet: BoosterWalletResponse;
    }
  | { readonly name: "refused"; readonly reason: ClaimRefusal }
  | { readonly name: "failed" }
  | { readonly name: "claimingAll"; readonly done: number; readonly total: number }
  | {
      readonly name: "openedAll";
      readonly levels: readonly number[];
      readonly rewards: readonly LevelRewardView[];
      readonly wallet: BoosterWalletResponse;
      /** Why the coffrets stopped before the last one, if they did. */
      readonly stop: { readonly reason: ClaimRefusal | "failed"; readonly left: number } | null;
    };

/**
 * The coffret, mounted once at the root: closed with its rays, then opened on the rewards one by
 * one. The claim happens on « Ouvrir le coffret »: the server applies it and says what it gave.
 * With several waiting, they may all open at once, one claim after another, and their rewards
 * show together.
 */
export function CoffretHost() {
  const current = useSyncExternalStore(subscribe, () => shown);
  const level = current?.level ?? null;
  const all = current?.all ?? false;
  const key = current === null ? null : `${current.level}${current.all ? "+" : ""}`;
  const [step, setStep] = useState<Step>({ name: "closed" });
  const [shownKey, setShownKey] = useState<string | null>(null);
  const started = useRef<string | null>(null);
  const now = useNow(60_000);
  const reached = useShared(progress);
  const rewards = useShared(levelRewards);
  const waiting =
    reached === null || rewards === null ? [] : waitingCoffrets(reached.level, rewards.claimed);
  const busy = step.name === "claiming" || step.name === "claimingAll";

  // A new coffret starts closed.
  if (key !== shownKey) {
    setShownKey(key);
    setStep({ name: "closed" });
  }

  const close = () => {
    if (!busy) show(null);
  };

  const openAll = async () => {
    // The list is taken once: each claim changes the coffrets waiting.
    const levels = [...waiting];
    const opened: number[] = [];
    const gained: LevelRewardView[] = [];
    let last: BoosterWalletResponse | null = null;
    let stop: ClaimRefusal | "failed" | null = null;
    setStep({ name: "claimingAll", done: 0, total: levels.length });
    // One after another, lowest first: each claim may fill the reserve that the next one needs.
    for (const next of levels) {
      try {
        const result = await api.claimLevelReward(next);
        if (result.kind === "refused") {
          stop = result.reason;
          break;
        }
        wallet.publish(result.wallet);
        publishClaimed(next);
        opened.push(next);
        gained.push(...result.rewards);
        last = result.wallet;
        setStep({ name: "claimingAll", done: opened.length, total: levels.length });
      } catch {
        stop = "failed";
        break;
      }
    }
    if (last === null) {
      setStep(
        stop === null || stop === "failed" ? { name: "failed" } : { name: "refused", reason: stop },
      );
      return;
    }
    setStep({
      name: "openedAll",
      levels: opened,
      rewards: gained,
      wallet: last,
      stop: stop === null ? null : { reason: stop, left: levels.length - opened.length },
    });
  };

  // Opening them all from a button elsewhere starts at once, a single time per showing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: started once per coffret shown
  useEffect(() => {
    if (key === null) started.current = null;
    if (!all || key === null || started.current === key) return;
    started.current = key;
    void openAll();
  }, [all, key]);

  const open = async () => {
    if (level === null) return;
    setStep({ name: "claiming" });
    try {
      const result = await api.claimLevelReward(level);
      if (result.kind === "refused") {
        setStep({ name: "refused", reason: result.reason });
        return;
      }
      wallet.publish(result.wallet);
      publishClaimed(level);
      setStep({ name: "opened", rewards: result.rewards, wallet: result.wallet });
    } catch {
      setStep({ name: "failed" });
    }
  };

  const store = (rewards: readonly LevelRewardView[]) => {
    show(null);
    toast(claimedToast(rewards));
  };

  const toRoad = () => {
    if (step.name === "opened" || step.name === "openedAll") toast(claimedToast(step.rewards));
    show(null);
    router.navigate("/niveaux");
  };

  const opens = level === null ? null : opensAt(level, now);

  return (
    <CoffretFrame visible={level !== null} onClose={close}>
      {step.name === "openedAll" ? (
        <>
          <Text style={styles.kicker}>{openedLevelsLabel(step.levels)}</Text>
          <Animated.View entering={ZoomIn.duration(320)}>
            <ToyIcon name="chest" size={80} />
          </Animated.View>
          <Animated.View entering={ZoomIn.duration(320)}>
            <Lettering size={fontSizes.headingLarge} style={styles.centered}>
              {openedAllTitle(step.levels.length)}
            </Lettering>
          </Animated.View>
          <View style={styles.items}>
            {tallyRewards(step.rewards).map((tally, index) => (
              <Animated.View
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list, shown once; two titles may be alike
                key={`${tally.reward.kind}-${index}`}
                entering={FadeInDown.delay(120 + index * 110).duration(280)}
              >
                <Slip>
                  <RewardVisual reward={tally.reward} />
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle}>{tally.item.title}</Text>
                    {tally.reward.kind === "title" ? (
                      <Text style={styles.plaque}>{tally.reward.title}</Text>
                    ) : (
                      <Text style={styles.itemDetail}>{tally.item.detail}</Text>
                    )}
                  </View>
                </Slip>
              </Animated.View>
            ))}
          </View>
          {step.rewards.some(givesSachets) && (
            <Text style={styles.stored}>{reserveAfterClaim(step.wallet)}</Text>
          )}
          {step.stop !== null && (
            <Text style={styles.refused} accessibilityRole="alert">
              {openAllStopped(
                step.stop.reason,
                step.stop.left,
                (step.levels[step.levels.length - 1] ?? 0) + 1,
              )}
            </Text>
          )}
          <View style={styles.actions}>
            <Button label={COFFRET_ACTION} onPress={() => store(step.rewards)} />
            <TextButton label={COFFRET_ROAD} onPress={toRoad} />
          </View>
        </>
      ) : step.name === "claimingAll" ? (
        <>
          <Text style={styles.kicker}>{coffretsLabel(step.total)}</Text>
          <Box busy disabled onOpen={() => undefined} />
          <View accessibilityRole="header">
            <Lettering size={fontSizes.heading} style={styles.centered}>
              {OPENING_ALL_TITLE}
            </Lettering>
          </View>
          <Text style={styles.progress} accessibilityLiveRegion="polite">
            {openingAllLabel(step.done, step.total)}
          </Text>
        </>
      ) : step.name === "opened" ? (
        <>
          {level !== null && (
            <Animated.View entering={ZoomIn.duration(320)}>
              <LevelMedal level={level} size={96} />
            </Animated.View>
          )}
          <Animated.View entering={ZoomIn.duration(320)}>
            <Lettering size={fontSizes.headingLarge}>{`Niveau ${level} !`}</Lettering>
          </Animated.View>
          <RewardSlips rewards={step.rewards} wallet={step.wallet} />
          {opens !== null && (
            <Text style={styles.opens}>
              Débloque {opens.charAt(0).toLowerCase()}
              {opens.slice(1)}
            </Text>
          )}
          <View style={styles.actions}>
            <Button label={COFFRET_ACTION} onPress={() => store(step.rewards)} />
            <TextButton label={COFFRET_ROAD} onPress={toRoad} />
          </View>
        </>
      ) : (
        <>
          {level !== null && <Text style={styles.kicker}>{coffretReached(level)}</Text>}
          <Box
            busy={step.name === "claiming"}
            disabled={step.name === "claiming" || step.name === "refused"}
            onOpen={() => void open()}
          />
          <View accessibilityRole="header">
            <Lettering size={fontSizes.heading}>Un coffret pour toi</Lettering>
          </View>
          {step.name === "refused" ? (
            <Text style={styles.refused} accessibilityRole="alert">
              {claimRefusalMessage(step.reason, level ?? 0)}
            </Text>
          ) : step.name === "failed" ? (
            <Text style={styles.refused} accessibilityRole="alert">
              Le serveur ne répond pas. Réessaie.
            </Text>
          ) : (
            <Text style={styles.hint}>{level === null ? "" : coffretHint(level, now)}</Text>
          )}
          <View style={styles.actions}>
            {step.name === "refused" && step.reason === "reserve_full" ? (
              <Button
                label="Ouvrir un sachet"
                onPress={() => {
                  show(null);
                  router.navigate("/");
                }}
              />
            ) : (
              <Button
                label={step.name === "claiming" ? "Ouverture…" : "Ouvrir le coffret"}
                disabled={step.name === "claiming" || step.name === "refused"}
                onPress={() => void open()}
              />
            )}
            {waiting.length > 1 && step.name !== "refused" && (
              <TextButton
                label={openAllLabel(waiting.length)}
                disabled={busy}
                onPress={() => void openAll()}
              />
            )}
          </View>
        </>
      )}
    </CoffretFrame>
  );
}

/**
 * A moment of reward over any screen: the desk in a dialog, its content scrolling; `cloth` for
 * the welcome week's own box.
 */
export function CoffretFrame({
  visible,
  onClose,
  cloth = false,
  children,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly cloth?: boolean;
  readonly children: ReactNode;
}) {
  const window = useWindowDimensions();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={[styles.card, { width: Math.min(380, window.width - 32) }]}>
          <Desk style={StyleSheet.absoluteFill} cloth={cloth} />
          <ScrollView style={styles.inside} contentContainerStyle={styles.inner} bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** What an opened coffret gave, one slip after the other, and where its sachets went. */
export function RewardSlips({
  rewards,
  wallet: after,
}: {
  readonly rewards: readonly LevelRewardView[];
  readonly wallet: BoosterWalletResponse;
}) {
  return (
    <>
      <View style={styles.items}>
        {rewards.map((reward, index) => {
          const item = rewardItem(reward);
          return (
            <Animated.View
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list, shown once; two rewards may be alike
              key={`${reward.kind}-${index}`}
              entering={FadeInDown.delay(120 + index * 140).duration(280)}
            >
              <Slip>
                <RewardVisual reward={reward} />
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {reward.kind === "title" ? (
                    <Text style={styles.plaque}>{reward.title}</Text>
                  ) : (
                    <Text style={styles.itemDetail}>{item.detail}</Text>
                  )}
                </View>
              </Slip>
            </Animated.View>
          );
        })}
      </View>
      {rewards.some(givesSachets) && <Text style={styles.stored}>{reserveAfterClaim(after)}</Text>}
    </>
  );
}

const BOX = 168;
/** The light behind the closed coffret: gold where gold may shine. */
const GLOW = toyMatters.gold.top;
const RAYS = Array.from({ length: 12 }, (_, k) => k * 30);

/** The closed coffret, floating in its turning rays. */
function Box({
  busy,
  disabled,
  onOpen,
}: {
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onOpen: () => void;
}) {
  const reduced = useReducedMotion();
  const float = useSharedValue(0);
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    turn.value = withRepeat(withTiming(1, { duration: 24_000, easing: Easing.linear }), -1);
    return () => {
      cancelAnimation(float);
      cancelAnimation(turn);
    };
  }, [reduced, float, turn]);

  const floating = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 * float.value }, { scale: busy ? 0.94 : 1 }],
  }));
  const turning = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));

  const c = BOX / 2;
  return (
    <Pressable
      onPress={onOpen}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Ouvrir le coffret"
      style={styles.box}
    >
      <Animated.View style={[StyleSheet.absoluteFill, turning]}>
        <Svg width={BOX} height={BOX}>
          <Defs>
            <RadialGradient id="coffret-glow">
              <Stop offset="0" stopColor={GLOW} stopOpacity="0.55" />
              <Stop offset="1" stopColor={GLOW} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {RAYS.map((angle) => (
            <Path
              key={angle}
              d={`M${c} ${c} L${c - 9} 0 L${c + 9} 0 Z`}
              fill={colors.action}
              opacity={0.24}
              transform={`rotate(${angle} ${c} ${c})`}
            />
          ))}
          <Circle cx={c} cy={c} r={c * 0.8} fill="url(#coffret-glow)" />
        </Svg>
      </Animated.View>
      <Animated.View style={floating}>
        <ToyBody matter="gold" large style={styles.chest}>
          <ToyIcon name="chest" size={84} />
        </ToyBody>
      </Animated.View>
    </Pressable>
  );
}

/** A reward of the opened coffret, on a slip of paper of its own. */
function Slip({ children }: { readonly children: ReactNode }) {
  return <Leaf style={[styles.item, styles.slip]}>{children}</Leaf>;
}

/** What a reward looks like: the sachet itself, the engraving, the frame; an icon otherwise. */
function RewardVisual({ reward }: { readonly reward: LevelRewardView }) {
  switch (reward.kind) {
    case "bonus_booster":
    case "garni_booster":
    case "precious_garni_booster": {
      const garni = reward.kind !== "bonus_booster";
      return (
        <View style={styles.visual}>
          <View
            style={[
              styles.mini,
              garni && styles.miniGarni,
              reward.kind === "precious_garni_booster" && styles.miniPrecious,
            ]}
          >
            <View style={styles.miniSeal}>
              <Icon name={garni ? "star" : "sachet"} size={12} color="#FFF4E8" />
            </View>
          </View>
        </View>
      );
    }
    case "avatar":
      return (
        <View style={styles.visual}>
          <Avatar avatar={reward.avatar ?? null} frame="simple" size={52} />
        </View>
      );
    case "frame":
      return (
        <View style={styles.visual}>
          <Avatar avatar={null} frame={reward.frame} size={52} />
        </View>
      );
    default:
      return (
        <View style={styles.itemIcon}>
          <RewardSign icon={rewardItem(reward).icon} size={36} />
        </View>
      );
  }
}

/** The rewards are read on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: alpha(colors.scrim, 0.82) },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space.s24 },
  // The coffret lies on the desk.
  card: { maxHeight: "100%", borderRadius: room.desk.radius, backgroundColor: "transparent" },
  inside: {
    margin: room.desk.frameWidth,
    borderRadius: room.desk.radius - room.desk.frameWidth,
  },
  inner: { alignItems: "center", gap: space.s6, padding: space.s12 },
  kicker: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: lettering.kicker,
  },
  box: { width: BOX, height: BOX, alignItems: "center", justifyContent: "center" },
  // The chest is a big toy of gold.
  chest: {
    width: 128,
    height: 112,
    boxShadow: `0 0 60px ${alpha(toyMatters.gold.top, 0.55)}`,
  },
  hint: { fontFamily: fonts.ui.medium, fontSize: fontSizes.body, color: colors.pageInkMuted },
  centered: { textAlign: "center" },
  progress: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: lettering.kicker },
  refused: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.danger,
    textAlign: "center",
  },
  actions: { alignSelf: "stretch", gap: space.s3, marginTop: space.s3 },
  items: { alignSelf: "stretch", gap: space.s6, marginTop: space.s2 },
  item: { flexDirection: "row", alignItems: "center", gap: space.s7 },
  slip: { paddingHorizontal: space.s6, paddingVertical: space.s5 },
  itemText: { flex: 1, gap: space.s1 },
  itemTitle: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: ink.pageInk,
  },
  itemDetail: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    color: ink.pageInkMuted,
  },
  plaque: {
    alignSelf: "flex-start",
    overflow: "hidden",
    marginTop: space.s1,
    paddingHorizontal: space.s5,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: colors.kraft,
    color: colors.kraftTitle,
    fontFamily: fonts.display,
    fontSize: fontSizes.body,
  },
  visual: { width: 56, alignItems: "center" },
  itemIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.xxl,
    backgroundColor: ink.pageRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  mini: {
    width: 40,
    height: 54,
    borderRadius: radii.xs,
    backgroundColor: colors.kraft,
    alignItems: "center",
    justifyContent: "center",
  },
  miniGarni: { backgroundColor: colors.action },
  // Précieux: the blue of the rarity it guarantees.
  miniPrecious: { backgroundColor: "#3361E8" },
  miniSeal: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.seal,
    alignItems: "center",
    justifyContent: "center",
  },
  stored: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    color: colors.pageInk,
    marginTop: space.s2,
  },
  opens: {
    alignSelf: "stretch",
    overflow: "hidden",
    paddingHorizontal: space.s7,
    paddingVertical: space.s5,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: alpha(colors.kraft, 0.4),
    backgroundColor: alpha(colors.kraft, 0.16),
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    color: colors.pageInk,
    textAlign: "center",
  },
});
