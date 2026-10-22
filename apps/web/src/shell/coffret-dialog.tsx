"use client";

import type { ClaimRefusal, LevelRewardView } from "@leximon/contract";
import {
  claimedToast,
  claimRefusalMessage,
  coffretAction,
  coffretHint,
  opensAt,
  rewardItem,
} from "@leximon/view-model";
import { useRouter } from "next/navigation";
import { type CSSProperties, useState } from "react";
import { claimLevelReward } from "@/lib/api";
import { publishClaimed, wallet } from "@/player/player";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./coffret-dialog.module.css";
import { REWARD_ICONS } from "./reward-icons";

type Step =
  | { readonly name: "closed" }
  | { readonly name: "claiming" }
  | { readonly name: "opened"; readonly rewards: readonly LevelRewardView[] }
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
      const result = await claimLevelReward(level);
      if (result.kind === "refused") {
        setStep({ name: "refused", reason: result.reason });
        return;
      }
      wallet.publish(result.wallet);
      publishClaimed(level);
      setStep({ name: "opened", rewards: result.rewards });
    } catch {
      setStep({ name: "failed" });
    }
  };

  const store = (rewards: readonly LevelRewardView[]) => {
    onClose();
    toast(claimedToast(rewards));
  };

  const opens = level === null ? null : opensAt(level, now);

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
          <p className={`${ui.kicker} ${styles.kicker}`}>Niveau {level}</p>
          {step.name === "opened" ? (
            <>
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
                      <span className={styles.itemIcon}>
                        <Icon name={REWARD_ICONS[item.icon]} size={26} />
                      </span>
                      <span>
                        <span className={styles.itemTitle}>{item.title}</span>
                        <span className={styles.itemDetail}>{item.detail}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {opens !== null && (
                <p className={`${styles.opens} ${ui.pop}`} style={{ animationDelay: "400ms" }}>
                  Ouvre : {opens.charAt(0).toLowerCase()}
                  {opens.slice(1)}
                </p>
              )}
              <Button wide className={styles.action} onClick={() => store(step.rewards)}>
                {coffretAction(step.rewards)}
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.box} ${ui.float}`}
                onClick={() => void open()}
                disabled={step.name === "claiming" || step.name === "refused"}
                aria-label="Ouvrir le coffret"
              >
                <Icon name="coffret" size={84} />
              </button>
              <h2 className={`${ui.display} ${styles.title}`}>Un coffret pour toi</h2>
              {step.name === "refused" ? (
                <p className={styles.refused} role="alert">
                  {claimRefusalMessage(step.reason, level ?? 0)}
                </p>
              ) : step.name === "failed" ? (
                <p className={styles.refused} role="alert">
                  Le serveur lambine. Réessaie.
                </p>
              ) : (
                <p className={styles.hint}>{level === null ? "" : coffretHint(level, now)}</p>
              )}
              {step.name === "refused" &&
              (step.reason === "reserve_full" || step.reason === "stock_full") ? (
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
