"use client";

import {
  APPEARANCE_RESET,
  APPEARANCE_SAVE,
  APPEARANCE_SAVE_BUSY,
  APPEARANCE_SAVED,
  APPEARANCE_UNSAVED,
  type Appearance,
  ATELIER_NEW_TAB,
  ATELIER_NEW_TAB_KEY,
  ATELIER_TABS,
  type AtelierItem,
  type AtelierTab,
  appearanceBlock,
  appearanceBuyAction,
  appearanceChanges,
  atelierItems,
  type CosmeticTab,
  chosenIn,
  cosmeticStateLabel,
  draftItems,
  isAppearanceChanged,
  playerName,
  savedAppearance,
  withChoice,
} from "@leximon/view-model";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { useSeenFlag } from "@/lib/seen-flag";
import { useNow } from "@/lib/use-now";
import { profile } from "@/player/player";
import { useSharedFailed } from "@/player/resource";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { NewTag } from "@/ui/new-tag";
import { Bone } from "@/ui/skeleton";
import ui from "@/ui/ui.module.css";
import appearance from "./appearance.module.css";
import { AppearancePreview } from "./appearance-preview";
import { BannerPanel, BuyBanner } from "./banner-panel";
import { LockSeal } from "./lock-seal";
import styles from "./profile.module.css";
import { useProfileActions } from "./use-profile-actions";

const STATE_CLASS = {
  worn: styles.worn,
  owned: styles.owned,
  in_coffret: styles.inCoffret,
  locked: styles.closed,
} as const;

/** The first row of the shelf, while the profile arrives. */
const WAITING_ITEMS = [1, 2, 3, 4, 5];

/**
 * The atelier: avatars, frames, titles and banners chosen on a draft, shown at once on the
 * profile card beside them, worn only once saved. A piece not yet owned may be tried on.
 */
export function AtelierScreen() {
  const actions = useProfileActions();
  const me = actions.profile;
  const failed = useSharedFailed(profile);
  const now = useNow(60_000);
  const [tab, setTab] = useState<AtelierTab>("avatars");
  const [newTabFresh, newTabSeen] = useSeenFlag(ATELIER_NEW_TAB_KEY);
  const [draft, setDraft] = useState<Appearance | null>(null);
  const [buying, setBuying] = useState(false);

  const look = me === null ? null : (draft ?? savedAppearance(me));
  const ready = me !== null && look !== null && now !== 0;
  const changed = ready && isAppearanceChanged(me, look);
  const block = ready && changed ? appearanceBlock(me, look, now) : null;

  const save = async () => {
    if (me === null || look === null) return;
    const problem = await actions.update(appearanceChanges(me, look), {
      success: APPEARANCE_SAVED,
    });
    if (problem === null) setDraft(null);
  };

  const items =
    !ready || tab === "banners"
      ? []
      : draftItems(atelierItems(tab, me, now), (item) => item.id === chosenIn(tab, look));

  return (
    <main className={`${styles.page} ${changed ? appearance.pageWithBar : ""}`}>
      <Link href="/profil" className={styles.back}>
        <Icon name="back" size={18} />
        Retour au profil
      </Link>
      <h1 className={`${ui.display} ${styles.title}`}>Apparence</h1>
      <div className={appearance.layout}>
        <aside className={appearance.side}>
          {me !== null && look !== null ? (
            <AppearancePreview
              look={look}
              name={me.member ? playerName({ code: me.playerCode, pseudo: me.pseudo }) : "Invité"}
              level={me.level}
              trying={block !== null}
            />
          ) : (
            <Bone className={appearance.previewBone} />
          )}
        </aside>
        <section className={appearance.shelf}>
          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Avatars, cadres, titres et bannières"
          >
            {ATELIER_TABS.map((entry) => (
              <button
                key={entry.tab}
                type="button"
                role="tab"
                id={`tab-${entry.tab}`}
                aria-selected={tab === entry.tab}
                aria-controls="atelier-items"
                className={ui.chip}
                onClick={() => {
                  setTab(entry.tab);
                  if (entry.tab === ATELIER_NEW_TAB) newTabSeen();
                }}
              >
                {entry.label}
                {newTabFresh && entry.tab === ATELIER_NEW_TAB && <NewTag />}
              </button>
            ))}
          </div>
          {me === null && failed ? (
            <LoadFailed onRetry={() => profile.ensure()} />
          ) : tab === "banners" && ready ? (
            <BannerPanel me={me} now={now} look={look} onLook={setDraft} />
          ) : (
            <ul
              id="atelier-items"
              className={styles.items}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              aria-busy={me === null}
            >
              {me === null &&
                WAITING_ITEMS.map((slot) => (
                  <li key={slot} aria-hidden="true">
                    <Bone className={styles.itemBone} />
                  </li>
                ))}
              {look !== null &&
                tab !== "banners" &&
                items.map((item) => {
                  const closed = item.state === "locked" || item.state === "in_coffret";
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={[
                          styles.item,
                          closed ? styles.itemLocked : "",
                          item.chosen && closed ? styles.itemTrying : "",
                        ].join(" ")}
                        aria-pressed={item.chosen}
                        onClick={() => setDraft(withChoice(look, tab, item.id))}
                      >
                        <span className={styles.itemArt}>
                          <Preview tab={tab} item={item} wornAvatar={look.avatar} />
                          {closed && <LockSeal />}
                        </span>
                        {tab !== "titles" && <span className={styles.itemName}>{item.name}</span>}
                        <span className={`${styles.itemState} ${STATE_CLASS[item.state]}`}>
                          {item.state === "worn" && <Icon name="check" size={14} />}{" "}
                          {cosmeticStateLabel(item)}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      </div>
      {changed && (
        <div className={appearance.bar} role="status">
          <p className={appearance.barText}>{block?.text ?? APPEARANCE_UNSAVED}</p>
          <div className={appearance.barButtons}>
            <Button variant="ghost" small onClick={() => setDraft(null)}>
              {APPEARANCE_RESET}
            </Button>
            {block?.kind === "for_sale" ? (
              <Button small onClick={() => setBuying(true)}>
                {appearanceBuyAction(block)}
              </Button>
            ) : (
              <Button small disabled={actions.busy || block !== null} onClick={() => void save()}>
                {actions.busy ? APPEARANCE_SAVE_BUSY : APPEARANCE_SAVE}
              </Button>
            )}
          </div>
        </div>
      )}
      <Dialog
        open={buying && block?.kind === "for_sale"}
        title={block?.kind === "for_sale" ? block.name : ""}
        onClose={() => setBuying(false)}
        variant="center"
      >
        {buying && block?.kind === "for_sale" && look !== null && (
          <BuyBanner
            motif={block.motif}
            name={block.name}
            price={block.price}
            tint={look.bannerTint}
            onDone={(bought) => {
              setBuying(false);
              // Bought: the rest of the draft is worn with it, as one save.
              if (bought) void save();
            }}
          />
        )}
      </Dialog>
    </main>
  );
}

function Preview({
  tab,
  item,
  wornAvatar,
}: {
  readonly tab: CosmeticTab;
  readonly item: AtelierItem;
  readonly wornAvatar: string | null;
}) {
  if (tab === "titles") {
    return (
      <span className={styles.titlePreview}>
        <span className={styles.titlePill}>{item.name}</span>
      </span>
    );
  }
  // A frame is tried on the avatar worn; an avatar in the simple frame.
  return tab === "avatars" ? (
    <Avatar avatar={item.id} frame="simple" size={84} />
  ) : (
    <Avatar avatar={wornAvatar} frame={item.id} size={84} />
  );
}
