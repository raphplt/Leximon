import type { BoosterWalletResponse, LevelRewardView, WelcomeRefusal } from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import { lettering } from "@leximon/tokens";
import {
  carnetWaits,
  claimedToast,
  WELCOME_OPEN,
  WELCOME_RULE,
  WELCOME_TAKE,
  WELCOME_TITLE,
  WELCOME_TOMORROW,
  type WelcomeCase,
  welcomeAfterClaim,
  welcomeKicker,
  welcomeRefusalMessage,
  welcomeTodayLine,
  welcomeView,
} from "@leximon/view-model";
import { router } from "expo-router";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { api } from "@/api/client";
import { useNow, useShared } from "@/player/shared";
import { carnet, publishWelcomeClaimed, wallet, welcomeWeek } from "@/player/state";
import { alpha, colors, fontSizes, fonts, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { toast } from "@/ui/toast";
import { Lettering, ToyBody } from "@/ui/toy";
import { openCarnet } from "./carnet";
import { CoffretFrame, openCoffret, RewardSlips } from "./coffret";
import { RewardSign } from "./reward-toy";

let shown = false;
const listeners = new Set<() => void>();

function show(open: boolean): void {
  shown = open;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shows the welcome week over any screen. */
export function openWelcome(): void {
  show(true);
}

/**
 * What waits in « Récompenses »: today's day of the welcome week first, then the carnet's case,
 * then the coffrets.
 */
export function openRewards(): void {
  const week = welcomeWeek.current();
  if (week !== null && welcomeView(week).today !== null) openWelcome();
  else if (carnetWaits(carnet.current())) openCarnet();
  else openCoffret();
}

/** The day it opened by itself, for this launch of the app. */
let shownOn: string | null = null;

type Step =
  | { readonly name: "closed" }
  | { readonly name: "claiming" }
  | {
      readonly name: "opened";
      readonly day: number;
      readonly rewards: readonly LevelRewardView[];
      readonly wallet: BoosterWalletResponse;
    }
  | { readonly name: "refused"; readonly reason: WelcomeRefusal }
  | { readonly name: "failed" };

/**
 * The welcome week, mounted once at the root: the seven days in a row, today's to open. It opens
 * by itself the first time a day waits in a launch of the app, once a day.
 */
export function WelcomeHost() {
  const visible = useSyncExternalStore(subscribe, () => shown);
  const current = useShared(welcomeWeek);
  const [step, setStep] = useState<Step>({ name: "closed" });
  const [wasVisible, setWasVisible] = useState(visible);
  const now = useNow(60_000);

  // Shown again, it starts closed.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setStep({ name: "closed" });
  }

  const waits = current !== null && welcomeView(current).today !== null;
  useEffect(() => {
    if (!waits) return;
    const today = gameDayOf(now).key;
    if (shownOn === today) return;
    shownOn = today;
    openWelcome();
  }, [waits, now]);

  if (current === null) return null;
  const view = welcomeView(current);
  const total = current.days.length;
  const today = view.today;

  const close = () => {
    if (step.name !== "claiming") show(false);
  };

  const claim = async () => {
    if (today === null) return;
    setStep({ name: "claiming" });
    try {
      const result = await api.claimWelcomeDay(today);
      if (result.kind === "refused") {
        setStep({ name: "refused", reason: result.reason });
        return;
      }
      wallet.publish(result.wallet);
      publishWelcomeClaimed(result.day);
      setStep({ name: "opened", day: result.day, rewards: result.rewards, wallet: result.wallet });
    } catch {
      setStep({ name: "failed" });
    }
  };

  return (
    <CoffretFrame visible={visible} onClose={close} cloth>
      {step.name === "opened" ? (
        <>
          <Text style={styles.kicker}>{WELCOME_TITLE.toUpperCase()}</Text>
          <Animated.View entering={ZoomIn.duration(320)}>
            <Lettering size={fontSizes.headingLarge}>{`Jour ${step.day} !`}</Lettering>
          </Animated.View>
          <RewardSlips rewards={step.rewards} wallet={step.wallet} />
          {welcomeAfterClaim(current, step.day) === null ? (
            <Animated.View entering={FadeIn.delay(400).duration(300)} style={styles.days}>
              {view.cases.map((day) => (
                <Day key={day.day} day={day} />
              ))}
            </Animated.View>
          ) : (
            <Text style={styles.next}>{welcomeAfterClaim(current, step.day)}</Text>
          )}
          <View style={styles.actions}>
            <Button
              label={WELCOME_TAKE}
              onPress={() => {
                show(false);
                toast(claimedToast(step.rewards));
              }}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.kicker}>
            {(today === null ? WELCOME_TITLE : welcomeKicker(today, total)).toUpperCase()}
          </Text>
          <View accessibilityRole="header">
            <Lettering size={fontSizes.heading} style={styles.centered}>
              {WELCOME_TITLE}
            </Lettering>
          </View>
          <View style={styles.days}>
            {view.cases.map((day) => (
              <Day key={day.day} day={day} />
            ))}
          </View>
          {step.name === "refused" ? (
            <Text style={styles.refused} accessibilityRole="alert">
              {welcomeRefusalMessage(step.reason)}
            </Text>
          ) : step.name === "failed" ? (
            <Text style={styles.refused} accessibilityRole="alert">
              Le serveur ne répond pas. Réessaie.
            </Text>
          ) : (
            // Once today's case is open, the row says it all: tomorrow's case is lit.
            today !== null && <Text style={styles.gift}>{welcomeTodayLine(view)}</Text>
          )}
          <View style={styles.actions}>
            {step.name === "refused" && step.reason === "reserve_full" ? (
              <Button
                label="Ouvrir un sachet"
                onPress={() => {
                  show(false);
                  router.navigate("/");
                }}
              />
            ) : today === null ? (
              <Button label="Fermer" onPress={close} />
            ) : (
              <>
                <Button
                  label={step.name === "claiming" ? "Ouverture…" : WELCOME_OPEN}
                  disabled={step.name === "claiming" || step.name === "refused"}
                  onPress={() => void claim()}
                />
                <Text style={styles.rule}>{WELCOME_RULE}</Text>
              </>
            )}
          </View>
        </>
      )}
    </CoffretFrame>
  );
}

