import type { ProfileResponse, PublicProfile } from "@leximon/contract";
import { ApiError, type Catalog } from "@leximon/contract/client";
import {
  BLOCK_CONFIRM,
  BLOCKED_NOTE,
  BLOCKED_TOAST,
  blockRefusalMessage,
  friendRefusalText,
  PROFILE_NOT_FOUND,
  REPORTED_TOAST,
  requestSentToast,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { useShared } from "@/player/shared";
import { friends, profile } from "@/player/state";
import { colors, fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";
import { toast } from "@/ui/toast";
import { PinnedCards, type ProfileFace, ProfileHeader, StatsPanel } from "./profile-view";

function failureMessage(error: unknown): string {
  return error instanceof ApiError && error.status === null
    ? "Pas de connexion. Réessaie."
    : "Ça n'a pas marché. Réessaie.";
}

const openClan = (id: string) => () => router.push({ pathname: "/clan/[id]", params: { id } });

type State =
  | { readonly kind: "loading" | "failed" | "missing" | "blocked" }
  | { readonly kind: "shown"; readonly profile: PublicProfile };

/** Someone's profile, read with the player's session: hidden when either blocked the other. */
export function PublicProfileScreen({ pseudo }: { readonly pseudo: string }) {
  const viewer = useShared(profile);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const shown = await api.fetchPublicProfile(pseudo);
      setState(shown === null ? { kind: "missing" } : { kind: "shown", profile: shown });
    } catch {
      setState({ kind: "failed" });
    }
  }, [pseudo]);

  useEffect(() => {
    void load();
    loadCatalog().then(setCatalog, () => undefined);
  }, [load]);

  if (state.kind !== "shown") {
    return (
      <Page title={pseudo}>
        {state.kind === "loading" && <Paragraph muted>Un instant…</Paragraph>}
        {state.kind === "missing" && <Paragraph>{PROFILE_NOT_FOUND}</Paragraph>}
        {state.kind === "blocked" && <Paragraph>{BLOCKED_NOTE}</Paragraph>}
        {state.kind === "failed" && (
          <>
            <Paragraph muted>Le serveur ne répond pas.</Paragraph>
            <Button label="Réessayer" secondary onPress={() => void load()} />
          </>
        )}
      </Page>
    );
  }

  const shown = state.profile;
  const face: ProfileFace =
    shown.visibility === "public"
      ? {
          avatar: shown.avatar,
          frame: shown.frame,
          title: shown.title,
          level: shown.level,
          code: shown.code,
          memberSince: shown.memberSince,
          clan: shown.clan,
        }
      : {
          avatar: shown.avatar,
          frame: shown.frame,
          title: null,
          level: 1,
          code: null,
          memberSince: null,
          clan: null,
        };
  const own = viewer !== null && shown.visibility === "public" && viewer.playerCode === shown.code;
  const clanId = shown.visibility === "public" ? (shown.clan?.id ?? null) : null;

  return (
    <Page title={shown.pseudo}>
      <ProfileHeader face={face} {...(clanId === null ? {} : { onClan: openClan(clanId) })} />
      {own ? (
        <Panel paper>
          <Text style={[styles.note, styles.onPaper]}>
            Tu vois ton profil comme les autres le voient.
          </Text>
          <Button label="Mon profil" secondary onPress={() => router.replace("/profil")} />
        </Panel>
      ) : (
        viewer !== null && (
          <ViewerActions
            // The viewer's own copy of the profile carries the friendship.
            key={shown.friendship ?? "unknown"}
            profile={shown}
            viewer={viewer}
            onBlocked={() => setState({ kind: "blocked" })}
          />
        )
      )}
      {shown.visibility === "public" ? (
        <>
          <PinnedCards pinned={shown.pinned} catalog={catalog} />
          <StatsPanel stats={shown.stats} catalog={catalog} />
        </>
      ) : (
        <View style={styles.private}>
          <Icon name="lock" size={18} color={colors.pageInkMuted} />
          <Text style={styles.note}>Profil privé.</Text>
        </View>
      )}
    </Page>
  );
}

/** What a player can do on someone's profile. */
function ViewerActions({
  profile: shown,
  viewer,
  onBlocked,
}: {
  readonly profile: PublicProfile;
  readonly viewer: ProfileResponse;
  readonly onBlocked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reported, setReported] = useState(false);
  const [friendship, setFriendship] = useState(shown.friendship ?? null);
  const code = shown.visibility === "public" ? shown.code : null;

  const befriend = async () => {
    setBusy(true);
    try {
      const result = await api.askFriend({ pseudo: shown.pseudo });
      if (result.kind === "refused") {
        toast(friendRefusalText(result.reason));
        return;
      }
      setFriendship(result.value.outcome === "accepted" ? "friends" : "requested");
      toast(requestSentToast(result.value.outcome, result.value.player));
      friends.refresh();
    } catch (error) {
      toast(failureMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    setBusy(true);
    try {
      const result = await api.reportPlayer(shown.pseudo);
      if (result.kind === "refused") toast(blockRefusalMessage(result.reason));
      else {
        setReported(true);
        toast(REPORTED_TOAST);
      }
    } catch (error) {
      toast(failureMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    if (code === null) return;
    setBusy(true);
    try {
      const result = await api.setBlocked(code, true);
      if (result.kind === "refused") {
        toast(blockRefusalMessage(result.reason));
        return;
      }
      toast(BLOCKED_TOAST);
      setConfirmBlock(false);
      friends.refresh();
      onBlocked();
    } catch (error) {
      toast(failureMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.actions}>
      {code !== null && (
        <Button
          label="Proposer un échange"
          onPress={() => router.dismissTo({ pathname: "/echanges", params: { avec: code } })}
        />
      )}
      {viewer.member && friendship === "none" && (
        <Button label="Ajouter en ami" secondary disabled={busy} onPress={() => void befriend()} />
      )}
      {friendship === "requested" && (
        <Button label="Demande envoyée" secondary disabled onPress={() => undefined} />
      )}
      {friendship === "incoming" && (
        <Button label="Répondre à sa demande" secondary onPress={() => router.push("/amis")} />
      )}
      {friendship === "friends" && (
        <View style={styles.friendTag}>
          <Icon name="amis" size={17} color={colors.success} />
          <Text style={styles.friendText}>Ami</Text>
        </View>
      )}
      {viewer.member && (
        <View style={styles.minor}>
          <TextButton
            label={reported ? "Signalé" : "Signaler le pseudo"}
            disabled={busy || reported}
            onPress={() => void report()}
          />
          {code !== null && (
            <TextButton label="Bloquer" disabled={busy} onPress={() => setConfirmBlock(true)} />
          )}
        </View>
      )}
      <Sheet
        open={confirmBlock}
        title={`Bloquer ${shown.pseudo} ?`}
        onClose={() => setConfirmBlock(false)}
      >
        <Text style={styles.note}>{BLOCK_CONFIRM}</Text>
        <Button danger label="Bloquer" disabled={busy} onPress={() => void block()} />
        <Button label="Annuler" secondary disabled={busy} onPress={() => setConfirmBlock(false)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: colors.pageInk,
  },
  onPaper: { color: paperColors.pageInk },
  private: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  actions: { gap: space.s5 },
  friendTag: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.s3,
  },
  friendText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: colors.success },
  minor: { flexDirection: "row", justifyContent: "center", gap: space.s12 },
});
