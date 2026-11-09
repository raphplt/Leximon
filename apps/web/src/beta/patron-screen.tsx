"use client";

import {
  DISCORD_RETURN_QUERY,
  type MonthCosmeticView,
  PATRON_PORTAL_RETURN_QUERY,
  type PatronCosmeticView,
  type PatronFindsView,
  type PatronPlan,
  type PatronResponse,
  type ProfileResponse,
} from "@leximon/contract";
import type { ToyIconName } from "@leximon/tokens";
import {
  badgePerkLine,
  claimableMonth,
  cosmeticPerkLine,
  discordScreen,
  editionsOwnedLine,
  findStateLine,
  findsLeftLine,
  monthCosmeticLine,
  PATRON_CABINET_LINE,
  PATRON_CANCEL_NOTE,
  PATRON_CARD_KICKER,
  PATRON_CHECKOUT_FAILED,
  PATRON_CHOOSE_PLAN,
  PATRON_CLAIM,
  PATRON_CLAIM_BUSY,
  PATRON_CLAIMABLE_TITLE,
  PATRON_CONFIRM_INTERVAL_MS,
  PATRON_CONFIRM_POLLS,
  PATRON_CONFIRMING,
  PATRON_CREATE_ACCOUNT,
  PATRON_DEFAULT_PLAN,
  PATRON_DISCORD_FAILED,
  PATRON_DISCORD_LINK,
  PATRON_DISCORD_LINKED,
  PATRON_DISCORD_SOON,
  PATRON_DISCORD_UNLINK,
  PATRON_DOOR_KICKER,
  PATRON_FIND_ACTION,
  PATRON_FINDS_RULE,
  PATRON_FOUNDING_OFFER,
  PATRON_GUEST_NOTE,
  PATRON_INTRO,
  PATRON_INVOICES,
  PATRON_KICKER,
  PATRON_LOAD_FAILED,
  PATRON_MANAGE_BUSY,
  PATRON_MINOR_NOTE,
  PATRON_NOTIFIED,
  PATRON_NOTIFY,
  PATRON_OPEN_ALBUM,
  PATRON_PAGE_TITLE,
  PATRON_PAYMENT_NOTE,
  PATRON_PERKS,
  PATRON_PERKS_TITLE,
  PATRON_PLANS_TITLE,
  PATRON_POLL_CHOSEN,
  PATRON_POLL_FAILED,
  PATRON_POLL_VOTE,
  PATRON_PORTAL_FAILED,
  PATRON_SEE_PROFILE,
  PATRON_SEE_SUBSCRIPTION,
  PATRON_SUBSCRIBE,
  PATRON_SUBSCRIBE_BUSY,
  PATRON_THANKS,
  PATRON_THANKS_FAILED,
  PATRON_THANKS_HIDE,
  PATRON_THANKS_SEE,
  PATRON_THANKS_SHOW,
  PATRON_VOTE_NONE,
  PATRON_WAIVER,
  PATRON_WEAR_TITLE,
  type PatronPerk,
  type PatronPerkKey,
  type PatronWelcomeKind,
  patronClaimedLine,
  patronCosmeticCaption,
  patronPageKind,
  patronPlanChoices,
  patronStatus,
  patronThanksLine,
  patronTitleOf,
  patronTitleWorn,
  patronWelcome,
  playerName,
  pollScreen,
  voteRefusalLine,
} from "@leximon/view-model";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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

/** The icon of each perk, the same on the offer and on the subscriber's page. */
const PERK_ICONS: Readonly<
  Record<PatronPerkKey, { readonly icon: ToyIconName; readonly matter: "red" | "blue" }>
> = {
  cosmetic: { icon: "chest", matter: "red" },
  word: { icon: "scroll", matter: "blue" },
  editions: { icon: "ink", matter: "red" },
  cabinet: { icon: "candle", matter: "blue" },
  badge: { icon: "gilded", matter: "red" },
  thanks: { icon: "books", matter: "blue" },
  vote: { icon: "community", matter: "red" },
  discord: { icon: "discussion", matter: "blue" },
};

