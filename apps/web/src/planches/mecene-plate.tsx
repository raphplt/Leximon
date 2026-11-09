"use client";

import type { PatronResponse } from "@leximon/contract";
import type { ToyIconName } from "@leximon/tokens";
import {
  claimableLabel,
  monthCosmeticLine,
  PATRON_CANCEL_NOTE,
  PATRON_CLAIM,
  PATRON_MANAGE,
  PATRON_PERKS,
  PATRON_SUBSCRIBE,
  PATRON_THANKS,
  PATRON_WAIVER,
  type PatronPlanChoice,
  PLAIN_BANNER,
  patronPlanChoices,
  patronStatus,
} from "@leximon/view-model";
import { type CSSProperties, useEffect, useState } from "react";
import account from "@/account/account-screen.module.css";
import { Avatar } from "@/components/avatar";
import { PatronBadge } from "@/components/patron-badge";
import { MainAction } from "@/library/play-pieces";
import { Rays } from "@/library/reveal-pieces";
import { ProfileHeader } from "@/profile/profile-view";
import { Icon } from "@/ui/icon";
import { ParticleStage } from "@/ui/stage";
import { Kicker, Leaf, Lettering, Lettrine, Toy, ToyBody } from "@/ui/toy";
import styles from "./mecene-plate.module.css";

/**
 * A plate of three ways to draw the patron page, on a made-up player: the owner picks one before
 * the screen is rebuilt. Texts, prices and rules are the real ones.
 */

type Moment = "offer" | "back" | "member";

const MOMENTS: readonly { readonly id: Moment; readonly label: string }[] = [
  { id: "offer", label: "L'offre" },
  { id: "back", label: "Retour du paiement" },
  { id: "member", label: "Mécène, un cosmétique à réclamer" },
];

type Direction = "showcase" | "charter" | "profile";

const DIRECTIONS: readonly { readonly id: Direction; readonly label: string }[] = [
  { id: "showcase", label: "A. La vitrine" },
  { id: "charter", label: "B. La charte" },
  { id: "profile", label: "C. Ton profil" },
];

const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const MONTH = { month: "2026-11", cosmetic: { kind: "frame", frame: "wax" } } as const;

const ME = { pseudo: "Raph", avatar: "cuistre", frame: "simple", level: 16, code: "K7QP2MXA" };

const OFFER: PatronResponse = {
  sales: "open",
  minor: false,
  mark: null,
  monthCosmetic: MONTH,
  claimable: [],
  canBuy: true,
  founder: false,
  foundingOffer: true,
  finds: { left: 0, words: [] },
  thanksListed: true,
  thanksWaiting: null,
  poll: null,
  discord: { available: false, username: null },
  subscription: null,
};

const MEMBER: PatronResponse = {
  ...OFFER,
  mark: "patron",
  claimable: [MONTH],
  canBuy: false,
  foundingOffer: false,
  subscription: {
    standing: "patron",
    plan: "monthly",
    currentPeriodEnd: "2026-12-14T08:00:00.000Z",
    cancelAt: null,
    paymentFailing: false,
    since: "2026-10-14T08:00:00.000Z",
  },
};

/** The icon of each benefit, in the order of the list. */
const BENEFIT_ICONS: readonly ToyIconName[] = ["chest", "scroll", "gilded"];

/** Each leaf rises in turn when the screen appears, as on Jouer. */
const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

export function MecenePlate() {
  const [moment, setMoment] = useState<Moment>("offer");
  const [direction, setDirection] = useState<Direction>("showcase");
  return (
    <main className={styles.page}>
      <ParticleStage dust>
        <nav className={styles.controls} aria-label="Direction de la planche">
          <span className={styles.controlsLabel}>Planche Mécène</span>
          {DIRECTIONS.map((entry) => (
            <Toy
              key={entry.id}
              matter={entry.id === direction ? "gold" : "paper"}
              className={styles.control}
              aria-pressed={entry.id === direction}
              onClick={() => setDirection(entry.id)}
            >
              {entry.label}
            </Toy>
          ))}
        </nav>
        <nav className={styles.controls} aria-label="Moment de la planche">
          {MOMENTS.map((entry) => (
            <Toy
              key={entry.id}
              matter={entry.id === moment ? "gold" : "paper"}
              className={styles.control}
              aria-pressed={entry.id === moment}
              onClick={() => setMoment(entry.id)}
            >
              {entry.label}
            </Toy>
          ))}
        </nav>
        <div className={styles.screen} key={`${direction}-${moment}`}>
          {moment === "back" ? (
            <Thanks direction={direction} />
          ) : direction === "showcase" ? (
            <Showcase member={moment === "member"} />
          ) : direction === "charter" ? (
            <Charter member={moment === "member"} />
          ) : (
            <Profile member={moment === "member"} />
          )}
        </div>
      </ParticleStage>
    </main>
  );
}

// --- Shared pieces ---------------------------------------------------------------------------

