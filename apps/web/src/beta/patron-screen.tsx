"use client";

import type {
  MonthCosmeticView,
  PatronFindsView,
  PatronPlan,
  PatronResponse,
  ProfileResponse,
} from "@leximon/contract";
import type { ToyIconName } from "@leximon/tokens";
import {
  claimableLabel,
  editionsOwnedLine,
  findStateLine,
  findsLeftLine,
  monthCosmeticLine,
  PATRON_BENEFITS,
  PATRON_CANCEL_NOTE,
  PATRON_CARD_KICKER,
  PATRON_CHECKOUT_FAILED,
  PATRON_CLAIM,
  PATRON_CLAIM_BUSY,
  PATRON_CLAIMABLE_TITLE,
  PATRON_CLAIMED,
  PATRON_CONFIRM_INTERVAL_MS,
  PATRON_CONFIRM_POLLS,
  PATRON_CONFIRMING,
  PATRON_CREATE_ACCOUNT,
  PATRON_DEFAULT_PLAN,
  PATRON_DOOR_KICKER,
  PATRON_EDITIONS_TITLE,
  PATRON_FIND_ACTION,
  PATRON_FINDS_RULE,
  PATRON_FINDS_TITLE,
  PATRON_FOUNDING_OFFER,
  PATRON_GUEST_NOTE,
  PATRON_INTRO,
  PATRON_KICKER,
  PATRON_LOAD_FAILED,
  PATRON_MANAGE_BUSY,
  PATRON_MINOR_NOTE,
  PATRON_NO_ADVANTAGE,
  PATRON_NOTIFIED,
  PATRON_NOTIFY,
  PATRON_PAGE_TITLE,
  PATRON_PORTAL_FAILED,
  PATRON_SEE_SUBSCRIPTION,
  PATRON_SUBSCRIBE,
  PATRON_SUBSCRIBE_BUSY,
  PATRON_THANKS,
  PATRON_WAIVER,
  PATRON_WEAR_TITLE,
  type PatronWelcomeKind,
  patronPageKind,
  patronPlanChoices,
  patronStatus,
  patronTitleOf,
  patronTitleWorn,
  patronTrialNote,
  patronWelcome,
  playerName,
} from "@leximon/view-model";
import { useRouter, useSearchParams } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import account from "@/account/account-screen.module.css";
import { Avatar } from "@/components/avatar";
import { PatronBadge } from "@/components/patron-badge";
import { api } from "@/lib/api";
import { MainAction } from "@/library/play-pieces";
import { Rays } from "@/library/reveal-pieces";
import { editions, profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { useProfileActions } from "@/profile/use-profile-actions";
import { ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { ParticleStage } from "@/ui/stage";
import { useToast } from "@/ui/toast";
import { Kicker, Leaf, Lettering, Lettrine, Toy, ToyBody } from "@/ui/toy";
import styles from "./patron-screen.module.css";

/** Where Stripe sends the player back after paying. */
const THANKS_QUERY = "merci";

/** The icon of each benefit, in the order of the list. */
const BENEFIT_ICONS: readonly ToyIconName[] = ["chest", "scroll", "ink", "books", "gilded"];

const WELCOME_ICONS: Readonly<Record<PatronWelcomeKind, ToyIconName>> = {
  mark: "gilded",
  payment: "ecu",
  cosmetic: "chest",
  word: "scroll",
};

/** Each piece rises in turn when the screen appears, as on Jouer. */
const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

/**
 * The patron page: the offer announced before sales open, the offer itself laid out like a shop
 * window, the reward back from the payment, then the subscriber's card. Stripe's own pages take
 * the payment and the management of the subscription.
 */
export function PatronScreen() {
  return (
    <ParticleStage dust>
      <PatronPage />
    </ParticleStage>
  );
}

function PatronPage() {
  const me = useShared(profile);
  const router = useRouter();
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
      <main className={styles.page}>
        <LoadFailed onRetry={() => void load()} />
      </main>
    );
  }
  if (patron === null) return <main className={styles.page} />;

  const guest = me !== null && !me.member;
  switch (patronPageKind(patron, guest)) {
    case "member":
      return thanks ? (
        <Thanks
          patron={patron}
          me={me}
          onDone={() => {
            router.replace("/mecene");
            window.scrollTo({ top: 0 });
          }}
        />
      ) : (
        <MemberView patron={patron} me={me} onClaimed={load} />
      );
    case "offer":
      return <OfferView patron={patron} me={me} guest={guest} confirming={confirming} />;
    case "door":
      return <DoorView patron={patron} me={me} />;
  }
}

