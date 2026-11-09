import type { BoosterWalletResponse, CarnetRefusal, LevelRewardView } from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import { lettering, toyMatters } from "@leximon/tokens";
import {
  CARNET_BUSY,
  CARNET_FAILED,
  CARNET_RULE,
  CARNET_TITLE,
  type CarnetCase,
  carnetAction,
  carnetNextLine,
  carnetNotStartedLine,
  carnetRefusalMessage,
  carnetTomorrowLine,
  carnetView,
  carnetWaits,
  claimedToast,
  welcomeWaits,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { claimCarnetCase } from "@/player/missions";
import { useNow, useShared } from "@/player/shared";
import { carnet, welcomeWeek } from "@/player/state";
import { alpha, colors, fontSizes, fonts, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { toast } from "@/ui/toast";
import { Lettering, ToyBody } from "@/ui/toy";
import { CoffretFrame, RewardSlips } from "./coffret";
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

/** Shows the carnet de pointage over any screen. */
export function openCarnet(): void {
  carnet.refresh();
  show(true);
}

/** The day it opened by itself, for this launch of the app. */
let shownOn: string | null = null;

type Step =
  | { readonly name: "closed" }
  | { readonly name: "claiming" }
  | {
      readonly name: "opened";
      readonly case: number;
      readonly rewards: readonly LevelRewardView[];
      readonly wallet: BoosterWalletResponse;
    }
  | { readonly name: "refused"; readonly reason: CarnetRefusal }
  | { readonly name: "failed" };

/**
 * The carnet de pointage, mounted once at the root: the period's cases, filled by the days played,
 * the next one to take. It opens by itself once a day when a case waits, unless the welcome week
 * opens first.
 */
export function CarnetHost() {
  const visible = useSyncExternalStore(subscribe, () => shown);
  const current = useShared(carnet);
  const week = useShared(welcomeWeek);
  const [step, setStep] = useState<Step>({ name: "closed" });
  const [wasVisible, setWasVisible] = useState(visible);
  const now = useNow(60_000);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setStep({ name: "closed" });
  }

  const waits = carnetWaits(current) && !welcomeWaits(week);
  useEffect(() => {
    if (!waits) return;
    const today = gameDayOf(now).key;
    if (shownOn === today) return;
    shownOn = today;
    show(true);
  }, [waits, now]);

  if (current === null) return null;
  const view = carnetView(current);
  const next = current.next;
  const action = carnetAction(current);

  const close = () => {
    if (step.name !== "claiming") show(false);
  };

  const claim = async () => {
    if (next === null) return;
    setStep({ name: "claiming" });
    try {
      const result = await claimCarnetCase(next.period, next.case);
      if (result.kind === "refused") {
        setStep({ name: "refused", reason: result.reason });
        return;
      }
      setStep({
        name: "opened",
        case: result.case,
        rewards: result.rewards,
        wallet: result.wallet,
      });
    } catch {
      setStep({ name: "failed" });
    }
  };

  return (
    <CoffretFrame visible={visible} onClose={close}>
      {step.name === "opened" ? (
        <>
          <Text style={styles.kicker}>{CARNET_TITLE}</Text>
          <Animated.View entering={ZoomIn.duration(320)}>
            <Lettering size={fontSizes.headingLarge}>{`Case ${step.case} !`}</Lettering>
          </Animated.View>
          <RewardSlips rewards={step.rewards} wallet={step.wallet} />
          <View style={styles.actions}>
            <Button
              label="Prendre les récompenses"
              onPress={() => {
                show(false);
                toast(claimedToast(step.rewards));
              }}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.kicker}>{view.dates}</Text>
          <View accessibilityRole="header">
            <Lettering size={fontSizes.heading}>{CARNET_TITLE}</Lettering>
          </View>
          <Text style={styles.filled}>{view.filled}</Text>
          <View style={styles.cases}>
            {view.cases.map((item) => (
              <Case key={item.number} item={item} next={next?.case ?? null} />
            ))}
          </View>
          {step.name === "refused" ? (
            <Text style={styles.refused} accessibilityRole="alert">
              {carnetRefusalMessage(step.reason)}
            </Text>
          ) : step.name === "failed" ? (
            <Text style={styles.refused} accessibilityRole="alert">
              {CARNET_FAILED}
            </Text>
          ) : (
            <Text style={styles.hint}>
              {carnetNotStartedLine(current) ??
                carnetNextLine(current) ??
                carnetTomorrowLine(current) ??
                CARNET_RULE}
            </Text>
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
            ) : action === null ? (
              <Button label="Fermer" onPress={close} />
            ) : (
              <Button
                label={step.name === "claiming" ? CARNET_BUSY : action}
                disabled={step.name === "claiming" || step.name === "refused"}
                onPress={() => void claim()}
              />
            )}
          </View>
          {action !== null && <Text style={styles.rule}>{CARNET_RULE}</Text>}
        </>
      )}
    </CoffretFrame>
  );
}

/** A case: its reward, ticked once taken, glowing when it is the next to take. */
function Case({ item, next }: { readonly item: CarnetCase; readonly next: number | null }) {
  const glowing = item.status === "waiting" && item.number === next;
  const matter = item.status === "claimed" || item.status === "waiting" ? "gold" : "paper";
  return (
    <View style={[styles.case, glowing && styles.next]} accessible accessibilityLabel={item.label}>
      <ToyBody
        matter={matter}
        style={[
          styles.caseIcon,
          item.big && item.status === "later" && styles.big,
          item.status === "later" && styles.dim,
        ]}
      >
        {item.status === "claimed" ? (
          <Icon name="check" size={16} color={colors.kraftInk} />
        ) : (
          <RewardSign icon={item.icon} size={22} />
        )}
      </ToyBody>
      <Text style={[styles.caseNumber, glowing && styles.nextNumber]}>{item.number}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: lettering.kicker,
  },
  filled: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    color: colors.pageInkMuted,
  },
  // Four weeks of seven.
  cases: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: space.s2,
    rowGap: space.s3,
    maxWidth: 7 * 34 + 6 * space.s2,
    marginVertical: space.s5,
  },
  case: { width: 34, alignItems: "center", gap: 2 },
  next: { transform: [{ translateY: -3 }] },
  caseIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
  big: { backgroundColor: colors.kraft },
  dim: { opacity: 0.75 },
  caseNumber: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    color: colors.pageInkMuted,
  },
  nextNumber: { color: toyMatters.gold.top },
  hint: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    color: colors.pageInkMuted,
    textAlign: "center",
  },
  rule: {
    marginTop: space.s3,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.caption,
    color: alpha(colors.pageInkMuted, 0.9),
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
