import type { MonthCosmeticView, PatronFindsView, PatronResponse } from "@leximon/contract";
import { mixHex, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  claimableLabel,
  discordScreen,
  editionsOwnedLine,
  findStateLine,
  findsLeftLine,
  PATRON_CARD_KICKER,
  PATRON_CLAIM,
  PATRON_CLAIM_BUSY,
  PATRON_CLAIMABLE_TITLE,
  PATRON_CLAIMED,
  PATRON_DISCORD_FAILED,
  PATRON_DISCORD_LINK,
  PATRON_DISCORD_LINKED,
  PATRON_DISCORD_TITLE,
  PATRON_DISCORD_UNLINK,
  PATRON_EDITIONS_TITLE,
  PATRON_FIND_ACTION,
  PATRON_FINDS_RULE,
  PATRON_FINDS_TITLE,
  PATRON_LOAD_FAILED,
  PATRON_MANAGED_ON_WEB,
  PATRON_MEMBER_TITLE,
  PATRON_POLL_CHOSEN,
  PATRON_POLL_FAILED,
  PATRON_POLL_TITLE,
  PATRON_POLL_VOTE,
  PATRON_THANKS_FAILED,
  PATRON_THANKS_HIDE,
  PATRON_THANKS_PAGE_TITLE,
  PATRON_THANKS_SEE,
  PATRON_THANKS_SHOW,
  patronStatus,
  patronThanksLine,
  playerName,
  pollScreen,
  voteRefusalLine,
} from "@leximon/view-model";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { linkDiscord } from "@/api/discord-link";
import { MainAction } from "@/library/play-pieces";
import { useShared } from "@/player/shared";
import { editions, profile } from "@/player/state";
import { colors, fontSizes, fonts, paperColors, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { useInk } from "@/ui/ink";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { PatronBadge } from "@/ui/patron-badge";
import { toast } from "@/ui/toast";
import { Kicker, Leaf, Lettering, Lettrine, Toy, ToyBody } from "@/ui/toy";

const AVATAR = 92;

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
          <Poll patron={patron} onChanged={load} />
          <Finds finds={patron.finds} />
          <Editions />
          <DiscordSetting patron={patron} onChanged={load} />
          <ThanksSetting patron={patron} onChanged={load} />
          {patron.claimable.map((item) => (
            <ClaimTile key={item.month} item={item} onClaimed={load} />
          ))}
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
          <Kicker>{PATRON_CARD_KICKER}</Kicker>
          <Text style={styles.name} accessibilityRole="header">
            {me === null ? "" : playerName({ code: me.playerCode, pseudo: me.pseudo })}
          </Text>
          <PatronBadge mark={patron.mark ?? "patron"} />
        </View>
      </View>
      <Lettering size={fontSizes.title}>{status.headline}</Lettering>
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

/** The words the patron may find, and those found, with where each stands. */
function Finds({ finds }: { readonly finds: PatronFindsView }) {
  return (
    <Leaf style={styles.card}>
      <View style={styles.claimRow}>
        <ToyBody matter="gold" shape="tile" style={styles.claimIcon}>
          <Lettrine icon="scroll" matter="blue" size={48} />
        </ToyBody>
        <View style={styles.claimText}>
          <Lettering size={fontSizes.title}>{PATRON_FINDS_TITLE}</Lettering>
          <Text style={styles.text}>{findsLeftLine(finds.left)}</Text>
        </View>
      </View>
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
    </Leaf>
  );
}

/** The library editions owned, kept for life, and where to choose them. */
function Editions() {
  const mine = useShared(editions);
  if (mine === null) return null;
  return (
    <Leaf style={styles.card}>
      <View style={styles.claimRow}>
        <ToyBody matter="gold" shape="tile" style={styles.claimIcon}>
          <Lettrine icon="ink" matter="red" size={48} />
        </ToyBody>
        <View style={styles.claimText}>
          <Lettering size={fontSizes.title}>{PATRON_EDITIONS_TITLE}</Lettering>
          <Text style={styles.text}>{editionsOwnedLine(mine.owned)}</Text>
        </View>
      </View>
    </Leaf>
  );
}

/** The vote on the theme of a coming collection: open for a week, results once it closes. */
function Poll({
  patron,
  onChanged,
}: {
  readonly patron: PatronResponse;
  readonly onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const screen = pollScreen(patron, Date.now());
  const poll = patron.poll;
  if (screen === null || poll === null) return null;

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
    <Leaf style={styles.card}>
      <View style={styles.claimRow}>
        <ToyBody matter="gold" shape="tile" style={styles.claimIcon}>
          <Lettrine icon="community" matter="red" size={48} />
        </ToyBody>
        <View style={styles.claimText}>
          <Lettering size={fontSizes.title}>{PATRON_POLL_TITLE}</Lettering>
          <Text style={styles.text}>{screen.intro}</Text>
        </View>
      </View>
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
    </Leaf>
  );
}

/** The patrons' Discord: the link, which brings the role and the reserved room, and its undoing. */
function DiscordSetting({
  patron,
  onChanged,
}: {
  readonly patron: PatronResponse;
  readonly onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const screen = discordScreen(patron);
  if (screen === null) return null;

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
    <Leaf style={styles.card}>
      <View style={styles.claimRow}>
        <ToyBody matter="gold" shape="tile" style={styles.claimIcon}>
          <Lettrine icon="discussion" matter="blue" size={48} />
        </ToyBody>
        <View style={styles.claimText}>
          <Lettering size={fontSizes.title}>{PATRON_DISCORD_TITLE}</Lettering>
          <Text style={styles.text}>{screen.line}</Text>
        </View>
      </View>
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
    </Leaf>
  );
}

/** The public page of thanks: whether the patron's pseudo is on it, and « Ne pas me citer ». */
function ThanksSetting({
  patron,
  onChanged,
}: {
  readonly patron: PatronResponse;
  readonly onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const paying = patron.subscription?.standing === "patron";

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
    <Leaf style={styles.card}>
      <View style={styles.claimRow}>
        <ToyBody matter="gold" shape="tile" style={styles.claimIcon}>
          <Lettrine icon="books" matter="red" size={48} />
        </ToyBody>
        <View style={styles.claimText}>
          <Lettering size={fontSizes.title}>{PATRON_THANKS_PAGE_TITLE}</Lettering>
          <Text style={styles.text}>{patronThanksLine(patron)}</Text>
        </View>
      </View>
      <Button label={PATRON_THANKS_SEE} secondary small onPress={() => router.push("/mecenes")} />
      {paying && (
        <Button
          label={patron.thanksListed ? PATRON_THANKS_HIDE : PATRON_THANKS_SHOW}
          secondary
          small
          disabled={busy}
          onPress={() => void toggle()}
        />
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
  readonly onClaimed: () => Promise<void>;
}) {
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
    <View style={styles.claim}>
      <View style={styles.claimRow}>
        <ToyBody matter="gold" shape="tile" style={styles.claimIcon}>
          <Lettrine icon="chest" matter="red" size={48} />
        </ToyBody>
        <View style={styles.claimText}>
          <Kicker>{PATRON_CLAIMABLE_TITLE}</Kicker>
          <Text style={styles.claimLabel}>{claimableLabel(item)}</Text>
        </View>
      </View>
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

const styles = StyleSheet.create({
  card: { gap: space.s5, padding: space.s8 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  // The crown sits on the frame, like the badge beside a patron's name.
  crowned: { alignItems: "center", paddingTop: 20 },
  crown: { position: "absolute", top: 0, zIndex: 1, transform: [{ rotate: "-8deg" }] },
  cardName: { flex: 1, alignItems: "flex-start", gap: space.s2 },
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
  claimIcon: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  claimText: { flex: 1, gap: space.s2 },
  claimLabel: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: paperColors.pageInk,
  },
  claimButton: { height: 48 },
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
