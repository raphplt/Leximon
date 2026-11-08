"use client";

import type { MissionsResponse } from "@leximon/contract";
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
  missionChangeConfirm,
  missionLine,
  missionsClaimAction,
  missionsClaimedToast,
  missionsDoneLine,
  missionsHeadline,
  missionsHelp,
  missionsLockedLine,
} from "@leximon/view-model";
import { type CSSProperties, useEffect, useState } from "react";
import { play } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import { changeMissionAt, claimDoneMissions } from "@/player/missions";
import { missions } from "@/player/player";
import { useShared, useSharedFailed } from "@/player/resource";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { HelpTip } from "@/ui/help-tip";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import { Lettrine, ToyBody, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./missions-card.module.css";

/**
 * The missions of the day: each with how far it is and where it is done, the claim of what is
 * done, and the one change of the day. Read again each time it is shown: progress comes from
 * what the player did meanwhile.
 */
export function MissionsCard({
  className,
  style,
}: {
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
}) {
  const current = useShared(missions);
  const failed = useSharedFailed(missions);
  const catalog = useCatalog();
  const toast = useToast();
  const [busy, setBusy] = useState<"claim" | number | null>(null);
  const [asking, setAsking] = useState<number | null>(null);
  useEffect(() => missions.refresh(), []);

  if (current === null) {
    return failed ? (
      <section className={`${ui.leaf} ${styles.card} ${className ?? ""}`} style={style}>
        <p className={styles.text}>{MISSIONS_FAILED}</p>
        <Button variant="secondary" small onClick={() => missions.ensure()}>
          Réessayer
        </Button>
      </section>
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

  return (
    <section
      className={`${ui.leaf} ${styles.card} ${className ?? ""}`}
      style={style}
      aria-label={MISSIONS_TITLE}
    >
      <span className={styles.head}>
        <ToyBody matter={locked === null ? "gold" : "locked"} shape="tile" className={styles.badge}>
          <Lettrine icon="missions" matter="gold" size={24} locked={locked !== null} />
        </ToyBody>
        <span className={styles.titles}>
          <span className={styles.kicker}>{MISSIONS_TITLE}</span>
          <span className={styles.title}>{locked ?? missionsHeadline(current)}</span>
        </span>
        {locked === null && (
          <span className={styles.help}>
            <Help missions={current} />
          </span>
        )}
      </span>
      {lines.length > 0 && (
        <ol className={styles.list}>
          {lines.map((line, slot) => (
            <Row
              // biome-ignore lint/suspicious/noArrayIndexKey: one row per slot of the day
              key={slot}
              line={line}
              canChange={current.canChange && line.state === "todo"}
              changing={busy === slot}
              disabled={busy !== null}
              onChange={() => setAsking(slot)}
            />
          ))}
        </ol>
      )}
      {claimAction !== null && (
        <Button glow wide onClick={() => void claim()} disabled={busy !== null}>
          <Icon name="coffret" size={20} />
          {busy === "claim" ? MISSIONS_CLAIM_BUSY : claimAction}
        </Button>
      )}
      {locked === null && missionsDoneLine(current) !== null && (
        <p className={styles.text}>{missionsDoneLine(current)}</p>
      )}
      <Dialog
        open={asking !== null}
        title={MISSION_CHANGE_TITLE}
        onClose={() => setAsking(null)}
        variant="center"
      >
        <div className={styles.confirm}>
          <p className={styles.confirmText}>
            {asking !== null && lines[asking] !== undefined && missionChangeConfirm(lines[asking])}
          </p>
          <div className={styles.confirmButtons}>
            <Button variant="secondary" onClick={() => setAsking(null)}>
              {MISSION_CHANGE_KEEP}
            </Button>
            <Button onClick={() => asking !== null && void change(asking)}>
              <Icon name="swap" size={18} />
              {MISSION_CHANGE}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}

/** The « ? » of the card: what each mission and all of them give, and the change of the day. */
function Help({ missions: current }: { readonly missions: MissionsResponse }) {
  return (
    <HelpTip label={MISSIONS_HELP_OPEN} title={MISSIONS_HELP_TITLE}>
      <span className={styles.helpBody}>
        {missionsHelp(current).map((line) => (
          <span key={line.label} className={styles.helpLine}>
            <span>{line.label}</span>
            <span className={styles.gains}>
              {line.xp > 0 && <span className={styles.gain}>+{line.xp} XP</span>}
              {line.ecus > 0 && (
                <span className={styles.gain}>
                  <ToyIcon name="ecu" size={20} />+{line.ecus}
                </span>
              )}
              {line.boosters > 0 && (
                <span className={styles.gain}>
                  <ToyIcon name="sachet" size={20} />+{line.boosters}
                </span>
              )}
            </span>
          </span>
        ))}
        <span className={styles.helpNote}>
          <Icon name="swap" size={16} />
          {MISSIONS_HELP_CHANGE}
        </span>
      </span>
    </HelpTip>
  );
}

function Row({
  line,
  canChange,
  changing,
  disabled,
  onChange,
}: {
  readonly line: MissionLine;
  readonly canChange: boolean;
  readonly changing: boolean;
  readonly disabled: boolean;
  readonly onChange: () => void;
}) {
  const finished = line.state !== "todo";
  return (
    <li className={`${styles.row} ${styles[line.state]}`} aria-label={line.label}>
      <span className={styles.seal} aria-hidden="true">
        {finished && <Icon name="check" size={14} />}
      </span>
      <span className={styles.what} aria-hidden="true">
        {line.text}
      </span>
      <span className={styles.progress} aria-hidden="true">
        <span className={styles.bar}>
          <span className={styles.fill} style={{ width: `${Math.round(line.ratio * 100)}%` }} />
        </span>
        <span className={styles.figure}>{line.figure}</span>
      </span>
      {/* Always there, even empty: the buttons' column keeps every bar the same length. */}
      <span className={styles.actions}>
        {canChange && (
          <button
            type="button"
            className={styles.change}
            onClick={onChange}
            disabled={disabled}
            aria-label={MISSION_CHANGE_LABEL}
            title={MISSION_CHANGE_LABEL}
          >
            {changing ? (
              <span className={styles.spinning}>
                <Icon name="swap" size={16} />
              </span>
            ) : (
              <Icon name="swap" size={16} />
            )}
          </button>
        )}
      </span>
    </li>
  );
}

/** The missions in a panel, opened from the tile of the phone. */
export function MissionsDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  return (
    <Dialog open={open} title={MISSIONS_TITLE} onClose={onClose} variant="center" hideTitle>
      {open && <MissionsCard className={styles.inDialog} />}
    </Dialog>
  );
}
