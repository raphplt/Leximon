import type { Friend, FriendRequest } from "@leximon/contract";
import {
  betaPlacesLabel,
  FRIENDS_EMPTY,
  FRIENDS_GUEST,
  FRIENDS_PSEUDO_FIRST,
  FRIENDS_TITLE,
  type FriendFilter,
  friendLine,
  friendLinkText,
  friendListView,
  friendsCountLabel,
  playerName,
  requestSentToast,
  tradesLabel,
  unfoldLabel,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api/client";
import { Emblem } from "@/clan/emblem";
import { WEB_URL } from "@/config";
import { friendAction } from "@/friends/friend-action";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { friends } from "@/player/state";
import { usePlayerView } from "@/player/use-player-view";
import { PseudoSheet } from "@/screens/profile/pseudo-sheet";
import { colors, fonts } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";
import { TextField } from "@/ui/text-field";
import { FriendFeed } from "./feed";
import { Podium } from "./podium";

/** Amis: requests, the friend link, the weekly podium, the list and the feed. */
export function FriendsScreen({ adding }: { readonly adding: string | null }) {
  const view = usePlayerView();
  const data = useShared(friends);
  const failed = useSharedFailed(friends);
  const now = useNow(30_000);
  const [pseudoOpen, setPseudoOpen] = useState(false);
  const [chosen, setChosen] = useState<Friend | null>(null);

  useEffect(() => friends.refresh(), []);

  if (view.guest) {
    return (
      <Page title={FRIENDS_TITLE}>
        <Paragraph>{FRIENDS_GUEST}</Paragraph>
        <Button label="Créer mon compte" onPress={() => router.push("/compte")} />
      </Page>
    );
  }
  if (data === null || view.profile === null) {
    return (
      <Page title={FRIENDS_TITLE}>
        {data === null && failed ? (
          <>
            <Paragraph muted>Tes amis ne se chargent pas.</Paragraph>
            <Button label="Réessayer" secondary onPress={() => friends.refresh()} />
          </>
        ) : (
          <Paragraph muted>Un instant…</Paragraph>
        )}
      </Page>
    );
  }

  const hasPseudo = view.profile.pseudo !== null;
  // Once there are friends, they come first; before that, the ways to get some.
  const hasFriends = data.friends.length > 0;
  const list = <FriendList friends={data.friends} now={now} onChoose={setChosen} />;
  const ways = hasPseudo ? (
    <>
      <FriendLink code={data.link.code} placesLeft={data.link.betaPlacesLeft} />
      <AddByPseudo />
    </>
  ) : (
    <Panel>
      <Text style={styles.hint}>{FRIENDS_PSEUDO_FIRST}</Text>
      <Button label="Choisir mon pseudo" onPress={() => setPseudoOpen(true)} />
    </Panel>
  );

  return (
    <Page title={FRIENDS_TITLE}>
      <Text style={styles.count}>{friendsCountLabel(data.friends.length, data.maxFriends)}</Text>
      {adding !== null && <AddFromLink code={adding} />}
      {data.incoming.length > 0 && <Incoming requests={data.incoming} />}

      {hasFriends && list}
      {ways}
      {!hasFriends && list}

      {data.outgoing.length > 0 && <Outgoing requests={data.outgoing} />}

      <Podium alone={data.friends.length === 0} now={now} />
      <FriendFeed now={now} />

      <FriendSheet friend={chosen} now={now} onClose={() => setChosen(null)} />
      <PseudoSheet open={pseudoOpen} onClose={() => setPseudoOpen(false)} />
    </Page>
  );
}

function FriendList({
  friends: list,
  now,
  onChoose,
}: {
  readonly friends: readonly Friend[];
  readonly now: number;
  readonly onChoose: (friend: Friend) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FriendFilter>("all");
  const [unfolded, setUnfolded] = useState(false);
  const view = friendListView(list, { query, filter, unfolded });

  return (
    <Panel>
      <Text style={styles.kicker}>TES AMIS</Text>
      {list.length === 0 && <Text style={styles.empty}>{FRIENDS_EMPTY}</Text>}
      {view.searchable && (
        <>
          <View style={styles.search}>
            <Icon name="search" size={17} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              placeholder="Chercher un ami"
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.accent}
              accessibilityLabel="Chercher un ami"
              autoCorrect={false}
              onChangeText={setQuery}
            />
          </View>
          <View style={styles.chips}>
            {view.filters.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                on={filter === f.id}
                onPress={() => setFilter(f.id)}
              />
            ))}
          </View>
        </>
      )}
      {view.empty !== null && <Text style={styles.empty}>{view.empty}</Text>}
      {view.shown.map((friend) => {
        const trades = tradesLabel(friend.trades);
        return (
          <Pressable
            key={friend.player.code}
            onPress={() => onChoose(friend)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View>
              <Avatar avatar={friend.player.avatar} frame={null} size={44} />
              {friend.online && <View style={styles.online} />}
            </View>
            <View style={styles.rowText}>
              <View style={styles.nameLine}>
                <Text style={styles.name} numberOfLines={1}>
                  {playerName(friend.player)}
                </Text>
                {friend.crowned && (
                  <View accessible accessibilityLabel="Premier la semaine passée">
                    <Icon name="crown" size={14} color={colors.accent} />
                  </View>
                )}
              </View>
              <Text style={styles.small}>{friendLine(friend, now)}</Text>
            </View>
            {trades !== null && (
              <View style={styles.trades}>
                <Icon name="echange" size={14} color={colors.accent} />
                <Text style={styles.tradesText}>{trades}</Text>
              </View>
            )}
            <Icon name="chev" size={16} color={colors.textMuted} />
          </Pressable>
        );
      })}
      {view.folded > 0 && (
        <TextButton label={unfoldLabel(view.folded)} onPress={() => setUnfolded(true)} />
      )}
    </Panel>
  );
}