/** The player's avatar in a frame, crowned like the badge on a profile. */
function CrownedAvatar({
  size,
  avatar,
  frame,
}: {
  readonly size: number;
  readonly avatar: string | null;
  readonly frame: string | null;
}) {
  return (
    <span className={styles.crowned} style={{ "--size": `${size}px` } as CSSProperties}>
      <span className={styles.crown}>
        <Icon name="crown" size={Math.round(size / 3.2)} />
      </span>
      <Avatar avatar={avatar} frame={frame} size={size} />
    </span>
  );
}

/** The player wearing this month's cosmetic, to show what it looks like on them. */
function monthLook(me: ProfileResponse | null, month: MonthCosmeticView | null) {
  const cosmetic = month?.cosmetic;
  return {
    avatar: cosmetic?.kind === "avatar" ? cosmetic.avatar : (me?.avatar ?? null),
    frame: cosmetic?.kind === "frame" ? cosmetic.frame : (me?.frame ?? null),
  };
}

/** The top of the window: the player in the month's cosmetic, the title and what it is for. */
function Hero({
  kicker,
  patron,
  me,
}: {
  readonly kicker: string;
  readonly patron: PatronResponse;
  readonly me: ProfileResponse | null;
}) {
  const month = monthCosmeticLine(patron.monthCosmetic);
  return (
    <header className={styles.hero} style={rise(0)}>
      <CrownedAvatar size={150} {...monthLook(me, patron.monthCosmetic)} />
      <div className={styles.heroText}>
        <Kicker>{kicker}</Kicker>
        <h1 className={styles.display}>
          <Lettering>{PATRON_PAGE_TITLE}</Lettering>
        </h1>
        <p className={styles.lead}>{PATRON_INTRO}</p>
        {month !== null && <p className={styles.month}>{month}</p>}
      </div>
    </header>
  );
}

function Benefits() {
  return (
    <ul className={styles.benefits} style={rise(2)}>
      {PATRON_BENEFITS.map((benefit, index) => (
        <li key={benefit}>
          <Leaf className={styles.benefit}>
            <ToyBody matter="gold" shape="tile" className={styles.tileIcon}>
              <Lettrine
                icon={BENEFIT_ICONS[index] ?? "chest"}
                matter={index === 1 ? "blue" : "red"}
                size={52}
              />
            </ToyBody>
            <p>{benefit}</p>
          </Leaf>
        </li>
      ))}
    </ul>
  );
}

/** Before sales open: the offer and its price, and asking to be told is counted. */
function DoorView({
  patron,
  me,
}: {
  readonly patron: PatronResponse;
  readonly me: ProfileResponse | null;
}) {
  const [asked, setAsked] = useState(false);
  const [monthly, yearly] = patronPlanChoices(Date.now());
  const ask = () => {
    setAsked(true);
    api.recordInterest("patron_notify").catch(() => undefined);
  };
  return (
    <main className={styles.page}>
      <Hero kicker={PATRON_DOOR_KICKER} patron={patron} me={me} />
      <Benefits />
      <div style={rise(3)}>
        <Leaf className={styles.buy}>
          <p className={styles.prices}>
            <strong>{monthly?.label}</strong> ou <strong>{yearly?.label}</strong>.
          </p>
          {asked ? (
            <p className={styles.done} role="status">
              {PATRON_NOTIFIED}
            </p>
          ) : (
            <MainAction label={PATRON_NOTIFY} onClick={ask} />
          )}
          <p className={styles.fine}>{PATRON_NO_ADVANTAGE}</p>
        </Leaf>
      </div>
    </main>
  );
}

