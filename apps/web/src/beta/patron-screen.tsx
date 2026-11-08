"use client";

import type { MonthCosmeticView, PatronPlan, PatronResponse } from "@leximon/contract";
import {
  claimableLabel,
  monthCosmeticLine,
  PATRON_BENEFITS,
  PATRON_CANCEL_NOTE,
  PATRON_CHECKOUT_FAILED,
  PATRON_CLAIM,
  PATRON_CLAIM_BUSY,
  PATRON_CLAIMABLE_TITLE,
  PATRON_CLAIMED,
  PATRON_CONFIRM_INTERVAL_MS,
  PATRON_CONFIRM_POLLS,
  PATRON_CONFIRMING,
  PATRON_CREATE_ACCOUNT,
  PATRON_DOOR_KICKER,
  PATRON_FOUNDING_OFFER,
  PATRON_GUEST_NOTE,
  PATRON_INTRO,
  PATRON_LOAD_FAILED,
  PATRON_MANAGE_BUSY,
  PATRON_MEMBER_TITLE,
  PATRON_MINOR_NOTE,
  PATRON_NO_ADVANTAGE,
  PATRON_NOTIFIED,
  PATRON_NOTIFY,
  PATRON_PAGE_TITLE,
  PATRON_PORTAL_FAILED,
  PATRON_SUBSCRIBE,
  PATRON_SUBSCRIBE_BUSY,
  PATRON_THANKS,
  PATRON_WAIVER,
  patronPageKind,
  patronPlanChoices,
  patronStatus,
  patronTrialNote,
} from "@leximon/view-model";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import styles from "@/account/account-screen.module.css";
import { api } from "@/lib/api";
import { profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { ButtonLink } from "@/ui/button";
import { LoadFailed } from "@/ui/load-failed";
import { WaitingScreen } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import own from "./patron-screen.module.css";

/** Where Stripe sends the player back after paying. */
const THANKS_QUERY = "merci";

/**
 * The patron page: the offer announced before sales open, the offer itself, then the subscriber's
 * status. Stripe's own pages take the payment and the management of the subscription.
 */
export function PatronScreen() {
  const me = useShared(profile);
  const thanks = useSearchParams().has(THANKS_QUERY);
  const [patron, setPatron] = useState<PatronResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(thanks);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const read = await api.fetchPatron();
      setPatron(read);
      return read;
    } catch {
      setFailed(true);
      return null;
    }
  }, []);

  useEffect(() => {
    // A lost signal only skews the count: the page works without it.
    api.recordInterest("patron_door").catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Back from Stripe, the webhook may land a moment after the player: read again for a while.
    const poll = async (left: number) => {
      const read = await load();
      if (cancelled) return;
      const subscribed = (read?.subscription?.standing ?? "none") !== "none";
      if (!thanks || subscribed || left <= 1) {
        setConfirming(thanks && !subscribed);
        return;
      }
      timer = setTimeout(() => void poll(left - 1), PATRON_CONFIRM_INTERVAL_MS);
    };
    void poll(PATRON_CONFIRM_POLLS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load, thanks]);

  if (patron === null && failed) {
    return (
      <main className={styles.screen}>
        <LoadFailed onRetry={() => void load()} />
      </main>
    );
  }
  if (patron === null) return <WaitingScreen className={styles.screen} />;

  const guest = me !== null && !me.member;
  switch (patronPageKind(patron, guest)) {
    case "member":
      return <MemberView patron={patron} thanks={thanks} onClaimed={load} />;
    case "offer":
      return <OfferView patron={patron} guest={guest} confirming={confirming} />;
    case "door":
      return <DoorView />;
  }
}

function Frame({
  kicker,
  title,
  children,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        {kicker !== undefined && <p className={styles.kicker}>{kicker}</p>}
        <h1 className={`${styles.title} ${ui.lettered}`}>{title}</h1>
      </header>
      <div className={`${styles.panel} ${ui.leaf}`}>{children}</div>
    </main>
  );
}