/** Past a few requests, the rest waits behind a button: the page is not a queue. */
const REQUESTS_SHOWN = 3;

function Incoming({ requests }: { readonly requests: readonly FriendRequest[] }) {
  const [busy, setBusy] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const shown = unfolded ? requests : requests.slice(0, REQUESTS_SHOWN);

  const answer = async (request: FriendRequest, accept: boolean) => {
    const code = request.player.code;
    const name = playerName(request.player);
    setBusy(true);
    await (accept
      ? friendAction(
          () => api.acceptFriend(code),
          () => `${name} et toi, vous êtes amis.`,
        )
      : friendAction(
          () => api.declineFriend(code),
          () => null,
        ));
    setBusy(false);
  };

  return (
    <Panel style={styles.incoming}>
      <Text style={styles.kicker}>
        {requests.length > 1 ? `${requests.length} DEMANDES D'AMI` : "UNE DEMANDE D'AMI"}
      </Text>
      {shown.map((request) => (
        <View key={request.player.code} style={styles.request}>
          <View style={styles.row}>
            <Avatar avatar={request.player.avatar} frame={null} size={40} />
            <View style={styles.rowText}>
              <Text style={styles.name}>{playerName(request.player)}</Text>
              <LevelMedal level={request.player.level} size={24} labelled />
            </View>
          </View>
          <View style={styles.requestActions}>
            <View style={styles.grow}>
              <Button label="Accepter" disabled={busy} onPress={() => void answer(request, true)} />
            </View>
            <View style={styles.grow}>
              <Button
                label="Refuser"
                secondary
                disabled={busy}
                onPress={() => void answer(request, false)}
              />
            </View>
          </View>
        </View>
      ))}
      {shown.length < requests.length && (
        <TextButton
          label={unfoldLabel(requests.length - shown.length)}
          onPress={() => setUnfolded(true)}
        />
      )}
    </Panel>
  );
}

function Outgoing({ requests }: { readonly requests: readonly FriendRequest[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Panel>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.summary}
      >
        <Text style={styles.summaryText}>
          {requests.length > 1 ? `${requests.length} demandes envoyées` : "Une demande envoyée"}
        </Text>
        <Icon name={open ? "chevd" : "chev"} size={16} color={colors.textMuted} />
      </Pressable>
      {open &&
        requests.map((request) => (
          <View key={request.player.code} style={styles.row}>
            <Avatar avatar={request.player.avatar} frame={null} size={36} />
            <Text style={[styles.name, styles.rowText]}>{playerName(request.player)}</Text>
            <TextButton
              label="Annuler"
              onPress={() =>
                void friendAction(
                  () => api.cancelFriendRequest(request.player.code),
                  () => "Demande annulée.",
                )
              }
            />
          </View>
        ))}
    </Panel>
  );
}

function FriendLink({
  code,
  placesLeft,
}: {
  readonly code: string;
  readonly placesLeft: number | null;
}) {
  const places = betaPlacesLabel(placesLeft);
  return (
    <Panel>
      <Text style={styles.kicker}>TON LIEN D'AMI</Text>
      <Text style={styles.line}>
        Qui arrive par ton lien devient ton ami. Au niveau 5, un sachet bonus pour chacun.
      </Text>
      {places !== null && <Text style={styles.small}>{places}</Text>}
      <Button
        label="Partager mon lien"
        onPress={() => void Share.share({ message: friendLinkText(WEB_URL, code) })}
      />
    </Panel>
  );
}

function AddByPseudo() {
  const [pseudo, setPseudo] = useState("");
  const [busy, setBusy] = useState(false);
  const typed = pseudo.trim();

  const submit = async () => {
    if (typed === "" || busy) return;
    setBusy(true);
    const sent = await friendAction(
      () => api.askFriend({ pseudo: typed }),
      (value) => requestSentToast(value.outcome, value.player),
    );
    setBusy(false);
    if (sent) setPseudo("");
  };

  return (
    <Panel>
      <TextField
        label="Ajouter par pseudo"
        value={pseudo}
        maxLength={40}
        placeholder="Le pseudo exact"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="send"
        onChangeText={setPseudo}
        onSubmitEditing={() => void submit()}
      />
      <Button
        label={busy ? "Envoi…" : "Envoyer la demande"}
        secondary
        disabled={busy || typed === ""}
        onPress={() => void submit()}
      />
    </Panel>
  );
}

