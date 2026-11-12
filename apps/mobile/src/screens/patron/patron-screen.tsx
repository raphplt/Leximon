import type {
  MonthCosmeticView,
  PatronCosmeticView,
  PatronFindsView,
  PatronResponse,
} from "@leximon/contract";
import { mixHex, type ToyIconName, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  badgePerkLine,
  claimableMonth,
  cosmeticPerkLine,
  discordScreen,
  editionsOwnedLine,
  findStateLine,
  findsLeftLine,
  PATRON_CABINET_LINE,
  PATRON_CARD_KICKER,
  PATRON_CLAIM,
  PATRON_CLAIM_BUSY,
  PATRON_DISCORD_FAILED,
  PATRON_DISCORD_LINK,
  PATRON_DISCORD_LINKED,
  PATRON_DISCORD_SOON,
  PATRON_DISCORD_UNLINK,
  PATRON_FIND_ACTION,
  PATRON_FINDS_RULE,
  PATRON_LOAD_FAILED,
  PATRON_MANAGED_ON_WEB,
  PATRON_MEMBER_TITLE,
  PATRON_OPEN_ALBUM,
  PATRON_PERKS,
  PATRON_POLL_CHOSEN,
  PATRON_POLL_FAILED,
  PATRON_POLL_VOTE,
  PATRON_SEE_PROFILE,
  PATRON_THANKS_FAILED,
  PATRON_THANKS_HIDE,
  PATRON_THANKS_SEE,
  PATRON_THANKS_SHOW,
  PATRON_VOTE_NONE,
  PATRON_WEAR_TITLE,
  type PatronPerk,
  type PatronPerkKey,
  patronClaimedLine,
  patronCosmeticCaption,
  patronStatus,
  patronThanksLine,
  patronTitleOf,
  patronTitleWorn,
  playerName,
  pollScreen,
  voteRefusalLine,
} from "@leximon/view-model";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { linkDiscord } from "@/api/discord-link";
import { MainAction } from "@/library/play-pieces";
import { useShared } from "@/player/shared";
import { editions, profile } from "@/player/state";
import { useProfileActions } from "@/profile/profile-actions";
import { colors, fontSizes, fonts, paperColors, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { useInk } from "@/ui/ink";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { PatronBadge } from "@/ui/patron-badge";
import { toast } from "@/ui/toast";
import { Leaf, Lettering, Lettrine, Toy, ToyBody } from "@/ui/toy";

const AVATAR = 92;

/** The icon of each perk, the same as on the web's offer and subscriber's page. */
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

/**
 * The subscriber's card, read only: the stores forbid selling outside their payment, so nothing
 * here buys, links to the web or shows a price.
 */
export function PatronScreen() {
  const ink = useInk();
  const [patron, setPatron] = useState<PatronResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setPatron(await api.fetchPatron());
    } catch {
      setFailed(true);
    }
  }, []);
  // Read again on return from finding a word, which spends a right.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Page title={PATRON_MEMBER_TITLE}>
      {patron === null ? (
        failed ? (
          <Panel paper>
            <Paragraph>{PATRON_LOAD_FAILED}</Paragraph>
            <Button label="Réessayer" secondary onPress={() => void load()} />
          </Panel>
        ) : (
          <ActivityIndicator color={ink.pageInkMuted} />
        )
      ) : (
        <>
          <PatronCard patron={patron} />
          <View style={styles.bento}>
            {PATRON_PERKS.map((perk) => (
              <MemberPerk key={perk.key} perk={perk} patron={patron} onChanged={load} />
            ))}
          </View>
        </>
      )}
    </Page>
  );
}

function PatronCard({ patron }: { readonly patron: PatronResponse }) {
  const me = useShared(profile);
  const status = patronStatus(patron, Date.now());
  if (status === null) return null;
  return (
    <Leaf style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.crowned}>
          <View style={styles.crown}>
            <Icon name="crown" size={30} color={toyMatters.gold.top} />
          </View>
          <Avatar avatar={me?.avatar ?? null} frame={me?.frame ?? null} size={AVATAR} />
        </View>
        <View style={styles.cardName}>
          <Text style={styles.cardKicker}>{PATRON_CARD_KICKER}</Text>
          <Text style={styles.name} accessibilityRole="header">
            {me === null ? "" : playerName({ code: me.playerCode, pseudo: me.pseudo })}
          </Text>
          <PatronBadge mark={patron.mark ?? "patron"} />
        </View>
      </View>
      <Lettering size={fontSizes.title}>{status.headline}</Lettering>
      {status.ending !== null && <Text style={styles.ending}>{status.ending}</Text>}
      {status.lines.map((line) => (
        <Text key={line} style={styles.text}>
          {line}
        </Text>
      ))}
      {status.warning !== null && <Text style={styles.warning}>{status.warning}</Text>}
      <Text style={styles.muted}>{PATRON_MANAGED_ON_WEB}</Text>
    </Leaf>
  );
}

