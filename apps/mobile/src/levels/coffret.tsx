import type { BoosterWalletResponse, ClaimRefusal, LevelRewardView } from "@leximon/contract";
import {
  COFFRET_ACTION,
  COFFRET_ROAD,
  claimedToast,
  claimRefusalMessage,
  coffretHint,
  coffretReached,
  opensAt,
  reserveAfterClaim,
  rewardItem,
  waitingCoffrets,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
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
import { useNow } from "@/player/shared";
import { levelRewards, progress, publishClaimed, wallet } from "@/player/state";
import { colors, fonts } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level";
import { TextButton } from "@/ui/text-button";
import { toast } from "@/ui/toast";
import { REWARD_ICONS } from "./reward-icons";

let shown: number | null = null;
const listeners = new Set<() => void>();

function show(level: number | null): void {
  shown = level;
  for (const listener of listeners) listener();
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
  const current = progress.current();
  const claimed = levelRewards.current()?.claimed;
  const target =
    level ??
    (current === null || claimed === undefined
      ? undefined
      : waitingCoffrets(current.level, claimed)[0]);
  if (target === undefined) router.push("/niveaux");
  else show(target);
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
  | { readonly name: "failed" };

/**
 * The coffret, mounted once at the root: closed with its rays, then opened on the rewards one by
 * one. The claim happens on « Ouvrir le coffret »: the server applies it and says what it gave.
 */
export function CoffretHost() {
  const level = useSyncExternalStore(subscribe, () => shown);
  const [step, setStep] = useState<Step>({ name: "closed" });
  const [shownLevel, setShownLevel] = useState<number | null>(null);
  const now = useNow(60_000);
  const window = useWindowDimensions();

  // A new coffret starts closed.
  if (level !== shownLevel) {
    setShownLevel(level);
    setStep({ name: "closed" });
  }

  const close = () => {
    if (step.name !== "claiming") show(null);
  };

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
    if (step.name === "opened") toast(claimedToast(step.rewards));
    show(null);
    router.navigate("/niveaux");
  };

  const opens = level === null ? null : opensAt(level, now);

  return (
    <Modal
      visible={level !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fermer" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={[styles.card, { width: Math.min(380, window.width - 32) }]}>
          <ScrollView contentContainerStyle={styles.inner} bounces={false}>
            {step.name === "opened" ? (
              <>
                {level !== null && (
                  <Animated.View entering={ZoomIn.duration(320)}>
                    <LevelMedal level={level} size={96} />
                  </Animated.View>
                )}
                <Animated.Text entering={ZoomIn.duration(320)} style={styles.levelUp}>
                  Niveau {level} !
                </Animated.Text>
                <View style={styles.items}>
                  {step.rewards.map((reward, index) => {
                    const item = rewardItem(reward);
                    return (
                      <Animated.View
                        key={item.title}
                        entering={FadeInDown.delay(120 + index * 140).duration(280)}
                        style={styles.item}
                      >
                        <RewardVisual reward={reward} />
                        <View style={styles.itemText}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          {reward.kind === "title" ? (
                            <Text style={styles.plaque}>{reward.title}</Text>
                          ) : (
                            <Text style={styles.itemDetail}>{item.detail}</Text>
                          )}
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
                {step.rewards.some(
                  (r) => r.kind === "bonus_booster" || r.kind === "garni_booster",
                ) && <Text style={styles.stored}>{reserveAfterClaim(step.wallet)}</Text>}
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
                {level !== null && (
                  <Text style={styles.kicker}>{coffretReached(level).toUpperCase()}</Text>
                )}
                <Box
                  busy={step.name === "claiming"}
                  disabled={step.name === "claiming" || step.name === "refused"}
                  onOpen={() => void open()}
                />
                <Text style={styles.title} accessibilityRole="header">
                  Un coffret pour toi
                </Text>
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
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const BOX = 168;
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
              <Stop offset="0" stopColor={colors.accent} stopOpacity="0.55" />
              <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {RAYS.map((angle) => (
            <Path
              key={angle}
              d={`M${c} ${c} L${c - 9} 0 L${c + 9} 0 Z`}
              fill={colors.accent}
              opacity={0.14}
              transform={`rotate(${angle} ${c} ${c})`}
            />
          ))}
          <Circle cx={c} cy={c} r={c * 0.8} fill="url(#coffret-glow)" />
        </Svg>
      </Animated.View>
      <Animated.View style={floating}>
        <Icon name="coffret" size={88} color={colors.accent} />
      </Animated.View>
    </Pressable>
  );
}

/** What a reward looks like: the sachet itself, the engraving, the frame; an icon otherwise. */
function RewardVisual({ reward }: { readonly reward: LevelRewardView }) {
  switch (reward.kind) {
    case "bonus_booster":
    case "garni_booster": {
      const garni = reward.kind === "garni_booster";
      return (
        <View style={styles.visual}>
          <View style={[styles.mini, garni && styles.miniGarni]}>
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
          <Icon name={REWARD_ICONS[rewardItem(reward).icon]} size={26} color={colors.accent} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(12, 14, 26, 0.82)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  card: {
    maxHeight: "100%",
    borderRadius: 28,
    backgroundColor: colors.sheet,
    borderWidth: 1,
    borderColor: "rgba(255, 210, 77, 0.25)",
  },
  inner: { alignItems: "center", gap: 12, padding: 24 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.accent,
  },
  box: { width: BOX, height: BOX, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, textAlign: "center" },
  hint: { fontFamily: fonts.ui.medium, fontSize: 15, color: colors.textMuted },
  refused: {
    fontFamily: fonts.ui.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.danger,
    textAlign: "center",
  },
  actions: { alignSelf: "stretch", gap: 6, marginTop: 6 },
  levelUp: { fontFamily: fonts.display, fontSize: 36, color: colors.accent },
  items: { alignSelf: "stretch", gap: 12, marginTop: 4 },
  item: { flexDirection: "row", alignItems: "center", gap: 14 },
  itemText: { flex: 1, gap: 2 },
  itemTitle: { fontFamily: fonts.ui.extrabold, fontSize: 16, color: colors.text },
  itemDetail: { fontFamily: fonts.ui.medium, fontSize: 14, color: colors.textMuted },
  plaque: {
    alignSelf: "flex-start",
    overflow: "hidden",
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.kraft,
    color: colors.kraftTitle,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  visual: { width: 56, alignItems: "center" },
  itemIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  mini: {
    width: 40,
    height: 54,
    borderRadius: 6,
    backgroundColor: colors.kraft,
    alignItems: "center",
    justifyContent: "center",
  },
  miniGarni: { backgroundColor: colors.accent },
  miniSeal: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.seal,
    alignItems: "center",
    justifyContent: "center",
  },
  stored: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.text, marginTop: 4 },
  opens: {
    alignSelf: "stretch",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217, 180, 134, 0.4)",
    backgroundColor: "rgba(217, 180, 134, 0.16)",
    fontFamily: fonts.ui.extrabold,
    fontSize: 15,
    color: colors.text,
    textAlign: "center",
  },
});