function OfferView({
  patron,
  me,
  guest,
  confirming,
}: {
  readonly patron: PatronResponse;
  readonly me: ProfileResponse | null;
  readonly guest: boolean;
  readonly confirming: boolean;
}) {
  const [plan, setPlan] = useState<PatronPlan>(PATRON_DEFAULT_PLAN);
  const [waived, setWaived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept until the server answers: a second click opens the same payment page.
  const pendingKey = useRef<{ plan: PatronPlan; key: string } | null>(null);

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
    <main className={styles.page}>
      {confirming && (
        <p className={styles.notice} role="status">
          {PATRON_CONFIRMING}
        </p>
      )}
      <Hero kicker={PATRON_KICKER} patron={patron} me={me} />
      {patron.foundingOffer && (
        <div className={styles.founding} style={rise(1)}>
          <ToyBody matter="red" shape="round" className={styles.seal}>
            <Icon name="crown" size={26} />
          </ToyBody>
          <p>{PATRON_FOUNDING_OFFER}</p>
        </div>
      )}
      <Benefits />
      <div style={rise(3)}>
        <Leaf className={styles.buy}>
          <fieldset className={styles.plans} aria-label="Formule">
            {patronPlanChoices(Date.now()).map((choice) => (
              <Toy
                key={choice.plan}
                matter={plan === choice.plan ? "gold" : "paper"}
                shape="tile"
                large
                className={styles.plan}
                aria-pressed={plan === choice.plan}
                aria-label={choice.note === null ? choice.label : `${choice.label}. ${choice.note}`}
                onClick={() => setPlan(choice.plan)}
              >
                {choice.ribbon !== null && (
                  <ToyBody matter="red" shape="tag" className={styles.ribbon}>
                    <Lettering>{choice.ribbon}</Lettering>
                  </ToyBody>
                )}
                <Lettering className={styles.planPrice}>{choice.price}</Lettering>
                <span className={styles.planPeriod}>{choice.period}</span>
              </Toy>
            ))}
          </fieldset>
          <p className={styles.note}>{patronTrialNote(patron) ?? PATRON_CANCEL_NOTE}</p>
          {guest ? (
            <>
              <p className={styles.text}>{PATRON_GUEST_NOTE}</p>
              <ButtonLink href="/compte">{PATRON_CREATE_ACCOUNT}</ButtonLink>
            </>
          ) : (
            <>
              <label className={`${account.check} ${styles.check}`}>
                <input
                  type="checkbox"
                  checked={waived}
                  onChange={(event) => setWaived(event.target.checked)}
                />
                <span>{PATRON_WAIVER}</span>
              </label>
              {patron.minor && <p className={styles.warning}>{PATRON_MINOR_NOTE}</p>}
              <MainAction
                label={busy ? PATRON_SUBSCRIBE_BUSY : PATRON_SUBSCRIBE}
                disabled={!waived || busy}
                onClick={() => void subscribe()}
              />
              {error !== null && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
            </>
          )}
          <p className={styles.fine}>{PATRON_NO_ADVANTAGE}</p>
        </Leaf>
      </div>
    </main>
  );
}

/** Back from the payment: the crown falls on the player, then what today gives and what comes. */
function Thanks({
  patron,
  me,
  onDone,
}: {
  readonly patron: PatronResponse;
  readonly me: ProfileResponse | null;
  readonly onDone: () => void;
}) {
  const actions = useProfileActions();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), 150);
    return () => clearTimeout(timer);
  }, []);
  const welcome = patronWelcome(patron, Date.now());
  const title = patronTitleOf(patron);
  const wearing = me?.title === title;

  const wear = async () => {
    const problem = await actions.update({ title }, { success: patronTitleWorn(title) });
    if (problem === null) onDone();
  };

  return (
    <main className={`${styles.page} ${styles.thanks}`}>
      <div className={styles.thanksStage}>
        <Rays size={420} color="var(--lx-toy-gold-top)" shown={shown} />
        <span className={styles.thanksAvatar}>
          <span className={styles.fallingCrown}>
            <Icon name="crown" size={52} />
          </span>
          <Avatar avatar={me?.avatar ?? null} frame={me?.frame ?? null} size={150} />
        </span>
      </div>
      <h1 className={styles.display}>
        <Lettering>{PATRON_THANKS}</Lettering>
      </h1>
      <span className={styles.thanksBadge}>
        <PatronBadge mark={patron.mark ?? "patron"} />
      </span>
      {welcome !== null && (
        <ol className={styles.timeline}>
          {welcome.steps.map((step, index) => (
            <li
              key={step.kind + step.when}
              className={styles.step}
              data-later={step.later}
              style={rise(index + 1)}
            >
              <ToyBody
                matter={step.later ? "paper" : "gold"}
                shape="tile"
                className={styles.stepIcon}
              >
                <Lettrine
                  icon={WELCOME_ICONS[step.kind]}
                  matter={step.later ? "blue" : "red"}
                  size={44}
                  locked={step.later}
                />
              </ToyBody>
              <span className={styles.when}>{step.when}</span>
              <strong>{step.what}</strong>
            </li>
          ))}
        </ol>
      )}
      <div className={styles.actions}>
        {!wearing && (
          <MainAction
            label={PATRON_WEAR_TITLE}
            disabled={actions.busy}
            onClick={() => void wear()}
          />
        )}
        <Toy matter="paper" className={styles.secondary} onClick={onDone}>
          {PATRON_SEE_SUBSCRIPTION}
        </Toy>
      </div>
      {welcome?.note != null && <p className={styles.fine}>{welcome.note}</p>}
    </main>
  );
}