/** From a friend link followed by a player who already plays. */
function AddFromLink({ code }: { readonly code: string }) {
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api
      .fetchReferrer(code)
      .then((referrer) => setPseudo(referrer?.player.pseudo ?? null))
      .catch(() => setPseudo(null));
  }, [code]);

  if (pseudo === null || done) return null;
  return (
    <Panel style={styles.incoming}>
      <Text style={styles.hint}>Ajouter {pseudo} en ami ?</Text>
      <Button
        label="Envoyer la demande"
        onPress={() =>
          void friendAction(
            () => api.askFriend({ code }),
            (value) => requestSentToast(value.outcome, value.player),
          ).then(() => setDone(true))
        }
      />
      <TextButton label="Plus tard" onPress={() => setDone(true)} />
    </Panel>
  );
}

/** A friend touched in the list: who they are, a trade, and the way out. */
function FriendSheet({
  friend,
  now,
  onClose,
}: {
  readonly friend: Friend | null;
  readonly now: number;
  readonly onClose: () => void;
}) {
  return (
    <Sheet
      open={friend !== null}
      title={friend === null ? "Ami" : playerName(friend.player)}
      onClose={onClose}
    >
      {friend !== null && (
        <FriendActions key={friend.player.code} friend={friend} now={now} onDone={onClose} />
      )}
    </Sheet>
  );
}

function FriendActions({
  friend,
  now,
  onDone,
}: {
  readonly friend: Friend;
  readonly now: number;
  readonly onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const code = friend.player.code;
  const name = playerName(friend.player);
  const trades = tradesLabel(friend.trades);

  const remove = async () => {
    setBusy(true);
    const done = await friendAction(
      () => api.removeFriend(code),
      () => `${name} n'est plus ton ami.`,
    );
    setBusy(false);
    if (done) onDone();
  };

  return (
    <>
      <View style={styles.sheetHead}>
        <Avatar avatar={friend.player.avatar} frame={friend.player.frame} size={72} />
        <View style={styles.rowText}>
          <Text style={styles.small}>{friendLine(friend, now)}</Text>
          {friend.clan !== null && (
            <View style={styles.clan}>
              <Emblem emblem={friend.clan.emblem} size={22} />
              <Text style={styles.clanName}>{friend.clan.name}</Text>
            </View>
          )}
          {trades !== null && <Text style={styles.tradesText}>{trades}</Text>}
        </View>
      </View>
      {friend.player.pseudo !== null && (
        <Button
          label="Voir son profil"
          secondary
          onPress={() => {
            const { pseudo } = friend.player;
            onDone();
            if (pseudo !== null) router.push({ pathname: "/joueur/[pseudo]", params: { pseudo } });
          }}
        />
      )}
      <Button
        label="Proposer un échange"
        onPress={() => {
          onDone();
          router.dismissTo({ pathname: "/echanges", params: { avec: code } });
        }}
      />
      <Button
        label="Comparer nos albums"
        secondary
        onPress={() => {
          onDone();
          router.dismissTo({ pathname: "/album", params: { ami: code } });
        }}
      />
      <Button
        danger
        label={confirming ? `Oui, retirer ${name}` : "Retirer de mes amis"}
        disabled={busy}
        onPress={() => (confirming ? void remove() : setConfirming(true))}
      />
      {confirming && <Text style={styles.small}>Sans prévenir, des deux côtés.</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.textMuted, marginTop: -10 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  hint: { fontFamily: fonts.text.regular, fontSize: 17, lineHeight: 24, color: colors.text },
  line: { fontFamily: fonts.ui.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  small: { fontFamily: fonts.ui.medium, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  empty: {
    fontFamily: fonts.text.italic,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textMuted,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 23,
    backgroundColor: colors.well,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.ui.semibold,
    fontSize: 15,
    paddingVertical: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  pressed: { opacity: 0.7 },
  online: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.sheet,
    backgroundColor: colors.success,
  },
  rowText: { flex: 1, gap: 2 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.ui.extrabold, fontSize: 15, color: colors.text },
  trades: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255, 210, 77, 0.14)",
  },
  tradesText: { fontFamily: fonts.ui.bold, fontSize: 13, color: colors.accent },
  incoming: { borderWidth: 1, borderColor: "rgba(255, 210, 77, 0.35)" },
  request: { gap: 8 },
  requestActions: { flexDirection: "row", gap: 10 },
  grow: { flex: 1 },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryText: { fontFamily: fonts.ui.extrabold, fontSize: 15, color: colors.text },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 16 },
  clan: { flexDirection: "row", alignItems: "center", gap: 8 },
  clanName: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.text },
});
