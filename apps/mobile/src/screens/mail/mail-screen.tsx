import type { MailKind, MailLetter } from "@leximon/contract";
import type { IconName } from "@leximon/tokens";
import {
  capitalize,
  claimableMailTitle,
  coffretsMailTitle,
  letterView,
  MAIL_EMPTY,
  MAIL_NEWS,
  MAIL_OLDER,
  MAIL_TODO,
  REFERRAL_CLAIMED,
  referralRewardTitle,
  SLIPPING_AWAY,
  slippingDetail,
  tierName,
  welcomeMailTitle,
  welcomeToday,
} from "@leximon/view-model";
import { router } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { claimGoal } from "@/clan/claim";
import { openCoffret } from "@/levels/coffret";
import { openWelcome } from "@/levels/welcome";
import { useNow } from "@/player/shared";
import { mailbox, wallet } from "@/player/state";
import { usePlayerView } from "@/player/use-player-view";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Icon } from "@/ui/icon";
import { Page, Paragraph } from "@/ui/page";
import { TextButton } from "@/ui/text-button";
import { toast } from "@/ui/toast";
import { toyFace } from "@/ui/toy";

const LETTER_ICONS: Readonly<Record<MailKind, IconName>> = {
  offer_received: "echange",
  offer_completed: "echange",
  offer_declined: "echange",
  clan_mention: "chat",
  clan_request: "clan",
  friend_request: "amis",
  friend_accepted: "amis",
  referral_arrived: "amis",
  referral_qualified: "sachet",
  friend_reaction: "amis",
};

interface Row {
  readonly key: string;
  readonly icon: IconName;
  readonly title: ReactNode;
  readonly detail: string;
  readonly when?: string;
  readonly fresh?: boolean;
  readonly onPress: () => void;
}

/** Where a letter leads: a tab of the game, or the friends page in place of the mail. */
function goTo(href: string): void {
  switch (href) {
    case "/amis":
      router.replace("/amis");
      return;
    case "/echanges":
      router.dismissTo("/echanges");
      return;
    case "/clan":
      router.dismissTo("/clan");
      return;
    default:
      router.dismissTo("/");
  }
}

function claimReferral(refereeCode: string): void {
  api
    .claimReferral(refereeCode)
    .then((result) => {
      if (result.kind === "refused" && result.reason === "reserve_full") {
        toast("Ta réserve est pleine. Ouvre un sachet d'abord.");
        return;
      }
      if (result.kind === "claimed") {
        wallet.publish(result.wallet);
        toast(REFERRAL_CLAIMED);
      }
      const current = mailbox.current();
      if (current !== null) {
        mailbox.publish({
          ...current,
          referralRewards: current.referralRewards.filter((r) => r.refereeCode !== refereeCode),
        });
      }
    })
    .catch(() => toast("Ça n'a pas marché. Réessaie."));
}

/**
 * The mail: what waits to be done, read from the game's state (coffrets, goal boosters, a word
 * slipping away), then the news the queue wrote (offers, mentions, requests). Opening it marks
 * the letters read; those new to this visit stay highlighted.
 */