/** The two plans as toys to press, the yearly one with its ribbon. */
function Plans({ big = false }: { readonly big?: boolean }) {
  const [plan, setPlan] = useState<PatronPlanChoice["plan"]>("yearly");
  return (
    <div className={styles.plans} data-big={big}>
      {patronPlanChoices(NOW).map((choice) => (
        <Toy
          key={choice.plan}
          matter={plan === choice.plan ? "gold" : "paper"}
          shape="tile"
          large={big}
          className={styles.plan}
          aria-pressed={plan === choice.plan}
          onClick={() => setPlan(choice.plan)}
        >
          {choice.note !== null && (
            <ToyBody matter="red" shape="tag" className={styles.ribbon}>
              <Lettering>{choice.note.replace(/^Soit /, "").replace(/\.$/, "")}</Lettering>
            </ToyBody>
          )}
          <Lettering className={styles.planPrice}>{choice.label.split(" par ")[0]}</Lettering>
          <span className={styles.planPeriod}>
            {choice.plan === "monthly" ? "par mois" : "par an"}
          </span>
        </Toy>
      ))}
    </div>
  );
}

/** The waiver and the button: the same under every direction. */
function Checkout() {
  const [waived, setWaived] = useState(false);
  return (
    <div className={styles.checkout}>
      <p className={styles.note}>{PATRON_CANCEL_NOTE}</p>
      <label className={`${account.check} ${styles.check}`}>
        <input
          type="checkbox"
          checked={waived}
          onChange={(event) => setWaived(event.target.checked)}
        />
        <span>{PATRON_WAIVER}</span>
      </label>
      <MainAction label={PATRON_SUBSCRIBE} disabled={!waived} />
    </div>
  );
}

/** The player's avatar in the month's frame, crowned. */
function CrownedAvatar({ size, frame }: { readonly size: number; readonly frame: string }) {
  return (
    <span className={styles.crowned} style={{ "--size": `${size}px` } as CSSProperties}>
      <span className={styles.crown}>
        <Icon name="crown" size={Math.round(size / 3.2)} />
      </span>
      <Avatar avatar={ME.avatar} frame={frame} size={size} />
    </span>
  );
}

function Status() {
  const status = patronStatus(MEMBER, NOW);
  if (status === null) return null;
  return (
    <>
      <Lettering className={styles.statusTitle}>{status.headline}</Lettering>
      {status.lines.map((line) => (
        <p key={line} className={styles.text}>
          {line}
        </p>
      ))}
    </>
  );
}

/** A month's cosmetic waiting for its patron, as a coffret to open. */
function ClaimTile() {
  return (
    <div className={styles.claim}>
      <span className={styles.claimChest}>
        <ToyBody matter="gold" shape="tile" className={styles.claimTile}>
          <Lettrine icon="chest" matter="red" size={56} />
        </ToyBody>
      </span>
      <span className={styles.claimText}>
        <Kicker>À réclamer</Kicker>
        <strong>{claimableLabel(MONTH)}</strong>
      </span>
      <Toy matter="gold" className={styles.claimButton}>
        <Lettering>{PATRON_CLAIM}</Lettering>
      </Toy>
    </div>
  );
}

function ManageButton() {
  return (
    <Toy matter="paper" className={styles.manage}>
      {PATRON_MANAGE}
    </Toy>
  );
}

// --- A. The showcase: what a patron receives, laid out like a shop window -------------------

function Showcase({ member }: { readonly member: boolean }) {
  if (member) {
    return (
      <div className={styles.showcase}>
        <Leaf className={styles.memberCard}>
          <div className={styles.memberHead}>
            <CrownedAvatar size={110} frame="wax" />
            <div className={styles.memberText}>
              <Kicker>Carte de mécène</Kicker>
              <h1 className={styles.memberName}>{ME.pseudo}</h1>
              <PatronBadge mark="patron" />
            </div>
          </div>
          <Status />
          <ManageButton />
        </Leaf>
        <ClaimTile />
      </div>
    );
  }
  return (
    <div className={styles.showcase}>
      <header className={styles.showcaseHero} style={rise(0)}>
        <CrownedAvatar size={150} frame={MONTH.cosmetic.frame} />
        <div className={styles.showcaseTitle}>
          <Kicker>Abonnement</Kicker>
          <Lettering className={styles.display}>Devenir mécène</Lettering>
          <p className={styles.lead}>{monthCosmeticLine(MONTH)}</p>
        </div>
      </header>
      {OFFER.foundingOffer && (
        <div className={styles.founding} style={rise(1)}>
          <ToyBody matter="red" shape="round" className={styles.seal}>
            <Icon name="crown" size={26} />
          </ToyBody>
          <p>
            Abonne-toi avant la fin du mois pour devenir Mécène fondateur et garder ce badge à vie.
          </p>
        </div>
      )}
      <div className={styles.benefits} style={rise(2)}>
        {PATRON_PERKS.map((perk, index) => (
          <Leaf key={perk.key} className={styles.benefit}>
            <ToyBody matter="gold" shape="tile" className={styles.benefitIcon}>
              <Lettrine
                icon={BENEFIT_ICONS[index] ?? "chest"}
                matter={index === 1 ? "blue" : "red"}
                size={52}
              />
            </ToyBody>
            <p>
              <strong>{perk.lead}</strong>
              {perk.rest}
            </p>
          </Leaf>
        ))}
      </div>
      <Leaf className={styles.buy}>
        <Plans big />
        <Checkout />
      </Leaf>
    </div>
  );
}

