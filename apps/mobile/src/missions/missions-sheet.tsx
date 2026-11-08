import type { MissionsResponse } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  changeMissionRefusalMessage,
  MISSION_CHANGE,
  MISSION_CHANGE_FAILED,
  MISSION_CHANGE_KEEP,
  MISSION_CHANGE_LABEL,
  MISSION_CHANGE_TITLE,
  MISSIONS_CLAIM_BUSY,
  MISSIONS_CLAIM_FAILED,
  MISSIONS_FAILED,
  MISSIONS_HELP_CHANGE,
  MISSIONS_HELP_OPEN,
  MISSIONS_HELP_TITLE,
  MISSIONS_TITLE,
  type MissionLine,
  type MissionPlace,
  missionChangeConfirm,
  missionLine,
  missionsClaimAction,
  missionsClaimedToast,
  missionsDoneLine,
  missionsHeadline,
  missionsHelp,
  missionsLockedLine,
} from "@leximon/view-model";
import { type Href, router } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCatalog } from "@/cards/use-catalog";
import { play } from "@/feedback/feedback";
import { changeMissionAt, claimDoneMissions } from "@/player/missions";
import { useShared, useSharedFailed } from "@/player/shared";
import { missions } from "@/player/state";
import { alpha, fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";
import { toast } from "@/ui/toast";
import { Lettering, Toy, ToyBody, ToyIcon } from "@/ui/toy";

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
  const [asking, setAsking] = useState<number | null>(null);
  const [helping, setHelping] = useState(false);
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
    setAsking(null);
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

  const asked = asking === null ? undefined : lines[asking];
  if (asking !== null && asked !== undefined) {
    // The one change of the day says what it does before it is made.
    return (
      <View style={styles.box}>
        <Text style={styles.confirmTitle}>{MISSION_CHANGE_TITLE}</Text>
        <Text style={styles.confirmText}>{missionChangeConfirm(asked)}</Text>
        <Button label={MISSION_CHANGE} onPress={() => void change(asking)} />
        <TextButton label={MISSION_CHANGE_KEEP} onPress={() => setAsking(null)} />
      </View>
    );
  }

  const done = locked === null ? missionsDoneLine(current) : null;
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <ToyBody matter={locked === null ? "gold" : "locked"} style={styles.badge}>
          <ToyIcon name="missions" size={28} locked={locked !== null} />
        </ToyBody>
        <Text style={styles.title}>{locked ?? missionsHeadline(current)}</Text>
        {locked === null && (
          <Pressable
            onPress={() => setHelping((was) => !was)}
            hitSlop={10}
            style={[styles.round, helping && styles.roundOn]}
            accessibilityRole="button"
            accessibilityLabel={MISSIONS_HELP_OPEN}
            accessibilityState={{ expanded: helping }}
          >
            <Icon name="help" size={20} color={paperColors.pageInkMuted} />
          </Pressable>
        )}
      </View>
      {helping && <Help missions={current} />}
      {lines.map((line, slot) => (
        <Row
          // biome-ignore lint/suspicious/noArrayIndexKey: one row per slot of the day
          key={slot}
          line={line}
          canChange={current.canChange && line.state === "todo"}
          changing={busy === slot}
          disabled={busy !== null}
          onChange={() => setAsking(slot)}
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
      {done !== null && <Text style={styles.text}>{done}</Text>}
    </View>
  );
}

/** Opened by the « ? »: what each mission and all of them give, and the change of the day. */
function Help({ missions: current }: { readonly missions: MissionsResponse }) {
  return (
    <View style={styles.help}>
      <Text style={styles.helpTitle}>{MISSIONS_HELP_TITLE}</Text>
      {missionsHelp(current).map((line) => (
        <View key={line.label} style={styles.helpLine}>
          <Text style={styles.helpLabel}>{line.label}</Text>
          <View style={styles.gains}>
            {line.xp > 0 && <Text style={styles.gain}>+{line.xp} XP</Text>}
            {line.ecus > 0 && (
              <View style={styles.gainBox}>
                <ToyIcon name="ecu" size={20} />
                <Text style={styles.gain}>+{line.ecus}</Text>
              </View>
            )}
            {line.boosters > 0 && (
              <View style={styles.gainBox}>
                <ToyIcon name="sachet" size={20} />
                <Text style={styles.gain}>+{line.boosters}</Text>
              </View>
            )}
          </View>
        </View>
      ))}
      <View style={styles.helpNote}>
        <Icon name="swap" size={16} color={paperColors.pageInkMuted} />
        <Text style={styles.helpNoteText}>{MISSIONS_HELP_CHANGE}</Text>
      </View>
    </View>
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
      <View style={[styles.seal, finished && styles.sealDone]}>
        {finished && <Icon name="check" size={14} color={toyValues.outline} />}
      </View>
      <View style={styles.body} accessible accessibilityLabel={line.label}>
        <Text style={[styles.what, line.state === "claimed" && styles.faded]}>{line.text}</Text>
        <View style={styles.progress}>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${Math.round(line.ratio * 100)}%` }]} />
          </View>
          <Text style={styles.figure}>{line.figure}</Text>
        </View>
      </View>
      {/* Always there, even empty: every row keeps its bar the same length. */}
      <View style={styles.actions}>
        {canChange && (
          <Pressable
            onPress={onChange}
            disabled={disabled}
            hitSlop={8}
            style={[styles.round, disabled && styles.dim]}
            accessibilityRole="button"
            accessibilityLabel={MISSION_CHANGE_LABEL}
            accessibilityState={{ disabled, busy: changing }}
          >
            <Icon name="swap" size={18} color={paperColors.pageInkMuted} />
          </Pressable>
        )}
        {!finished && place !== null && (
          <Toy
            matter="gold"
            style={styles.go}
            bodyStyle={styles.goBody}
            accessibilityRole="button"
            accessibilityLabel="Y aller"
            onPress={() => onGo(place)}
          >
            <Lettering size={13}>Y aller</Lettering>
          </Toy>
        )}
      </View>
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
  // The seal and the buttons centred on the mission; between them its words, its bar under them.
  row: { flexDirection: "row", alignItems: "center", gap: space.s4, paddingVertical: space.s2 },
  body: { flex: 1, gap: space.s2 },
  progress: { flexDirection: "row", alignItems: "center", gap: space.s3 },
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
  what: {
    flex: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    color: paperColors.pageInk,
  },
  faded: { color: paperColors.pageInkMuted },
  figure: {
    minWidth: 34,
    textAlign: "right",
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    fontVariant: ["tabular-nums"],
    color: paperColors.pageInkMuted,
  },
  bar: {
    flex: 1,
    height: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 999,
    backgroundColor: paperColors.track,
  },
  fill: { height: "100%", backgroundColor: toyMatters.gold.top },
  round: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  roundOn: { backgroundColor: alpha(toyValues.outline, 0.1) },
  dim: { opacity: 0.5 },
  // Wide enough for the change and « Y aller », on every row.
  actions: {
    width: 32 + space.s3 + 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.s3,
  },
  go: { minHeight: 32 },
  goBody: { paddingHorizontal: space.s5, paddingVertical: space.s1 },
  help: {
    gap: space.s3,
    padding: space.s5,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 14,
    backgroundColor: paperColors.track,
  },
  helpTitle: { fontFamily: fonts.display, fontSize: fontSizes.label, color: paperColors.pageInk },
  helpLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  helpLabel: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: paperColors.pageInk },
  gains: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  gainBox: { flexDirection: "row", alignItems: "center", gap: 2 },
  gain: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.label,
    fontVariant: ["tabular-nums"],
    color: paperColors.pageInk,
  },
  helpNote: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  helpNoteText: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.caption,
    color: paperColors.pageInkMuted,
  },
  confirmTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.bodyLarge,
    color: paperColors.pageInk,
  },
  confirmText: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 22,
    color: paperColors.pageInk,
  },
  text: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    color: paperColors.pageInkMuted,
  },
});
