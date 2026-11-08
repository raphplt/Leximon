"use client";

import type { BoosterWalletResponse, CarnetRefusal, LevelRewardView } from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
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
  claimedToast,
  givesSachets,
  reserveAfterClaim,
  rewardItem,
} from "@leximon/view-model";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useState } from "react";
import { RewardSign } from "@/levels/reward-toy";
import { claimCarnetCase } from "@/player/missions";
import { carnet } from "@/player/player";
import { useShared } from "@/player/resource";
import { RewardVisual } from "@/shell/coffret-dialog";
import styles from "@/shell/coffret-dialog.module.css";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import page from "./carnet-dialog.module.css";

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
 * The carnet de pointage: the period's cases, filled by the days played, the next one to take. The
 * claim happens on « Prendre la case »: the server applies it and says what it gave.
 */
export function CarnetDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ name: "closed" });
  const [wasOpen, setWasOpen] = useState(open);
  const current = useShared(carnet);
  const router = useRouter();
  const toast = useToast();

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep({ name: "closed" });
      carnet.refresh();
    }
  }
  if (current === null) return null;
  const view = carnetView(current);
  const next = current.next;
  const action = carnetAction(current);

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

  const take = (rewards: readonly LevelRewardView[]) => {
    onClose();
    toast(claimedToast(rewards));
  };

  return (
    <Dialog open={open} title={CARNET_TITLE} onClose={onClose} variant="center" hideTitle>
      <div className={styles.coffret}>
        <span className={styles.rays} aria-hidden="true" />
        <div className={styles.inner}>
          {step.name === "opened" ? (
            <>
              <p className={`${ui.kicker} ${styles.kicker}`}>{CARNET_TITLE}</p>
              <h2 className={`${ui.display} ${ui.pop} ${styles.levelUp}`}>Case {step.case} !</h2>
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
                        <span className={styles.itemDetail}>{item.detail}</span>
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
              <Button wide className={styles.action} onClick={() => take(step.rewards)}>
                Prendre les récompenses
              </Button>
            </>
          ) : (
            <>
              <p className={`${ui.kicker} ${styles.kicker}`}>{view.dates}</p>
              <h2 className={`${ui.display} ${styles.title}`}>{CARNET_TITLE}</h2>
              <p className={page.filled}>{view.filled}</p>
              <ol className={page.cases}>
                {view.cases.map((item) => (
                  <Case key={item.number} item={item} next={next?.case ?? null} />
                ))}
              </ol>
              {step.name === "refused" ? (
                <p className={styles.refused} role="alert">
                  {carnetRefusalMessage(step.reason)}
                </p>
              ) : step.name === "failed" ? (
                <p className={styles.refused} role="alert">
                  {CARNET_FAILED}
                </p>
              ) : (
                <p className={styles.hint}>
                  {carnetNotStartedLine(current) ??
                    carnetNextLine(current) ??
                    carnetTomorrowLine(current) ??
                    CARNET_RULE}
                </p>
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
              ) : action === null ? (
                <Button wide onClick={onClose}>
                  Fermer
                </Button>
              ) : (
                <Button
                  wide
                  onClick={() => void claim()}
                  disabled={step.name === "claiming" || step.name === "refused"}
                >
                  {step.name === "claiming" ? CARNET_BUSY : action}
                </Button>
              )}
              {action !== null && <p className={page.rule}>{CARNET_RULE}</p>}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** A case: its reward, ticked once taken, glowing when it is the next to take. */
function Case({ item, next }: { readonly item: CarnetCase; readonly next: number | null }) {
  const glowing = item.status === "waiting" && item.number === next;
  return (
    <li
      className={`${page.case} ${page[item.status]} ${glowing ? page.next : ""} ${item.big ? page.big : ""}`}
      aria-label={item.label}
    >
      <span className={page.caseIcon} aria-hidden="true">
        {item.status === "claimed" ? (
          <Icon name="check" size={16} />
        ) : (
          <RewardSign icon={item.icon} size={24} />
        )}
      </span>
      <span className={page.caseNumber} aria-hidden="true">
        {item.number}
      </span>
    </li>
  );
}

const SHOWN_KEY = "leximon.carnet-shown";
let shownOn: string | null = null;

/**
 * Opens the carnet by itself once a day, on the first screen where a case waits. Remembered on
 * this device only, as the welcome week.
 */
export function useCarnetOnArrival(waits: boolean, now: number, open: () => void): void {
  useEffect(() => {
    if (!waits || now === 0) return;
    const today = gameDayOf(now).key;
    if (shownOn === today) return;
    shownOn = today;
    try {
      if (window.localStorage.getItem(SHOWN_KEY) === today) return;
      window.localStorage.setItem(SHOWN_KEY, today);
    } catch {
      // Storage refused (private window): the carnet opens once per page load instead.
    }
    open();
  }, [waits, now, open]);
}