// --- B. The charter: one sealed sheet, the old book the game is made of ----------------------

function Charter({ member }: { readonly member: boolean }) {
  return (
    <Leaf className={styles.charter}>
      <ToyBody matter={member ? "gold" : "red"} shape="round" className={styles.charterSeal}>
        <Icon name="crown" size={40} />
      </ToyBody>
      <Kicker>Charte du mécène</Kicker>
      <h1 className={styles.charterTitle}>
        {member ? `${ME.pseudo}, mécène de Leximon` : "Devenir mécène"}
      </h1>
      {member ? (
        <>
          <Status />
          <ClaimTile />
          <ManageButton />
        </>
      ) : (
        <>
          <p className={styles.lead}>{monthCosmeticLine(MONTH)}</p>
          <ol className={styles.articles}>
            {PATRON_PERKS.map((perk, index) => (
              <li key={perk.key}>
                <span className={styles.articleNumber}>{index + 1}</span>
                {perk.lead}
                {perk.rest}
              </li>
            ))}
          </ol>
          <Plans />
          <Checkout />
        </>
      )}
    </Leaf>
  );
}

// --- C. Your profile: the offer shown on the player's own profile, as others will see it -----

function Profile({ member }: { readonly member: boolean }) {
  return (
    <div className={styles.profile}>
      <section className={styles.preview}>
        <Kicker>
          {member ? "Ton profil" : "Ton profil de mécène, tel que les autres le verront"}
        </Kicker>
        <div className={styles.previewFrame}>
          <ProfileHeader
            face={{
              name: ME.pseudo,
              avatar: ME.avatar,
              frame: MONTH.cosmetic.frame,
              title: "Mécène",
              level: ME.level,
              code: ME.code,
              memberSince: "2026-03-02T10:00:00.000Z",
              clan: null,
              banner: { ...PLAIN_BANNER, tint: "bordeaux" },
              patron: "patron",
            }}
          />
        </div>
        <ul className={styles.callouts}>
          <li>
            <Icon name="crown" size={18} /> Le badge à côté de ton code joueur
          </li>
          <li>
            <Icon name="palette" size={18} /> Le cadre du mois, gardé à vie
          </li>
          <li>
            <Icon name="plume" size={18} /> Le titre Mécène
          </li>
        </ul>
      </section>
      <Leaf className={styles.side}>
        {member ? (
          <>
            <Status />
            <ClaimTile />
            <ManageButton />
          </>
        ) : (
          <>
            <Lettering className={styles.sideTitle}>Devenir mécène</Lettering>
            <ul className={styles.ticks}>
              {PATRON_PERKS.map((perk) => (
                <li key={perk.key}>
                  {perk.lead}
                  {perk.rest}
                </li>
              ))}
            </ul>
            <Plans />
            <Checkout />
          </>
        )}
      </Leaf>
    </div>
  );
}

// --- Back from the payment: a reward, the same moment under every direction -----------------

/** What the subscription gives now, and what comes each month and each quarter. */
const TIMELINE: readonly {
  readonly when: string;
  readonly what: string;
  readonly icon: ToyIconName;
}[] = [
  { when: "Aujourd'hui", what: "Le titre, le badge et le cosmétique du mois", icon: "gilded" },
  { when: "Chaque mois", what: "Un nouveau cosmétique, gardé à vie", icon: "chest" },
  { when: "Chaque trimestre", what: "Un mot à dénicher pour le jeu", icon: "scroll" },
];

function Thanks({ direction }: { readonly direction: Direction }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), 150);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={styles.thanks} data-direction={direction}>
      <div className={styles.thanksStage}>
        <Rays size={420} color="var(--lx-toy-gold-top)" shown={shown} />
        <span className={styles.thanksAvatar}>
          <span className={styles.fallingCrown}>
            <Icon name="crown" size={52} />
          </span>
          <Avatar avatar={ME.avatar} frame={ME.frame} size={150} />
        </span>
      </div>
      <Lettering className={styles.display}>{PATRON_THANKS}</Lettering>
      <span className={styles.thanksBadge}>
        <PatronBadge mark="patron" />
      </span>
      <ol className={styles.timeline}>
        {TIMELINE.map((step, index) => (
          <li key={step.when} className={styles.step} style={rise(index + 1)}>
            <ToyBody
              matter={index === 0 ? "gold" : "paper"}
              shape="tile"
              className={styles.stepIcon}
            >
              <Lettrine
                icon={step.icon}
                matter={index === 0 ? "red" : "blue"}
                size={44}
                locked={index > 0}
              />
            </ToyBody>
            <span className={styles.when}>{step.when}</span>
            <strong>{step.what}</strong>
          </li>
        ))}
      </ol>
      <div className={styles.thanksActions}>
        <MainAction label="Porter mon titre" />
        <Toy matter="paper" className={styles.manage}>
          Voir mon profil
        </Toy>
      </div>
    </div>
  );
}