/** The subscriber's card: who they are as a patron, what comes next, what waits to be claimed. */
function MemberView({
  patron,
  me,
  onClaimed,
}: {
  readonly patron: PatronResponse;
  readonly me: ProfileResponse | null;
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
    <main className={`${styles.page} ${styles.member}`}>
      <div style={rise(0)}>
        <Leaf className={styles.card}>
          <div className={styles.cardHead}>
            <CrownedAvatar size={110} avatar={me?.avatar ?? null} frame={me?.frame ?? null} />
            <div className={styles.cardName}>
              <Kicker>{PATRON_CARD_KICKER}</Kicker>
              <h1 className={styles.name}>
                {me === null ? "" : playerName({ code: me.playerCode, pseudo: me.pseudo })}
              </h1>
              <PatronBadge mark={patron.mark ?? "patron"} />
            </div>
          </div>
          <Lettering className={styles.headline}>{status.headline}</Lettering>
          {status.lines.map((line) => (
            <p key={line} className={styles.text}>
              {line}
            </p>
          ))}
          {status.warning !== null && <p className={styles.warning}>{status.warning}</p>}
          <Toy
            matter="paper"
            className={styles.secondary}
            disabled={busy}
            onClick={() => void manage()}
          >
            {busy ? PATRON_MANAGE_BUSY : status.manage}
          </Toy>
          {error !== null && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </Leaf>
      </div>
      <div style={rise(1)}>
        <Finds finds={patron.finds} />
        <Editions />
      </div>
      {patron.claimable.length > 0 && (
        <section className={styles.claims} aria-label={PATRON_CLAIMABLE_TITLE} style={rise(1)}>
          {patron.claimable.map((item) => (
            <ClaimTile key={item.month} item={item} onClaimed={onClaimed} />
          ))}
        </section>
      )}
    </main>
  );
}

/** The library editions owned, kept for life, and where to choose them. */
function Editions() {
  const mine = useShared(editions);
  if (mine === null) return null;
  return (
    <Leaf className={styles.finds}>
      <div className={styles.findsHead}>
        <ToyBody matter="gold" shape="tile" className={styles.tileIcon}>
          <Lettrine icon="ink" matter="red" size={52} />
        </ToyBody>
        <div className={styles.findsText}>
          <Lettering className={styles.headline}>{PATRON_EDITIONS_TITLE}</Lettering>
          <p className={styles.text}>{editionsOwnedLine(mine.owned)}</p>
        </div>
      </div>
    </Leaf>
  );
}

/** The words the patron may find, and those found, with where each stands. */
function Finds({ finds }: { readonly finds: PatronFindsView }) {
  const router = useRouter();
  return (
    <Leaf className={styles.finds}>
      <div className={styles.findsHead}>
        <ToyBody matter="gold" shape="tile" className={styles.tileIcon}>
          <Lettrine icon="scroll" matter="blue" size={52} />
        </ToyBody>
        <div className={styles.findsText}>
          <Lettering className={styles.headline}>{PATRON_FINDS_TITLE}</Lettering>
          <p className={styles.text}>{findsLeftLine(finds.left)}</p>
        </div>
      </div>
      {finds.left > 0 ? (
        <MainAction label={PATRON_FIND_ACTION} onClick={() => router.push("/mecene/denicher")} />
      ) : (
        <p className={styles.note}>{PATRON_FINDS_RULE}</p>
      )}
      {finds.words.length > 0 && (
        <ul className={styles.found}>
          {finds.words.map((find) => (
            <li key={find.id}>
              <strong className={styles.foundWord}>{find.word}</strong>
              <span>{findStateLine(find.state)}</span>
            </li>
          ))}
        </ul>
      )}
    </Leaf>
  );
}

/** A month's cosmetic waiting for its patron, as a coffret to open. */
function ClaimTile({
  item,
  onClaimed,
}: {
  readonly item: MonthCosmeticView;
  readonly onClaimed: () => Promise<unknown>;
}) {
  const toast = useToast();
  const [claiming, setClaiming] = useState(false);

  const claim = async () => {
    setClaiming(true);
    try {
      const result = await api.claimPatronCosmetic(item.month);
      if (result.kind === "claimed") {
        toast(PATRON_CLAIMED);
        profile.refresh();
      }
      await onClaimed();
    } catch {
      toast(PATRON_LOAD_FAILED);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className={styles.claim}>
      <span className={styles.claimChest}>
        <ToyBody matter="gold" shape="tile" className={styles.tileIcon}>
          <Lettrine icon="chest" matter="red" size={52} />
        </ToyBody>
      </span>
      <span className={styles.claimText}>
        <Kicker>{PATRON_CLAIMABLE_TITLE}</Kicker>
        <strong>{claimableLabel(item)}</strong>
      </span>
      <Toy
        matter="gold"
        className={styles.claimButton}
        disabled={claiming}
        onClick={() => void claim()}
      >
        <Lettering>{claiming ? PATRON_CLAIM_BUSY : PATRON_CLAIM}</Lettering>
      </Toy>
    </div>
  );
}
