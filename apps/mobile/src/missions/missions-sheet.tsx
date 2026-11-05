import type { MissionsResponse } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  changeMissionRefusalMessage,
  MISSION_CHANGE,
  MISSION_CHANGE_BUSY,
  MISSION_CHANGE_FAILED,
  MISSIONS_CLAIM_BUSY,
  MISSIONS_CLAIM_FAILED,
  MISSIONS_FAILED,
  MISSIONS_TITLE,
  type MissionLine,
  type MissionPlace,
  missionLine,
  missionsChangeLine,
  missionsClaimAction,
  missionsClaimedToast,
  missionsDoneLine,
  missionsHeadline,
  missionsLockedLine,
  missionsRule,
} from "@leximon/view-model";
import { type Href, router } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useCatalog } from "@/cards/use-catalog";
import { play } from "@/feedback/feedback";
import { changeMissionAt, claimDoneMissions } from "@/player/missions";
import { useShared, useSharedFailed } from "@/player/shared";
import { missions } from "@/player/state";
import { fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";
import { toast } from "@/ui/toast";
import { ToyBody, ToyIcon } from "@/ui/toy";

const PLACES: Readonly<Record<MissionPlace, Href>> = {
  play: "/",
  challenges: "/defis",
  riddle: "/enigme",
  trades: "/echanges",
  album: "/album",
  jousts: "/joutes",
};

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

/** Shows the missions of the day over any screen. */
export function openMissions(): void {
  show(true);
}

/** The missions of the day in a sheet, mounted once at the root. */
export function MissionsHost() {
  const open = useSyncExternalStore(subscribe, () => shown);
  return (
    <Sheet open={open} title={MISSIONS_TITLE} onClose={() => show(false)}>
      {open && <Missions onLeave={() => show(false)} />}
    </Sheet>
  );
}

/**
 * Each mission with how far it is and where it is done, the claim of what is done, and the one
 * change of the day. Read again each time it is shown: progress comes from what the player did
 * meanwhile.
 */
function Missions({ onLeave }: { readonly onLeave: () => void }) {
  const current = useShared(missions);
  const failed = useSharedFailed(missions);
  const catalog = useCatalog();
  const [busy, setBusy] = useState<"claim" | number | null>(null);
  useEffect(() => missions.refresh(), []);

  if (current === null) {
    return failed ? (
      <View style={styles.box}>
        <Text style={styles.text}>{MISSIONS_FAILED}</Text>
        <Button label="Réessayer" secondary onPress={() => missions.ensure()} />
      </View>
    ) : null;
  }

  const nameOf = (id: string) =>
    catalog?.collections.find((collection) => collection.id === id)?.name ?? null;
  const lines = current.missions.map((mission) => missionLine(mission, nameOf));
  const locked = missionsLockedLine(current);
  const claimAction = missionsClaimAction(current);

  const claim = async () => {
    setBusy("claim");
    try {
      const result = await claimDoneMissions();
      if (result.ecus > 0 || result.boosters > 0) play("coins");
      toast(missionsClaimedToast(result));
    } catch {
      toast(MISSIONS_CLAIM_FAILED);
    } finally {
      setBusy(null);
    }
  };

  const change = async (slot: number) => {
    setBusy(slot);
    try {
      const result = await changeMissionAt(slot);
      if (result.kind === "refused") {
        toast(changeMissionRefusalMessage(result.reason));
        missions.refresh();
      }
    } catch {
      toast(MISSION_CHANGE_FAILED);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <ToyBody matter={locked === null ? "gold" : "locked"} style={styles.badge}>
          <ToyIcon name="missions" size={28} locked={locked !== null} />
        </ToyBody>
        <Text style={styles.title}>{locked ?? missionsHeadline(current)}</Text>
      </View>
      {lines.map((line, slot) => (
        <Row
          // biome-ignore lint/suspicious/noArrayIndexKey: one row per slot of the day
          key={slot}
          line={line}
          canChange={current.canChange && line.state === "todo"}
          changing={busy === slot}
          disabled={busy !== null}
          onChange={() => void change(slot)}
          onGo={(place) => {
            onLeave();
            router.navigate(PLACES[place]);
          }}
        />
      ))}
      {claimAction !== null && (
        <Button
          label={busy === "claim" ? MISSIONS_CLAIM_BUSY : claimAction}
          disabled={busy !== null}
          onPress={() => void claim()}
        />
      )}
      {locked === null && <Footer missions={current} />}
    </View>
  );
}

function Footer({ missions: current }: { readonly missions: MissionsResponse }) {
  const done = missionsDoneLine(current);
  return (
    <Text style={styles.text}>
      {done ?? `${missionsRule(current)} ${missionsChangeLine(current) ?? ""}`.trim()}
    </Text>
  );
}

function Row({
  line,
  canChange,
  changing,
  disabled,
  onChange,
  onGo,
}: {
  readonly line: MissionLine;
  readonly canChange: boolean;
  readonly changing: boolean;
  readonly disabled: boolean;
  readonly onChange: () => void;
  readonly onGo: (place: MissionPlace) => void;
}) {
  const finished = line.state !== "todo";
  const { place } = line;
  return (
    <View style={styles.row}>
      <View style={styles.line} accessible accessibilityLabel={line.label}>
        <View style={[styles.seal, finished && styles.sealDone]}>
          {finished && <Icon name="check" size={14} color={toyValues.outline} />}
        </View>
        <View style={styles.body}>
          <View style={styles.words}>
            <Text style={[styles.what, line.state === "claimed" && styles.faded]}>{line.text}</Text>
            <Text style={styles.figure}>{line.figure}</Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${Math.round(line.ratio * 100)}%` }]} />
          </View>
        </View>
      </View>
      {!finished && (place !== null || canChange) && (
        <View style={styles.actions}>
          {place !== null && <TextButton label="Y aller" onPress={() => onGo(place)} />}
          {canChange && (
            <TextButton
              label={changing ? MISSION_CHANGE_BUSY : MISSION_CHANGE}
              disabled={disabled}
              onPress={onChange}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.s5 },
  head: { flexDirection: "row", alignItems: "center", gap: space.s5 },
  badge: { width: 46, height: 46 },
  title: {
    flex: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.bodyLarge,
    color: paperColors.pageInk,
  },
  row: { gap: space.s1 },
  line: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  // A round seal: empty while the mission goes on, gilt once done.
  seal: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 12,
    backgroundColor: paperColors.panel,
  },
  sealDone: { backgroundColor: toyMatters.gold.top },
  body: { flex: 1, gap: 5 },
  words: { flexDirection: "row", alignItems: "baseline", gap: space.s3 },
  what: {
    flex: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    color: paperColors.pageInk,
  },
  faded: { color: paperColors.pageInkMuted },
  figure: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    fontVariant: ["tabular-nums"],
    color: paperColors.pageInkMuted,
  },
  bar: {
    height: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 999,
    backgroundColor: paperColors.track,
  },
  fill: { height: "100%", backgroundColor: toyMatters.gold.top },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.s6, marginTop: -6 },
  text: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    color: paperColors.pageInkMuted,
  },
});
