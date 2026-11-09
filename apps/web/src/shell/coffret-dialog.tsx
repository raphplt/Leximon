"use client";

import type { BoosterWalletResponse, ClaimRefusal, LevelRewardView } from "@leximon/contract";
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
} from "@leximon/view-model";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { RewardSign } from "@/levels/reward-toy";
import { api } from "@/lib/api";
import { publishClaimed, wallet } from "@/player/player";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import { Tooling } from "@/ui/ornaments";
import { useToast } from "@/ui/toast";
import { ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./coffret-dialog.module.css";

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
 * A level's coffret: closed with its rays, then opened on the rewards one by one. The
 * claim happens on « Ouvrir le coffret »: the server applies it and says what it gave. With
 * several waiting, they may all open at once, one claim after another, and their rewards show
 * together.
 */
export function CoffretDialog({
  level,
  waiting,
  all,
  now,
  onClose,
}: {
  /** `null` when no coffret is shown; the lowest one waiting when all open at once. */
  readonly level: number | null;
  /** Every coffret waiting, lowest first. */
  readonly waiting: readonly number[];
  /** Opens them all as soon as shown. */
  readonly all: boolean;
  readonly now: number;
  readonly onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ name: "closed" });
  const [shown, setShown] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const started = useRef<string | null>(null);
  const key = level === null ? null : `${level}${all ? "+" : ""}`;

  // A new coffret starts closed.
  if (key !== shown) {
    setShown(key);
    setStep({ name: "closed" });
  }

  const openAll = async () => {
    // The list is taken once: each claim changes the coffrets waiting.
    const levels = [...waiting];
    const opened: number[] = [];
    const rewards: LevelRewardView[] = [];
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
        rewards.push(...result.rewards);
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
      rewards,
      wallet: last,
      stop: stop === null ? null : { reason: stop, left: levels.length - opened.length },
    });
  };

  // Opening them all from a button elsewhere starts at once, a single time per showing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: started once per coffret shown
  useEffect(() => {
    if (!all || key === null || started.current === key) return;
    started.current = key;
    void openAll();
  }, [all, key]);
  useEffect(() => {
    if (key === null) started.current = null;
  }, [key]);

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
    onClose();
    toast(claimedToast(rewards));
  };

  const toRoad = () => {
    if (step.name === "opened" || step.name === "openedAll") toast(claimedToast(step.rewards));
    onClose();
    router.push("/niveaux");
  };

  const opens = level === null ? null : opensAt(level, now);
  const busy = step.name === "claiming" || step.name === "claimingAll";

  return (
    <Dialog
      open={level !== null}
      title={all ? "Les coffrets" : `Coffret du niveau ${level ?? ""}`}
      onClose={() => {
        if (!busy) onClose();
      }}
      variant="center"
      hideTitle
    >
      <div className={styles.coffret}>
        <Tooling />
        <span className={styles.rays} aria-hidden="true" />
        <div className={styles.inner}>
          {step.name === "openedAll" ? (
            <>
              <p className={`${ui.kicker} ${styles.kicker}`}>{openedLevelsLabel(step.levels)}</p>
              <span className={`${ui.pop} ${styles.chests}`} aria-hidden="true">
                <ToyIcon name="chest" size={84} />
              </span>
              <h2 className={`${ui.display} ${ui.pop} ${styles.levelUp}`}>
                {openedAllTitle(step.levels.length)}
              </h2>
              <ul className={styles.items}>
                {tallyRewards(step.rewards).map((tally, index) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list, shown once; two titles may be alike
                    key={`${tally.reward.kind}-${index}`}
                    className={`${styles.item} ${ui.pop}`}
                    style={{ animationDelay: `${120 + index * 110}ms` } as CSSProperties}
                  >
                    <RewardVisual reward={tally.reward} />
                    <span>
                      <span className={styles.itemTitle}>{tally.item.title}</span>
                      {tally.reward.kind === "title" ? (
                        <span className={styles.plaque}>{tally.reward.title}</span>
                      ) : (
                        <span className={styles.itemDetail}>{tally.item.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {step.rewards.some(givesSachets) && (
                <p className={`${styles.stored} ${ui.pop}`} style={{ animationDelay: "320ms" }}>
                  {reserveAfterClaim(step.wallet)}
                </p>
              )}
              {step.stop !== null && (
                <p className={`${styles.refused} ${styles.stopped}`} role="alert">
                  {openAllStopped(
                    step.stop.reason,
                    step.stop.left,
                    (step.levels[step.levels.length - 1] ?? 0) + 1,
                  )}
                </p>
              )}
              <Button wide className={styles.action} onClick={() => store(step.rewards)}>
                {COFFRET_ACTION}
              </Button>
              <Button wide variant="ghost" className={styles.road} onClick={toRoad}>
                {COFFRET_ROAD}
              </Button>
            </>
          ) : step.name === "opened" ? (
            <>
              {level !== null && (
                <span className={`${ui.pop} ${styles.levelBadge}`}>
                  <LevelMedal level={level} size={104} />
                </span>
              )}
              <h2 className={`${ui.display} ${ui.pop} ${styles.levelUp}`}>Niveau {level} !</h2>
              <ul className={styles.items}>
                {step.rewards.map((reward, index) => {
                  const item = rewardItem(reward);
                  return (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list, shown once; two rewards may be alike
                      key={`${reward.kind}-${index}`}
                      className={`${styles.item} ${ui.pop}`}
                      style={{ animationDelay: `${120 + index * 140}ms` } as CSSProperties}
                    >
                      <RewardVisual reward={reward} />
                      <span>
                        <span className={styles.itemTitle}>{item.title}</span>
                        {reward.kind === "title" ? (
                          <span className={styles.plaque}>{reward.title}</span>
                        ) : (
                          <span className={styles.itemDetail}>{item.detail}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {step.rewards.some(givesSachets) && (
                <p className={`${styles.stored} ${ui.pop}`} style={{ animationDelay: "320ms" }}>
                  {reserveAfterClaim(step.wallet)}
                </p>
              )}
              {opens !== null && (
                <p className={`${styles.opens} ${ui.pop}`} style={{ animationDelay: "400ms" }}>
                  Débloque {opens.charAt(0).toLowerCase()}
                  {opens.slice(1)}
                </p>
              )}
              <Button wide className={styles.action} onClick={() => store(step.rewards)}>
                {COFFRET_ACTION}
              </Button>
              <Button wide variant="ghost" className={styles.road} onClick={toRoad}>
                {COFFRET_ROAD}
              </Button>
            </>
          ) : (
            <>
              {step.name === "claimingAll" ? (
                <p className={`${ui.kicker} ${styles.kicker}`}>{coffretsLabel(step.total)}</p>
              ) : (
                level !== null && (
                  <p className={`${ui.kicker} ${styles.kicker}`}>{coffretReached(level)}</p>
                )
              )}
              <button
                type="button"
                className={`${styles.box} ${step.name === "claimingAll" ? styles.shaking : ui.float}`}
                onClick={() => void open()}
                disabled={busy || step.name === "refused"}
                aria-label="Ouvrir le coffret"
              >
                <ToyIcon name="chest" size={96} />
              </button>
              {step.name === "claimingAll" ? (
                <>
                  <h2 className={`${ui.display} ${styles.title}`}>{OPENING_ALL_TITLE}</h2>
                  <p className={styles.progress} aria-live="polite">
                    {openingAllLabel(step.done, step.total)}
                  </p>
                </>
              ) : (
                <>
                  <h2 className={`${ui.display} ${styles.title}`}>Un coffret pour toi</h2>
                  {step.name === "refused" ? (
                    <p className={styles.refused} role="alert">
                      {claimRefusalMessage(step.reason, level ?? 0)}
                    </p>
                  ) : step.name === "failed" ? (
                    <p className={styles.refused} role="alert">
                      Le serveur ne répond pas. Réessaie.
                    </p>
                  ) : (
                    <p className={styles.hint}>{level === null ? "" : coffretHint(level, now)}</p>
                  )}
                  {step.name === "refused" && step.reason === "reserve_full" ? (
                    <Button
                      wide
                      onClick={() => {
                        onClose();
                        router.push("/jouer");
                      }}
                    >
                      Ouvrir un sachet
                    </Button>
                  ) : (
                    <Button
                      wide
                      onClick={() => void open()}
                      disabled={busy || step.name === "refused"}
                    >
                      {step.name === "claiming" ? "Ouverture…" : "Ouvrir le coffret"}
                    </Button>
                  )}
                  {waiting.length > 1 && step.name !== "refused" && (
                    <Button
                      wide
                      variant="ghost"
                      className={styles.road}
                      onClick={() => void openAll()}
                      disabled={busy}
                    >
                      {openAllLabel(waiting.length)}
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

const MINI_SACHETS = {
  bonus_booster: { className: styles.mini, icon: "sachet" },
  garni_booster: { className: styles.miniGarni, icon: "star" },
  precious_garni_booster: { className: styles.miniPrecious, icon: "star" },
} as const;

/** What a reward looks like: the sachet itself, the engraving, the frame; an icon otherwise. */
export function RewardVisual({ reward }: { readonly reward: LevelRewardView }) {
  switch (reward.kind) {
    case "bonus_booster":
    case "garni_booster":
    case "precious_garni_booster": {
      const mini = MINI_SACHETS[reward.kind];
      return (
        <span className={styles.visual} aria-hidden="true">
          <span className={mini.className}>
            <span className={styles.miniSeal}>
              <Icon name={mini.icon} size={12} />
            </span>
          </span>
        </span>
      );
    }
    case "avatar":
      return (
        <span className={styles.visual}>
          <Avatar avatar={reward.avatar ?? null} frame="simple" size={52} />
        </span>
      );
    case "frame":
      return (
        <span className={styles.visual}>
          <Avatar avatar={null} frame={reward.frame} size={52} />
        </span>
      );
    default: {
      const item = rewardItem(reward);
      return (
        <span className={styles.itemIcon}>
          <RewardSign icon={item.icon} size={34} />
        </span>
      );
    }
  }
}