const WELCOME_ICONS: Readonly<Record<PatronWelcomeKind, ToyIconName>> = {
  mark: "gilded",
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
  const query = useSearchParams();
  const thanks = query.has(THANKS_QUERY);
  const fromPortal = query.has(PATRON_PORTAL_RETURN_QUERY);
  const [patron, setPatron] = useState<PatronResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(thanks);

  const load = useCallback(async (refresh = false) => {
    setFailed(false);
    try {
      const read = refresh ? await api.refreshPatron() : await api.fetchPatron();
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
    // Back from Stripe's portal: the subscription read again from Stripe, a cancellation shown
    // at once, then the address cleaned.
    if (fromPortal) {
      void load(true).then(() => router.replace("/mecene"));
      return;
    }
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
  }, [fromPortal, load, router, thanks]);

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
        <MemberView patron={patron} me={me} onClaimed={() => load()} />
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

/** The player wearing this month's cosmetics, to show what they look like on them. */
function monthLook(me: ProfileResponse | null, month: MonthCosmeticView | null) {
  const cosmetics = month?.cosmetics ?? [];
  const avatar = cosmetics.find((cosmetic) => cosmetic.kind === "avatar");
  const frame = cosmetics.find((cosmetic) => cosmetic.kind === "frame");
  return {
    avatar: avatar?.kind === "avatar" ? avatar.avatar : (me?.avatar ?? null),
    frame: frame?.kind === "frame" ? frame.frame : (me?.frame ?? null),
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
      <CrownedAvatar size={160} {...monthLook(me, patron.monthCosmetic)} />
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

/** Where the foot of the page sends the player back up: the plans and the button. */
const PLANS_ID = "formule";

function scrollToPlans() {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById(PLANS_ID)
    ?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
}

/** The two prices in a sentence, « 3,99 € par mois ou 29,99 € par an. » */
function Prices() {
  const [monthly, yearly] = patronPlanChoices(Date.now());
  return (
    <p className={styles.prices}>
      <strong>{monthly?.label}</strong> ou <strong>{yearly?.label}</strong>.
    </p>
  );
}

/** The foot of the offer, once every perk is read: the prices again and the way back to them. */
function Closing({ children }: { readonly children: ReactNode }) {
  return (
    <Leaf className={styles.closing}>
      <Prices />
      {children}
    </Leaf>
  );
}

/** A perk's icon, a gold tile with its lettrine. */
function PerkIcon({
  perk,
  small = false,
}: {
  readonly perk: PatronPerkKey;
  readonly small?: boolean;
}) {
  const { icon, matter } = PERK_ICONS[perk];
  return (
    <ToyBody
      matter="gold"
      shape="tile"
      className={small ? `${styles.tileIcon} ${styles.small}` : styles.tileIcon}
    >
      <Lettrine icon={icon} matter={matter} size={small ? 38 : 52} />
    </ToyBody>
  );
}

/**
 * What the subscription gives, a card for each perk in the order of the subscriber's page. The
 * month's cosmetics are drawn on theirs, worn by the player: the most tangible of the perks.
 */
function Perks({
  month,
  me,
}: {
  readonly month: MonthCosmeticView | null;
  readonly me: ProfileResponse | null;
}) {
  return (
    <section className={styles.perks} aria-labelledby="patron-perks">
      <h2 id="patron-perks" className={styles.sectionTitle} style={rise(3)}>
        <Lettering>{PATRON_PERKS_TITLE}</Lettering>
      </h2>
      <ul className={styles.perkGrid}>
        {PATRON_PERKS.map((perk, index) => (
          <li key={perk.key} data-perk={perk.key} style={rise(index + 4)}>
            <Leaf className={styles.perkCard}>
              <PerkIcon perk={perk.key} small />
              <div className={styles.perkText}>
                <h3 className={styles.perkTitle}>{perk.title}</h3>
                <p>
                  {perk.lead}
                  {perk.rest}
                </p>
              </div>
              {perk.key === "cosmetic" && month !== null && (
                <ul className={styles.showcase} aria-hidden>
                  {month.cosmetics.map((cosmetic) => {
                    const caption = patronCosmeticCaption(cosmetic);
                    return (
                      <li key={`${caption.kind}-${caption.name}`}>
                        <CosmeticLook cosmetic={cosmetic} me={me} />
                        <span className={styles.claimName}>
                          <small>{caption.kind}</small>
                          <strong>{caption.name}</strong>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Leaf>
          </li>
        ))}
      </ul>
    </section>
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
  const ask = () => {
    setAsked(true);
    api.recordInterest("patron_notify").catch(() => undefined);
  };
  const notify = asked ? (
    <p className={styles.done} role="status">
      {PATRON_NOTIFIED}
    </p>
  ) : (
    <MainAction label={PATRON_NOTIFY} onClick={ask} />
  );
  return (
    <main className={`${styles.page} ${styles.shop}`}>
      <div className={styles.shopTop}>
        <Hero kicker={PATRON_DOOR_KICKER} patron={patron} me={me} />
        <div className={styles.buyColumn} style={rise(1)}>
          <Leaf className={styles.buy}>
            <Prices />
            {notify}
          </Leaf>
        </div>
      </div>
      <Perks month={patron.monthCosmetic} me={me} />
      <Closing>{notify}</Closing>
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
    <main className={`${styles.page} ${styles.shop}`}>
      {confirming && (
        <p className={styles.notice} role="status">
          {PATRON_CONFIRMING}
        </p>
      )}
      <div className={styles.shopTop}>
        <div className={styles.heroColumn}>
          <Hero kicker={PATRON_KICKER} patron={patron} me={me} />
          {patron.foundingOffer && (
            <div className={styles.founding} style={rise(1)}>
              <ToyBody matter="red" shape="round" className={styles.seal}>
                <Icon name="crown" size={26} />
              </ToyBody>
              <p>{PATRON_FOUNDING_OFFER}</p>
            </div>
          )}
        </div>
        <div className={styles.buyColumn} id={PLANS_ID} style={rise(2)}>
          <Leaf className={styles.buy}>
            <h2 className={styles.buyTitle}>{PATRON_PLANS_TITLE}</h2>
            <fieldset className={styles.plans} aria-label="Formule">
              {patronPlanChoices(Date.now()).map((choice) => (
                <Toy
                  key={choice.plan}
                  matter={plan === choice.plan ? "gold" : "paper"}
                  shape="tile"
                  large
                  className={styles.plan}
                  aria-pressed={plan === choice.plan}
                  aria-label={
                    choice.note === null ? choice.label : `${choice.label}. ${choice.note}`
                  }
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
            {guest ? (
              <>
                <p className={styles.guest}>{PATRON_GUEST_NOTE}</p>
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
            <ul className={styles.reassure}>
              <li>
                <Icon name="check" size={18} />
                {PATRON_CANCEL_NOTE}
              </li>
              <li>
                <Icon name="lock" size={18} />
                {PATRON_PAYMENT_NOTE}
              </li>
            </ul>
          </Leaf>
        </div>
      </div>
      <Perks month={patron.monthCosmetic} me={me} />
      <Closing>
        <MainAction label={PATRON_CHOOSE_PLAN} onClick={scrollToPlans} />
      </Closing>
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
  const welcome = patronWelcome(patron);
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
          {welcome.map((step, index) => (
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
    </main>
  );
}

/** The subscriber's card, then each perk in the order of the offer, with its state and its action. */
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
      <div className={styles.bento}>
        <div className={styles.cell} data-perk="card" style={rise(0)}>
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
            {status.ending !== null && <p className={styles.ending}>{status.ending}</p>}
            {status.lines.map((line) => (
              <p key={line} className={styles.text}>
                {line}
              </p>
            ))}
            {status.warning !== null && <p className={styles.warning}>{status.warning}</p>}
            <div className={styles.cardActions}>
              <Toy
                matter={status.ending === null ? "paper" : "gold"}
                className={styles.secondary}
                disabled={busy}
                onClick={() => void manage()}
              >
                {busy ? PATRON_MANAGE_BUSY : status.manage}
              </Toy>
              {/* Stripe's portal lists the invoices: the same door, said for what it holds. */}
              <Toy
                matter="paper"
                className={styles.secondary}
                disabled={busy}
                onClick={() => void manage()}
              >
                {PATRON_INVOICES}
              </Toy>
            </div>
            {error !== null && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </Leaf>
        </div>
        {PATRON_PERKS.map((perk) => (
          <MemberPerk key={perk.key} perk={perk} patron={patron} me={me} onChanged={onClaimed} />
        ))}
      </div>
    </main>
  );
}

/** The perks given the most room in the grid: what is to claim and to find. */
const BIG_PERKS: ReadonlySet<PatronPerkKey> = new Set(["cosmetic", "word"]);

/** A tile of the subscriber's page: the perk's icon and title, where it stands, then what to do. */
function PerkBlock({
  perk,
  line,
  wide = false,
  children,
}: {
  readonly perk: PatronPerk;
  readonly line: string;
  /** Takes a row of its own, as an open vote does. */
  readonly wide?: boolean;
  readonly children?: ReactNode;
}) {
  const big = wide || BIG_PERKS.has(perk.key);
  return (
    <div
      className={styles.cell}
      data-perk={perk.key}
      data-wide={wide || undefined}
      style={rise(PATRON_PERKS.indexOf(perk) + 1)}
    >
      <Leaf className={big ? `${styles.tile} ${styles.big}` : styles.tile}>
        <div className={styles.tileHead}>
          <PerkIcon perk={perk.key} small={!big} />
          <Lettering className={styles.tileTitle}>{perk.title}</Lettering>
        </div>
        <p className={styles.text}>{line}</p>
        {children ? <div className={styles.tileActions}>{children}</div> : null}
      </Leaf>
    </div>
  );
}

function MemberPerk({
  perk,
  patron,
  me,
  onChanged,
}: {
  readonly perk: PatronPerk;
  readonly patron: PatronResponse;
  readonly me: ProfileResponse | null;
  readonly onChanged: () => Promise<unknown>;
}) {
  switch (perk.key) {
    case "cosmetic":
      return (
        <PerkBlock perk={perk} line={cosmeticPerkLine(patron, Date.now())}>
          {patron.claimable.length > 0 && (
            <section className={styles.claims} aria-label={PATRON_CLAIMABLE_TITLE}>
              {patron.claimable.map((item) => (
                <ClaimTile
                  key={item.month}
                  item={item}
                  me={me}
                  showMonth={patron.claimable.length > 1}
                  onClaimed={onChanged}
                />
              ))}
            </section>
          )}
        </PerkBlock>
      );
    case "word":
      return <Finds perk={perk} finds={patron.finds} />;
    case "editions":
      return <Editions perk={perk} />;
    case "cabinet":
      return (
        <PerkBlock perk={perk} line={PATRON_CABINET_LINE}>
          <PerkLink href="/album" label={PATRON_OPEN_ALBUM} />
        </PerkBlock>
      );
    case "badge":
      return <BadgePerk perk={perk} patron={patron} me={me} />;
    case "thanks":
      return <ThanksSetting perk={perk} patron={patron} onChanged={onChanged} />;
    case "vote":
      return <Poll perk={perk} patron={patron} onChanged={onChanged} />;
    case "discord":
      return <DiscordSetting perk={perk} patron={patron} onChanged={onChanged} />;
  }
}

function PerkLink({ href, label }: { readonly href: string; readonly label: string }) {
  return (
    <div className={styles.thanksActions}>
      <Link href={href} className={styles.thanksLink}>
        {label}
      </Link>
    </div>
  );
}

/** The title worn or not, with the button that puts it on, and the pinned cards it adds. */
function BadgePerk({
  perk,
  patron,
  me,
}: {
  readonly perk: PatronPerk;
  readonly patron: PatronResponse;
  readonly me: ProfileResponse | null;
}) {
  const actions = useProfileActions();
  const title = patronTitleOf(patron);
  const worn = me?.title === title;
  return (
    <PerkBlock perk={perk} line={badgePerkLine(title, worn)}>
      <div className={styles.thanksActions}>
        <Link href="/profil" className={styles.thanksLink}>
          {PATRON_SEE_PROFILE}
        </Link>
        {!worn && (
          <Toy
            matter="paper"
            className={styles.secondary}
            disabled={actions.busy}
            onClick={() => void actions.update({ title }, { success: patronTitleWorn(title) })}
          >
            {PATRON_WEAR_TITLE}
          </Toy>
        )}
      </div>
    </PerkBlock>
  );
}

/** The vote on the theme of a coming collection: open for a week, results once it closes. */
function Poll({
  perk,
  patron,
  onChanged,
}: {
  readonly perk: PatronPerk;
  readonly patron: PatronResponse;
  readonly onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const screen = pollScreen(patron, Date.now());
  const poll = patron.poll;
  if (screen === null || poll === null) return <PerkBlock perk={perk} line={PATRON_VOTE_NONE} />;

  const vote = async (theme: number) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.votePatronPoll(poll.id, theme);
      if (result.kind === "refused") setError(voteRefusalLine(result.reason));
      await onChanged();
    } catch {
      setError(PATRON_POLL_FAILED);
    }
    setBusy(false);
  };

  return (
    <PerkBlock perk={perk} line={screen.intro} wide>
      <ul className={styles.pollThemes}>
        {screen.themes.map((theme, index) => (
          <li key={theme.name} className={theme.winner ? styles.pollWinner : undefined}>
            <div className={styles.pollTheme}>
              <span className={styles.foundWord}>{theme.name}</span>
              <span className={styles.note}>{theme.description}</span>
            </div>
            <div className={styles.pollSide}>
              {theme.votes !== null && <span className={styles.pollVotes}>{theme.votes}</span>}
              {theme.chosen ? (
                <span className={styles.pollChosen}>{PATRON_POLL_CHOSEN}</span>
              ) : (
                screen.canVote && (
                  <Toy
                    matter="paper"
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => void vote(index)}
                  >
                    {PATRON_POLL_VOTE}
                  </Toy>
                )
              )}
            </div>
          </li>
        ))}
      </ul>
      {screen.note !== null && <p className={styles.note}>{screen.note}</p>}
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </PerkBlock>
  );
}

/** The patrons' Discord: the link, which brings the role and the reserved room, and its undoing. */
function DiscordSetting({
  perk,
  patron,
  onChanged,
}: {
  readonly perk: PatronPerk;
  readonly patron: PatronResponse;
  readonly onChanged: () => Promise<unknown>;
}) {
  const toast = useToast();
  const router = useRouter();
  const back = useSearchParams().get(DISCORD_RETURN_QUERY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const screen = discordScreen(patron);

  // Back from Discord's page: said once, then the address is cleaned.
  useEffect(() => {
    if (back === null) return;
    if (back === "linked") toast(PATRON_DISCORD_LINKED);
    else setError(PATRON_DISCORD_FAILED);
    router.replace("/mecene");
  }, [back, router, toast]);

  if (screen === null) return <PerkBlock perk={perk} line={PATRON_DISCORD_SOON} />;

  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.linkDiscord(false);
      if (result.kind === "redirect") {
        window.location.assign(result.url);
        return;
      }
      setError(PATRON_DISCORD_FAILED);
    } catch {
      setError(PATRON_DISCORD_FAILED);
    }
    setBusy(false);
  };

  const unlink = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.unlinkDiscord();
      await onChanged();
    } catch {
      setError(PATRON_DISCORD_FAILED);
    }
    setBusy(false);
  };

  return (
    <PerkBlock perk={perk} line={screen.line}>
      {screen.canLink && (
        <MainAction label={PATRON_DISCORD_LINK} disabled={busy} onClick={() => void link()} />
      )}
      {screen.canUnlink && (
        <div className={styles.thanksActions}>
          <Toy
            matter="paper"
            className={styles.secondary}
            disabled={busy}
            onClick={() => void unlink()}
          >
            {PATRON_DISCORD_UNLINK}
          </Toy>
        </div>
      )}
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </PerkBlock>
  );
}

/** The public page of thanks: whether the patron's pseudo is on it, and « Ne pas me citer ». */
function ThanksSetting({
  perk,
  patron,
  onChanged,
}: {
  readonly perk: PatronPerk;
  readonly patron: PatronResponse;
  readonly onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.setPatronThanks(!patron.thanksListed);
      await onChanged();
    } catch {
      setError(PATRON_THANKS_FAILED);
    }
    setBusy(false);
  };

  return (
    <PerkBlock perk={perk} line={patronThanksLine(patron)}>
      <div className={styles.thanksActions}>
        <Link href="/mecenes" className={styles.thanksLink}>
          {PATRON_THANKS_SEE}
        </Link>
        <Toy
          matter="paper"
          className={styles.secondary}
          disabled={busy}
          aria-pressed={!patron.thanksListed}
          onClick={() => void toggle()}
        >
          {patron.thanksListed ? PATRON_THANKS_HIDE : PATRON_THANKS_SHOW}
        </Toy>
      </div>
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </PerkBlock>
  );
}

/** The library editions owned, kept for life, and where to choose them. */
function Editions({ perk }: { readonly perk: PatronPerk }) {
  const mine = useShared(editions);
  if (mine === null) return null;
  return (
    <PerkBlock perk={perk} line={editionsOwnedLine(mine.owned)}>
      {mine.owned.length > 0 && <PerkLink href="/album" label={PATRON_OPEN_ALBUM} />}
    </PerkBlock>
  );
}

/** The words the patron may find, and those found, with where each stands. */
function Finds({ perk, finds }: { readonly perk: PatronPerk; readonly finds: PatronFindsView }) {
  const router = useRouter();
  return (
    <PerkBlock perk={perk} line={findsLeftLine(finds.left)}>
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
    </PerkBlock>
  );
}

/** A month's cosmetics waiting for their patron, each drawn as it will be worn. */
function ClaimTile({
  item,
  me,
  showMonth,
  onClaimed,
}: {
  readonly item: MonthCosmeticView;
  readonly me: ProfileResponse | null;
  readonly showMonth: boolean;
  readonly onClaimed: () => Promise<unknown>;
}) {
  const toast = useToast();
  const [claiming, setClaiming] = useState(false);

  const claim = async () => {
    setClaiming(true);
    try {
      const result = await api.claimPatronCosmetic(item.month);
      if (result.kind === "claimed") {
        toast(patronClaimedLine(result.cosmetics.length));
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
      {showMonth && <span className={styles.claimMonth}>{claimableMonth(item)}</span>}
      <ul className={styles.claimPieces}>
        {item.cosmetics.map((cosmetic) => {
          const caption = patronCosmeticCaption(cosmetic);
          return (
            <li key={`${caption.kind}-${caption.name}`} className={styles.claimPiece}>
              <span className={styles.claimLook} aria-hidden>
                <CosmeticLook cosmetic={cosmetic} me={me} />
              </span>
              <span className={styles.claimName}>
                <small>{caption.kind}</small>
                <strong>{caption.name}</strong>
              </span>
            </li>
          );
        })}
      </ul>
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

/** A frame around the player's own engraving, an engraving bare, a title as a crown. */
function CosmeticLook({
  cosmetic,
  me,
}: {
  readonly cosmetic: PatronCosmeticView;
  readonly me: ProfileResponse | null;
}) {
  switch (cosmetic.kind) {
    case "frame":
      return <Avatar avatar={me?.avatar ?? null} frame={cosmetic.frame} size={CLAIM_LOOK} />;
    case "avatar":
      return <Avatar avatar={cosmetic.avatar} frame="simple" size={CLAIM_LOOK} />;
    case "title":
      return <Lettrine icon="gilded" matter="gold" size={CLAIM_LOOK} />;
  }
}

const CLAIM_LOOK = 76;