/**
 * A tile of the subscriber's page: the perk's icon and title, where it stands, then what to do.
 * A half tile goes two to a row, its icon above its title; one left alone takes the whole row.
 */
function PerkBlock({
  perk,
  line,
  half = false,
  children,
}: {
  readonly perk: PatronPerk;
  readonly line: string;
  readonly half?: boolean;
  readonly children?: ReactNode;
}) {
  const { icon, matter } = PERK_ICONS[perk.key];
  if (half) {
    return (
      <Leaf style={[styles.card, styles.half]}>
        <ToyBody matter="gold" shape="tile" style={styles.halfIcon}>
          <Lettrine icon={icon} matter={matter} size={38} />
        </ToyBody>
        <Lettering size={fontSizes.subtitle}>{perk.title}</Lettering>
        <Text style={styles.text}>{line}</Text>
        {children ? <View style={styles.halfActions}>{children}</View> : null}
      </Leaf>
    );
  }
  return (
    <Leaf style={[styles.card, styles.whole]}>
      <View style={styles.claimRow}>
        <ToyBody matter="gold" shape="tile" style={styles.claimIcon}>
          <Lettrine icon={icon} matter={matter} size={48} />
        </ToyBody>
        <View style={styles.claimText}>
          <Lettering size={fontSizes.title}>{perk.title}</Lettering>
          <Text style={styles.text}>{line}</Text>
        </View>
      </View>
      {children}
    </Leaf>
  );
}

function MemberPerk({
  perk,
  patron,
  onChanged,
}: {
  readonly perk: PatronPerk;
  readonly patron: PatronResponse;
  readonly onChanged: () => Promise<void>;
}) {
  switch (perk.key) {
    case "cosmetic":
      return (
        <PerkBlock perk={perk} line={cosmeticPerkLine(patron, Date.now())}>
          {patron.claimable.map((item) => (
            <ClaimTile
              key={item.month}
              item={item}
              showMonth={patron.claimable.length > 1}
              onClaimed={onChanged}
            />
          ))}
        </PerkBlock>
      );
    case "word":
      return <Finds perk={perk} finds={patron.finds} />;
    case "editions":
      return <Editions perk={perk} />;
    case "cabinet":
      return (
        <PerkBlock perk={perk} line={PATRON_CABINET_LINE} half>
          <Button label={PATRON_OPEN_ALBUM} secondary small onPress={() => router.push("/album")} />
        </PerkBlock>
      );
    case "badge":
      return <BadgePerk perk={perk} patron={patron} />;
    case "thanks":
      return <ThanksSetting perk={perk} patron={patron} onChanged={onChanged} />;
    case "vote":
      return <Poll perk={perk} patron={patron} onChanged={onChanged} />;
    case "discord":
      return <DiscordSetting perk={perk} patron={patron} onChanged={onChanged} />;
  }
}

/** The title worn or not, with the button that puts it on, and the pinned cards it adds. */
function BadgePerk({
  perk,
  patron,
}: {
  readonly perk: PatronPerk;
  readonly patron: PatronResponse;
}) {
  const actions = useProfileActions();
  const title = patronTitleOf(patron);
  const worn = actions.profile?.title === title;
  return (
    <PerkBlock perk={perk} line={badgePerkLine(title, worn)}>
      {!worn && (
        <Button
          label={PATRON_WEAR_TITLE}
          secondary
          small
          disabled={actions.busy}
          onPress={() => void actions.update({ title }, { success: patronTitleWorn(title) })}
        />
      )}
      <Button label={PATRON_SEE_PROFILE} secondary small onPress={() => router.push("/profil")} />
    </PerkBlock>
  );
}

/** The words the patron may find, and those found, with where each stands. */
function Finds({ perk, finds }: { readonly perk: PatronPerk; readonly finds: PatronFindsView }) {
  return (
    <PerkBlock perk={perk} line={findsLeftLine(finds.left)}>
      {finds.left > 0 ? (
        <MainAction label={PATRON_FIND_ACTION} onPress={() => router.push("/denicher")} />
      ) : (
        <Text style={styles.muted}>{PATRON_FINDS_RULE}</Text>
      )}
      {finds.words.map((find) => (
        <View key={find.id} style={styles.found}>
          <Text style={styles.foundWord}>{find.word}</Text>
          <Text style={styles.text}>{findStateLine(find.state)}</Text>
        </View>
      ))}
    </PerkBlock>
  );
}