function Benefits() {
  return (
    <>
      <p className={styles.text}>{PATRON_INTRO}</p>
      <ul className={own.benefits}>
        {PATRON_BENEFITS.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <p className={styles.muted}>{PATRON_NO_ADVANTAGE}</p>
    </>
  );
}

/** Before sales open: the offer and its price, and asking to be told is counted. */
function DoorView() {
  const [asked, setAsked] = useState(false);
  const [monthly, yearly] = patronPlanChoices(Date.now());
  const ask = () => {
    setAsked(true);
    api.recordInterest("patron_notify").catch(() => undefined);
  };
  return (
    <Frame kicker={PATRON_DOOR_KICKER} title={PATRON_PAGE_TITLE}>
      <Benefits />
      <p className={styles.text}>
        <strong>{monthly?.label}</strong> ou <strong>{yearly?.label}</strong>.
      </p>
      {asked ? (
        <p className={styles.text} role="status">
          {PATRON_NOTIFIED}
        </p>
      ) : (
        <button type="button" className={`${styles.primary} ${ui.goldToy}`} onClick={ask}>
          {PATRON_NOTIFY}
        </button>
      )}
    </Frame>
  );
}

function OfferView({
  patron,
  guest,
  confirming,
}: {
  readonly patron: PatronResponse;
  readonly guest: boolean;
  readonly confirming: boolean;
}) {
  const [plan, setPlan] = useState<PatronPlan>("monthly");
  const [waived, setWaived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept until the server answers: a second click opens the same payment page.
  const pendingKey = useRef<{ plan: PatronPlan; key: string } | null>(null);
  const showcase = monthCosmeticLine(patron.monthCosmetic);
  const trialNote = patronTrialNote(patron) ?? PATRON_CANCEL_NOTE;

  const subscribe = async () => {
    setBusy(true);
    setError(null);
    if (pendingKey.current?.plan !== plan) {
      pendingKey.current = { plan, key: crypto.randomUUID() };
    }
    try {
      const result = await api.openPatronCheckout(plan, pendingKey.current.key);
      if (result.kind === "redirect") {
        window.location.assign(result.url);
        return;
      }
      // Already subscribed elsewhere, or sales just closed: the page as it is now says so.
      window.location.reload();
    } catch {
      pendingKey.current = null;
      setError(PATRON_CHECKOUT_FAILED);
      setBusy(false);
    }
  };

  return (
    <Frame title={PATRON_PAGE_TITLE}>
      {confirming && (
        <p className={styles.notice} role="status">
          {PATRON_CONFIRMING}
        </p>
      )}
      <Benefits />
      {showcase !== null && <p className={own.showcase}>{showcase}</p>}
      {patron.foundingOffer && <p className={own.showcase}>{PATRON_FOUNDING_OFFER}</p>}
      <fieldset className={own.plans} aria-label="Formule">
        {patronPlanChoices(Date.now()).map((choice) => (
          <button
            key={choice.plan}
            type="button"
            className={own.plan}
            aria-pressed={plan === choice.plan}
            onClick={() => setPlan(choice.plan)}
          >
            <span className={own.planLabel}>{choice.label}</span>
            {choice.note !== null && <span className={own.planNote}>{choice.note}</span>}
          </button>
        ))}
      </fieldset>
      <p className={styles.muted}>{trialNote}</p>
      {guest ? (
        <>
          <p className={styles.text}>{PATRON_GUEST_NOTE}</p>
          <ButtonLink href="/compte">{PATRON_CREATE_ACCOUNT}</ButtonLink>
        </>
      ) : (
        <>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={waived}
              onChange={(event) => setWaived(event.target.checked)}
            />
            <span>{PATRON_WAIVER}</span>
          </label>
          {patron.minor && <p className={styles.warning}>{PATRON_MINOR_NOTE}</p>}
          <button
            type="button"
            className={`${styles.primary} ${ui.goldToy}`}
            disabled={!waived || busy}
            onClick={() => void subscribe()}
          >
            {busy ? PATRON_SUBSCRIBE_BUSY : PATRON_SUBSCRIBE}
          </button>
          <p className={styles.error} role="alert">
            {error}
          </p>
        </>
      )}
    </Frame>
  );
}

function MemberView({
  patron,
  thanks,
  onClaimed,
}: {
  readonly patron: PatronResponse;
  readonly thanks: boolean;
  readonly onClaimed: () => Promise<unknown>;
}) {
  const status = patronStatus(patron, Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status === null) return null;

  const manage = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.openPatronPortal();
      if (result.kind === "redirect") {
        window.location.assign(result.url);
        return;
      }
      window.location.reload();
    } catch {
      setError(PATRON_PORTAL_FAILED);
      setBusy(false);
    }
  };

  return (
    <Frame title={PATRON_MEMBER_TITLE}>
      {thanks && (
        <p className={styles.notice} role="status">
          {PATRON_THANKS}
        </p>
      )}
      <p className={own.headline}>{status.headline}</p>
      {status.lines.map((line) => (
        <p key={line} className={styles.text}>
          {line}
        </p>
      ))}
      {status.warning !== null && <p className={styles.warning}>{status.warning}</p>}
      {patron.claimable.length > 0 && <Claimable items={patron.claimable} onClaimed={onClaimed} />}
      <button
        type="button"
        className={`${styles.secondary} ${ui.paperToy}`}
        disabled={busy}
        onClick={() => void manage()}
      >
        {busy ? PATRON_MANAGE_BUSY : status.manage}
      </button>
      <p className={styles.error} role="alert">
        {error}
      </p>
    </Frame>
  );
}

function Claimable({
  items,
  onClaimed,
}: {
  readonly items: readonly MonthCosmeticView[];
  readonly onClaimed: () => Promise<unknown>;
}) {
  const toast = useToast();
  const [claiming, setClaiming] = useState<string | null>(null);

  const claim = async (month: string) => {
    setClaiming(month);
    try {
      const result = await api.claimPatronCosmetic(month);
      if (result.kind === "claimed") {
        toast(PATRON_CLAIMED);
        profile.refresh();
      }
      await onClaimed();
    } catch {
      toast(PATRON_LOAD_FAILED);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <section>
      <h2 className={styles.subtitle}>{PATRON_CLAIMABLE_TITLE}</h2>
      <ul className={own.claims}>
        {items.map((item) => (
          <li key={item.month} className={own.claim}>
            <span>{claimableLabel(item)}</span>
            <button
              type="button"
              className={`${styles.primary} ${ui.goldToy}`}
              disabled={claiming !== null}
              onClick={() => void claim(item.month)}
            >
              {claiming === item.month ? PATRON_CLAIM_BUSY : PATRON_CLAIM}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
