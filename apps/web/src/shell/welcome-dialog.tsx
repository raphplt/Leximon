"use client";

import type { BoosterWalletResponse, LevelRewardView, WelcomeRefusal } from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import {
  claimedToast,
  givesSachets,
  reserveAfterClaim,
  rewardItem,
  WELCOME_OPEN,
  WELCOME_RULE,
  WELCOME_TAKE,
  WELCOME_TITLE,
  WELCOME_TOMORROW,
  type WelcomeCase,
  welcomeAfterClaim,
  welcomeKicker,
  welcomeRefusalMessage,
  welcomeView,
} from "@leximon/view-model";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { publishWelcomeClaimed, wallet, welcomeWeek } from "@/player/player";
import { useShared } from "@/player/resource";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import { RewardVisual } from "./coffret-dialog";
import styles from "./coffret-dialog.module.css";
import { REWARD_ICONS } from "./reward-icons";
import week from "./welcome-dialog.module.css";

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
 * The welcome week: the seven days in a row, today's to open. The claim happens on « Ouvrir la
 * case du jour »: the server applies it and says what it gave.
 */
export function WelcomeDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ name: "closed" });
  const [wasOpen, setWasOpen] = useState(open);
  const current = useShared(welcomeWeek);
  const router = useRouter();
  const toast = useToast();

  // Shown again, it starts closed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStep({ name: "closed" });
  }
  if (current === null) return null;
  const view = welcomeView(current);
  const total = current.days.length;
  const today = view.today;

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

  const take = (rewards: readonly LevelRewardView[]) => {
    onClose();
    toast(claimedToast(rewards));
  };

  return (
    <Dialog open={open} title={WELCOME_TITLE} onClose={onClose} variant="center" hideTitle>
      <div className={styles.coffret}>
        <span className={styles.rays} aria-hidden="true" />
        <div className={styles.inner}>
          {step.name === "opened" ? (
            <>
              <p className={`${ui.kicker} ${styles.kicker}`}>{WELCOME_TITLE}</p>
              <h2 className={`${ui.display} ${ui.pop} ${styles.levelUp}`}>Jour {step.day} !</h2>
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
              {welcomeAfterClaim(current, step.day) === null ? (
                <ol
                  className={`${week.days} ${week.after} ${ui.pop}`}
                  style={{ animationDelay: "400ms" }}
                >
                  {view.cases.map((day) => (
                    <Day key={day.day} day={day} />
                  ))}
                </ol>
              ) : (
                <p className={`${styles.opens} ${ui.pop}`} style={{ animationDelay: "400ms" }}>
                  {welcomeAfterClaim(current, step.day)}
                </p>
              )}
              <Button wide className={styles.action} onClick={() => take(step.rewards)}>
                {WELCOME_TAKE}
              </Button>
            </>
          ) : (
            <>
              <p className={`${ui.kicker} ${styles.kicker}`}>
                {today === null ? WELCOME_TITLE : welcomeKicker(today, total)}
              </p>
              <h2 className={`${ui.display} ${styles.title}`}>{WELCOME_TITLE}</h2>
              <ol className={week.days}>
                {view.cases.map((day) => (
                  <Day key={day.day} day={day} />
                ))}
              </ol>
              {step.name === "refused" ? (
                <p className={styles.refused} role="alert">
                  {welcomeRefusalMessage(step.reason)}
                </p>
              ) : step.name === "failed" ? (
                <p className={styles.refused} role="alert">
                  Le serveur ne répond pas. Réessaie.
                </p>
              ) : (
                // Once today's case is open, the row says it all: tomorrow's case is lit.
                today !== null && <p className={styles.hint}>{WELCOME_RULE}</p>
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
              ) : today === null ? (
                <Button wide onClick={onClose}>
                  Fermer
                </Button>
              ) : (
                <Button
                  wide
                  onClick={() => void claim()}
                  disabled={step.name === "claiming" || step.name === "refused"}
                >
                  {step.name === "claiming" ? "Ouverture…" : WELCOME_OPEN}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

const SHOWN_KEY = "leximon.welcome-shown";
/** The day it opened by itself in this page, for when the storage is refused. */
let shownOn: string | null = null;

/**
 * Opens the welcome week by itself once a day, on the first screen where today's day waits.
 * Remembered on this device only: elsewhere, it opens once more, which is harmless.
 */
export function useWelcomeOnArrival(waits: boolean, now: number, open: () => void): void {
  useEffect(() => {
    if (!waits || now === 0) return;
    const today = gameDayOf(now).key;
    if (shownOn === today) return;
    shownOn = today;
    try {
      if (window.localStorage.getItem(SHOWN_KEY) === today) return;
      window.localStorage.setItem(SHOWN_KEY, today);
    } catch {
      // Storage refused (private window): the week opens once per page load instead.
    }
    open();
  }, [waits, now, open]);
}

/** A day of the week: its main reward, ticked once claimed, glowing when it is today's, lit and named when it is tomorrow's. */
function Day({ day }: { readonly day: WelcomeCase }) {
  return (
    <li
      className={`${week.day} ${week[day.status]} ${day.last ? week.last : ""}`}
      aria-label={`${day.label}, ${day.phrase}${day.status === "claimed" ? ", reçu" : ""}`}
    >
      <span className={week.dayIcon} aria-hidden="true">
        <Icon
          name={day.status === "claimed" ? "check" : REWARD_ICONS[day.icon]}
          size={day.status === "tomorrow" ? 24 : 20}
        />
      </span>
      <span className={week.dayLabel} aria-hidden="true">
        {day.status === "tomorrow" ? WELCOME_TOMORROW : day.day}
      </span>
    </li>
  );
}
