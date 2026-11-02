"use client";

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
} from "@leximon/view-model";
import { useRouter } from "next/navigation";
import { type CSSProperties, useState } from "react";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { publishClaimed, wallet } from "@/player/player";
import { useLibraryLook } from "@/theme/use-library-look";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import { useToast } from "@/ui/toast";
import { ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./coffret-dialog.module.css";
import { REWARD_ICONS } from "./reward-icons";

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
 * A level's coffret: closed with its rays, then opened on the rewards one by one. The
 * claim happens on « Ouvrir le coffret »: the server applies it and says what it gave.
 */
export function CoffretDialog({
  level,
  now,
  onClose,
}: {
  /** `null` when no coffret is shown. */
  readonly level: number | null;
  readonly now: number;
  readonly onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ name: "closed" });
  const [shownLevel, setShownLevel] = useState<number | null>(null);
  const router = useRouter();
  const toast = useToast();

  // A new coffret starts closed.
  if (level !== shownLevel) {
    setShownLevel(level);
    setStep({ name: "closed" });
  }

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
    if (step.name === "opened") toast(claimedToast(step.rewards));
    onClose();
    router.push("/niveaux");
  };

  const opens = level === null ? null : opensAt(level, now);
  const library = useLibraryLook();

  return (
    <Dialog
      open={level !== null}
      title={`Coffret du niveau ${level ?? ""}`}
      onClose={onClose}
      variant="center"
      hideTitle
    >
      <div className={styles.coffret}>
        <span className={styles.rays} aria-hidden="true" />
        <div className={styles.inner}>
          {step.name === "opened" ? (
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
                      key={item.title}
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
              {step.rewards.some(
                (r) => r.kind === "bonus_booster" || r.kind === "garni_booster",
              ) && (
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
              {level !== null && (
                <p className={`${ui.kicker} ${styles.kicker}`}>{coffretReached(level)}</p>
              )}
              <button
                type="button"
                className={`${styles.box} ${ui.float}`}
                onClick={() => void open()}
                disabled={step.name === "claiming" || step.name === "refused"}
                aria-label="Ouvrir le coffret"
              >
                {library ? <ToyIcon name="chest" size={96} /> : <Icon name="coffret" size={84} />}
              </button>
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
                  disabled={step.name === "claiming" || step.name === "refused"}
                >
                  {step.name === "claiming" ? "Ouverture…" : "Ouvrir le coffret"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** What a reward looks like: the sachet itself, the engraving, the frame; an icon otherwise. */
function RewardVisual({ reward }: { readonly reward: LevelRewardView }) {
  switch (reward.kind) {
    case "bonus_booster":
    case "garni_booster":
      return (
        <span className={styles.visual} aria-hidden="true">
          <span className={reward.kind === "garni_booster" ? styles.miniGarni : styles.mini}>
            <span className={styles.miniSeal}>
              <Icon name={reward.kind === "garni_booster" ? "star" : "sachet"} size={12} />
            </span>
          </span>
        </span>
      );
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
          <Icon name={REWARD_ICONS[item.icon]} size={26} />
        </span>
      );
    }
  }
}