/**
 * A day of the week: its main reward, ticked once claimed, in gold when it is today's, lit and
 * named when it is tomorrow's.
 */
function Day({ day }: { readonly day: WelcomeCase }) {
  const tomorrow = day.status === "tomorrow";
  // Seven cases and tomorrow's ring across a phone's window, without touching.
  const size = day.last ? 42 : tomorrow ? 38 : 34;
  const matter = day.status === "today" || day.status === "claimed" ? "gold" : "paper";
  const icon = (
    <ToyBody
      matter={matter}
      style={[styles.dayIcon, { width: size, height: size }, day.status === "later" && styles.dim]}
    >
      {day.status === "claimed" ? (
        <Icon name="check" size={day.last || tomorrow ? 20 : 17} color={colors.kraftInk} />
      ) : (
        <RewardSign icon={day.icon} size={Math.round(size * 0.72)} />
      )}
    </ToyBody>
  );
  return (
    <View
      style={[styles.day, day.status === "today" && styles.today]}
      accessible
      accessibilityLabel={`${day.label}, ${day.phrase}${day.status === "claimed" ? ", reçu" : ""}`}
    >
      {tomorrow ? <Beckoning>{icon}</Beckoning> : icon}
      <Text style={[styles.dayLabel, (day.status === "today" || tomorrow) && styles.todayLabel]}>
        {tomorrow ? WELCOME_TOMORROW : day.day}
      </Text>
    </View>
  );
}

/** Tomorrow's gift in its gold ring, rising a little and settling again: what coming back brings. */
function Beckoning({ children }: { readonly children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const rise = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    rise.value = withRepeat(withTiming(-3, { duration: 1200 }), -1, true);
  }, [reducedMotion, rise]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }] }));
  return <Animated.View style={[styles.ring, moving]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: lettering.kicker,
  },
  days: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: space.s2,
    marginVertical: space.s6,
  },
  day: { alignItems: "center", gap: space.s1 },
  today: { transform: [{ translateY: -4 }] },
  dayIcon: { alignItems: "center", justifyContent: "center", borderRadius: radii.lg },
  dim: { opacity: 0.8 },
  ring: {
    padding: 2,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: lettering.kicker,
    borderRadius: radii.lg + 4,
  },
  dayLabel: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.label,
    color: colors.pageInkMuted,
  },
  todayLabel: { color: lettering.kicker },
  // On two lines on a phone, like the window's other lines.
  centered: { textAlign: "center" },
  // What today's case holds, in gold: the reason to press the button.
  gift: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: lettering.kicker,
    textAlign: "center",
  },
  // Small under the button: it reassures, it does not compete with the gift.
  rule: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    color: colors.pageInkMuted,
    textAlign: "center",
  },
  next: {
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
  refused: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.danger,
    textAlign: "center",
  },
  actions: { alignSelf: "stretch", gap: space.s3, marginTop: space.s3 },
});