export function MailScreen() {
  const view = usePlayerView();
  const now = useNow(60_000);
  const box = view.mailbox;
  const [fresh, setFresh] = useState<ReadonlySet<number>>(new Set());
  const [older, setOlder] = useState<{ letters: MailLetter[]; hasMore: boolean } | null>(null);
  const [catalog, setCatalog] = useState(catalogInHand);

  useEffect(() => {
    mailbox.refresh();
    loadCatalog().then(setCatalog, () => undefined);
  }, []);

  // Marks what the mail shows as read, once per new letter.
  useEffect(() => {
    if (box === null) return;
    const unread = box.letters.filter((letter) => !letter.read).map((letter) => letter.id);
    const top = box.letters[0]?.id;
    if (unread.length === 0 || top === undefined) return;
    setFresh((current) => new Set([...current, ...unread]));
    api
      .markMailRead(top)
      .then((left) => {
        const current = mailbox.current();
        if (current === null) return;
        mailbox.publish({
          ...current,
          unread: left,
          letters: current.letters.map((letter) =>
            letter.id <= top ? { ...letter, read: true } : letter,
          ),
        });
      })
      .catch(() => {
        // Still unread: marked the next time the mail opens.
      });
  }, [box]);

  const todo: Row[] = [];
  const welcomeDay = welcomeToday(view.welcome);
  if (welcomeDay !== null) {
    todo.push({
      key: "welcome",
      icon: "coffret",
      title: welcomeMailTitle(welcomeDay.day),
      detail: capitalize(welcomeDay.phrase),
      onPress: () => openWelcome(),
    });
  }
  if (view.coffrets.length > 0) {
    todo.push({
      key: "coffrets",
      icon: "coffret",
      title: coffretsMailTitle(view.coffrets),
      detail: "Niveaux",
      onPress: () => openCoffret(),
    });
  }
  for (const reward of box?.referralRewards ?? []) {
    todo.push({
      key: `referral-${reward.refereeCode}`,
      icon: "sachet",
      title: referralRewardTitle(reward),
      detail: "Lien d'ami",
      onPress: () => claimReferral(reward.refereeCode),
    });
  }
  if (view.claimable.length > 0) {
    todo.push({
      key: "goal",
      icon: "clan",
      title: claimableMailTitle(view.claimable.length),
      detail: `Objectif de clan · ${view.claimable.map((c) => tierName(c.tier)).join(", ")}`,
      onPress: () => {
        for (const goal of view.claimable) void claimGoal(goal);
      },
    });
  }
  const slipping = box?.slipping ?? null;
  const slippingCard = slipping === null ? undefined : catalog?.cardsById.get(slipping.cardId);
  if (slipping !== null && slippingCard !== undefined) {
    todo.push({
      key: "slipping",
      icon: "defi",
      title: (
        <>
          <Text style={styles.word}>{capitalize(slippingCard.word)}</Text>
          {SLIPPING_AWAY.after}
        </>
      ),
      detail: slippingDetail(slipping.others),
      onPress: () => router.dismissTo({ pathname: "/defis", params: { mot: slipping.cardId } }),
    });
  }

  const letters = [...(box?.letters ?? []), ...(older?.letters ?? [])];
  const news: Row[] = letters.map((letter) => {
    const shown = letterView(letter, now);
    const { target } = shown;
    return {
      key: `letter-${letter.id}`,
      icon: LETTER_ICONS[letter.kind],
      title: shown.title,
      detail: shown.detail,
      when: shown.when,
      fresh: !letter.read || fresh.has(letter.id),
      // The clan's discussion opens on its page.
      onPress: () => goTo(target.kind === "screen" ? target.href : "/clan"),
    };
  });
  const hasMore = older === null ? (box?.hasMore ?? false) : older.hasMore;

  const loadOlder = async () => {
    const last = letters.at(-1);
    if (last === undefined) return;
    const page = await api.fetchMail(last.id).catch(() => null);
    if (page === null) return;
    setOlder((current) => ({
      letters: [...(current?.letters ?? []), ...page.letters],
      hasMore: page.hasMore,
    }));
  };

  const empty = todo.length === 0 && news.length === 0;

  return (
    <Page title="Courrier">
      {empty ? (
        <Paragraph muted>{box === null ? "Un instant…" : MAIL_EMPTY}</Paragraph>
      ) : (
        <>
          {todo.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.heading}>{MAIL_TODO.toUpperCase()}</Text>
              {todo.map((row) => (
                <RowItem key={row.key} row={row} />
              ))}
            </View>
          )}
          {news.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.heading}>{MAIL_NEWS.toUpperCase()}</Text>
              {news.map((row) => (
                <RowItem key={row.key} row={row} />
              ))}
              {hasMore && <TextButton label={MAIL_OLDER} onPress={() => void loadOlder()} />}
            </View>
          )}
        </>
      )}
    </Page>
  );
}

function RowItem({ row }: { readonly row: Row }) {
  const fresh = row.fresh === true;
  return (
    <Pressable
      onPress={row.onPress}
      accessibilityRole="button"
      accessibilityHint={fresh ? "Nouveau" : undefined}
      style={({ pressed }) => [
        styles.row,
        fresh && styles.fresh,
        styles.slip,
        toyFace(fresh ? "gold" : "paper"),
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icon}>
        <Icon name={row.icon} size={20} color={fresh ? ink.rubric : ink.pageInk} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{row.title}</Text>
        <Text style={styles.detail}>{row.detail}</Text>
      </View>
      {row.when !== undefined && <Text style={styles.when}>{row.when}</Text>}
    </Pressable>
  );
}

/** Each letter is a slip of paper, a new one is gold. */
const ink = paperColors;

const styles = StyleSheet.create({
  section: { gap: space.s4 },
  heading: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: colors.pageInkMuted,
    marginBottom: space.s1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    minHeight: 60,
    paddingHorizontal: space.s7,
    paddingVertical: space.s5,
    borderRadius: radii.xxl,
    backgroundColor: ink.panel,
  },
  fresh: { borderWidth: 1, borderColor: alpha(ink.gilt, 0.45) },
  slip: { marginBottom: 3 },
  pressed: { opacity: 0.7 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: ink.well,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: space.s1 },
  title: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 20,
    color: ink.pageInk,
  },
  word: { fontFamily: fonts.text.italic, fontSize: fontSizes.lead },
  detail: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  when: { fontFamily: fonts.ui.medium, fontSize: fontSizes.caption, color: ink.pageInkFaint },
});