/** The library editions owned, kept for life, and where to choose them. */
function Editions({ perk }: { readonly perk: PatronPerk }) {
  const mine = useShared(editions);
  if (mine === null) return null;
  return (
    <PerkBlock perk={perk} line={editionsOwnedLine(mine.owned)} half>
      {mine.owned.length > 0 && (
        <Button label={PATRON_OPEN_ALBUM} secondary small onPress={() => router.push("/album")} />
      )}
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
  readonly onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const screen = pollScreen(patron, Date.now());
  const poll = patron.poll;
  if (screen === null || poll === null) {
    return <PerkBlock perk={perk} line={PATRON_VOTE_NONE} />;
  }

  const vote = async (theme: number) => {
    setBusy(true);
    try {
      const result = await api.votePatronPoll(poll.id, theme);
      if (result.kind === "refused") toast(voteRefusalLine(result.reason));
      await onChanged();
    } catch {
      toast(PATRON_POLL_FAILED);
    }
    setBusy(false);
  };

  return (
    <PerkBlock perk={perk} line={screen.intro}>
      {screen.themes.map((theme, index) => (
        <View key={theme.name} style={[styles.pollTheme, theme.winner && styles.pollWinner]}>
          <Text style={styles.foundWord}>{theme.name}</Text>
          <Text style={styles.muted}>{theme.description}</Text>
          <View style={styles.pollSide}>
            {theme.votes !== null && <Text style={styles.claimLabel}>{theme.votes}</Text>}
            {theme.chosen ? (
              <Text style={styles.pollChosen}>{PATRON_POLL_CHOSEN}</Text>
            ) : (
              screen.canVote && (
                <Button
                  label={PATRON_POLL_VOTE}
                  secondary
                  small
                  disabled={busy}
                  onPress={() => void vote(index)}
                />
              )
            )}
          </View>
        </View>
      ))}
      {screen.note !== null && <Text style={styles.muted}>{screen.note}</Text>}
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
  readonly onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const screen = discordScreen(patron);
  if (screen === null) return <PerkBlock perk={perk} line={PATRON_DISCORD_SOON} />;

  const link = async () => {
    setBusy(true);
    try {
      const trip = await linkDiscord();
      if (trip === "linked") toast(PATRON_DISCORD_LINKED);
      else if (trip !== "closed") toast(PATRON_DISCORD_FAILED);
      await onChanged();
    } catch {
      toast(PATRON_DISCORD_FAILED);
    }
    setBusy(false);
  };

  const unlink = async () => {
    setBusy(true);
    try {
      await api.unlinkDiscord();
      await onChanged();
    } catch {
      toast(PATRON_DISCORD_FAILED);
    }
    setBusy(false);
  };

  return (
    <PerkBlock perk={perk} line={screen.line}>
      {screen.canLink && (
        <MainAction label={PATRON_DISCORD_LINK} disabled={busy} onPress={() => void link()} />
      )}
      {screen.canUnlink && (
        <Button
          label={PATRON_DISCORD_UNLINK}
          secondary
          small
          disabled={busy}
          onPress={() => void unlink()}
        />
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
  readonly onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await api.setPatronThanks(!patron.thanksListed);
      await onChanged();
    } catch {
      toast(PATRON_THANKS_FAILED);
    }
    setBusy(false);
  };

  return (
    <PerkBlock perk={perk} line={patronThanksLine(patron)}>
      <Button label={PATRON_THANKS_SEE} secondary small onPress={() => router.push("/mecenes")} />
      <Button
        label={patron.thanksListed ? PATRON_THANKS_HIDE : PATRON_THANKS_SHOW}
        secondary
        small
        disabled={busy}
        onPress={() => void toggle()}
      />
    </PerkBlock>
  );
}

/** A month's cosmetics waiting for their patron, each drawn as it will be worn. */
function ClaimTile({
  item,
  showMonth,
  onClaimed,
}: {
  readonly item: MonthCosmeticView;
  readonly showMonth: boolean;
  readonly onClaimed: () => Promise<void>;
}) {
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
    <View style={styles.claim}>
      {showMonth && <Text style={styles.claimMonth}>{claimableMonth(item)}</Text>}
      {item.cosmetics.map((cosmetic) => {
        const caption = patronCosmeticCaption(cosmetic);
        return (
          <View key={`${caption.kind}-${caption.name}`} style={styles.claimRow}>
            <View style={styles.claimLook}>
              <CosmeticLook cosmetic={cosmetic} />
            </View>
            <View style={styles.claimName}>
              <Text style={styles.claimKind}>{caption.kind}</Text>
              <Text style={styles.claimLabel}>{caption.name}</Text>
            </View>
          </View>
        );
      })}
      <Toy
        matter="gold"
        style={styles.claimButton}
        disabled={claiming}
        accessibilityRole="button"
        onPress={() => void claim()}
      >
        <Lettering size={fontSizes.subtitle}>
          {claiming ? PATRON_CLAIM_BUSY : PATRON_CLAIM}
        </Lettering>
      </Toy>
    </View>
  );
}

/** A frame around the player's own engraving, an engraving bare, a title as a crown. */
function CosmeticLook({ cosmetic }: { readonly cosmetic: PatronCosmeticView }) {
  const me = useShared(profile);
  switch (cosmetic.kind) {
    case "frame":
      return <Avatar avatar={me?.avatar ?? null} frame={cosmetic.frame} size={CLAIM_LOOK} />;
    case "avatar":
      return <Avatar avatar={cosmetic.avatar} frame="simple" size={CLAIM_LOOK} />;
    case "title":
      return <Lettrine icon="gilded" matter="gold" size={CLAIM_LOOK} />;
  }
}

const CLAIM_LOOK = 64;

const styles = StyleSheet.create({
  card: { gap: space.s5, padding: space.s8 },
  // The perks as a grid of tiles: a half tile shares its row, a whole one fills it.
  bento: { flexDirection: "row", flexWrap: "wrap", gap: space.s6 },
  whole: { width: "100%" },
  half: { minWidth: 160, flexBasis: "45%", flexGrow: 1, gap: space.s4, padding: space.s6 },
  halfIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  // What to do sits at the foot of the tile, so that the two tiles of a row end together.
  halfActions: { marginTop: "auto", gap: space.s4 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  // The crown sits on the frame, like the badge beside a patron's name.
  crowned: { alignItems: "center", paddingTop: 20 },
  crown: { position: "absolute", top: 0, zIndex: 1, transform: [{ rotate: "-8deg" }] },
  cardName: { flex: 1, alignItems: "flex-start", gap: space.s2 },
  // Gilt on cream does not read: on the card, the kicker takes the paper's ink.
  cardKicker: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: paperColors.pageInkMuted,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    lineHeight: 28,
    color: paperColors.pageInk,
  },
  text: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 22,
    color: paperColors.pageInk,
  },
  // A cancelled subscription: said apart, so that the player sees it at once.
  ending: {
    padding: space.s5,
    borderWidth: 2,
    borderColor: mixHex(colors.paper, toyMatters.red.bottom, 0.5),
    borderRadius: 18,
    backgroundColor: mixHex(colors.paper, toyMatters.red.top, 0.12),
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 22,
    color: paperColors.pageInk,
  },
  warning: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: toyMatters.red.bottom,
  },
  muted: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: paperColors.pageInkMuted,
  },
  claim: {
    gap: space.s5,
    padding: space.s6,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 18,
    backgroundColor: mixHex(colors.paper, toyMatters.gold.top, 0.3),
    boxShadow: `0 4px 0 ${toyValues.outline}`,
  },
  claimRow: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  // The frame spills over the medallion: room for it.
  claimLook: { width: CLAIM_LOOK + 20, alignItems: "center", justifyContent: "center" },
  claimIcon: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  claimText: { flex: 1, gap: space.s2 },
  claimName: { flex: 1, gap: 2 },
  claimMonth: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.subtitle,
    color: paperColors.pageInk,
  },
  claimKind: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    color: paperColors.pageInk,
  },
  claimLabel: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: paperColors.pageInk,
  },
  claimButton: { minHeight: 48 },
  found: {
    gap: 2,
    paddingTop: space.s4,
    borderTopWidth: 1,
    borderTopColor: paperColors.rule,
  },
  pollTheme: {
    gap: space.s2,
    padding: space.s5,
    borderWidth: 2,
    borderColor: paperColors.rule,
    borderRadius: 18,
  },
  pollWinner: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    backgroundColor: mixHex(colors.paper, toyMatters.gold.top, 0.3),
    boxShadow: `0 4px 0 ${toyValues.outline}`,
  },
  pollSide: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s4 },
  pollChosen: {
    overflow: "hidden",
    paddingHorizontal: space.s5,
    paddingVertical: space.s2,
    borderRadius: 999,
    backgroundColor: paperColors.pageInk,
    color: colors.paper,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
  },
  foundWord: {
    fontFamily: fonts.display,
    fontSize: fontSizes.subtitle,
    lineHeight: 24,
    color: paperColors.pageInk,
  },
});
