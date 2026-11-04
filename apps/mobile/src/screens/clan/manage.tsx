import type { ClanMember, ClanRole, ClanView } from "@leximon/contract";
import type { ClanResult } from "@leximon/contract/client";
import { canAct } from "@leximon/core";
import {
  formatPlayerCode,
  leaveLabel,
  memberLine,
  muteChoices,
  mutedUntilLabel,
  playerName,
  requestSentToast,
  roleLabel,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { act, refusalText } from "@/clan/act";
import { friendAction } from "@/friends/friend-action";
import { useShared } from "@/player/shared";
import { friends, myClan, profile } from "@/player/state";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { LevelMedal } from "@/ui/level";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";
import { toast } from "@/ui/toast";
import { ClanForm } from "./clan-form";

type Pending = "kick" | "hand_over" | null;

/** A member, and what the chief or a deputy may do to them. */
export function MemberSheet({
  clanId,
  myRole,
  member,
  now,
  onClose,
  onChanged,
}: {
  readonly clanId: string;
  readonly myRole: ClanRole;
  readonly member: ClanMember | null;
  readonly now: number;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}) {
  return (
    <Sheet
      open={member !== null}
      title={member === null ? "Membre" : playerName(member.player)}
      onClose={onClose}
    >
      {member !== null && (
        <MemberActions
          key={member.player.code}
          clanId={clanId}
          myRole={myRole}
          member={member}
          now={now}
          onChanged={onChanged}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

function MemberActions({
  clanId,
  myRole,
  member,
  now,
  onChanged,
  onClose,
}: {
  readonly clanId: string;
  readonly myRole: ClanRole;
  readonly member: ClanMember;
  readonly now: number;
  readonly onChanged: () => void;
  readonly onClose: () => void;
}) {
  const me = useShared(profile);
  const myFriends = useShared(friends);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const name = playerName(member.player);
  const code = member.player.code;
  const self = me?.playerCode === code;
  const canBefriend =
    !self &&
    myFriends !== null &&
    ![...myFriends.friends, ...myFriends.outgoing, ...myFriends.incoming].some(
      (other) => other.player.code === code,
    );
  const target = member.role;
  const muted = member.mutedUntil !== null && Date.parse(member.mutedUntil) > now;
  const role = roleLabel(target);

  const run = async (action: () => Promise<ClanResult<unknown>>, done: string) => {
    setBusy(true);
    const ok = await act(action, done);
    setBusy(false);
    if (ok) onChanged();
  };

  return (
    <>
      <View style={styles.head}>
        <Avatar avatar={member.player.avatar} frame={member.player.frame} size={72} />
        <View style={styles.headText}>
          <Text style={styles.small}>{memberLine(member, now)}</Text>
          {role !== null && <Text style={styles.role}>{role}</Text>}
          {muted && member.mutedUntil !== null && (
            <Text style={styles.small}>{mutedUntilLabel(member.mutedUntil, now)}</Text>
          )}
        </View>
      </View>

      {!self && member.player.pseudo !== null && (
        <Button
          label="Voir son profil"
          secondary
          onPress={() => {
            const { pseudo } = member.player;
            onClose();
            if (pseudo !== null) router.push({ pathname: "/joueur/[pseudo]", params: { pseudo } });
          }}
        />
      )}

      {canBefriend && (
        <Button
          label="Ajouter en ami"
          secondary
          disabled={busy}
          onPress={() =>
            void friendAction(
              () => api.askFriend({ code }),
              (value) => requestSentToast(value.outcome, value.player),
            )
          }
        />
      )}

      {!self && canAct(myRole, "appoint_deputy") && target !== "chief" && (
        <Button
          label={target === "deputy" ? "Retirer le rôle d'adjoint" : "Nommer adjoint"}
          secondary
          disabled={busy}
          onPress={() =>
            void run(
              () => api.setRole(clanId, code, target === "deputy" ? "member" : "deputy"),
              target === "deputy" ? `${name} n'est plus adjoint.` : `${name} devient adjoint.`,
            )
          }
        />
      )}

      {!self && canAct(myRole, "mute", target) && (
        <View style={styles.group}>
          <Text style={styles.kicker}>RENDRE MUET</Text>
          <View style={styles.chips}>
            {muteChoices(now).map((choice) => (
              <Chip
                key={choice.durationMs}
                label={choice.label}
                disabled={busy}
                onPress={() =>
                  void run(
                    () => api.muteMember(clanId, code, choice.durationMs),
                    `${name} se tait pour ${choice.label}.`,
                  )
                }
              />
            ))}
            {muted && (
              <Chip
                label="Lever le silence"
                disabled={busy}
                onPress={() =>
                  void run(() => api.muteMember(clanId, code, null), `${name} peut reparler.`)
                }
              />
            )}
          </View>
        </View>
      )}

      {!self && canAct(myRole, "hand_over", target) && (
        <Button
          label={
            pending === "hand_over" ? `Oui, ${name} devient chef` : "Lui passer la tête du clan"
          }
          secondary
          disabled={busy}
          onPress={() =>
            pending === "hand_over"
              ? void run(() => api.handOver(clanId, code), `${name} prend la tête du clan.`)
              : setPending("hand_over")
          }
        />
      )}

      {!self && canAct(myRole, "kick", target) && (
        <Button
          danger
          label={pending === "kick" ? `Oui, exclure ${name}` : "Exclure du clan"}
          disabled={busy}
          onPress={() =>
            pending === "kick"
              ? void run(() => api.kickMember(clanId, code), `${name} est exclu.`)
              : setPending("kick")
          }
        />
      )}
    </>
  );
}

type Request = Awaited<ReturnType<typeof api.fetchRequests>>["requests"][number];

/** Requests to enter, for the chief and the deputies. */
export function RequestsSheet({
  clanId,
  open,
  onClose,
  onChanged,
}: {
  readonly clanId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}) {
  const [requests, setRequests] = useState<readonly Request[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRequests(null);
    api
      .fetchRequests(clanId)
      .then((page) => setRequests(page.requests))
      .catch(() => setRequests([]));
  }, [open, clanId]);

  const answer = async (code: string, name: string, accept: boolean) => {
    setBusy(true);
    const ok = await act(
      () => api.answerRequest(clanId, code, accept),
      accept ? `${name} entre dans le clan.` : "Demande refusée.",
    );
    setBusy(false);
    if (ok) {
      setRequests((current) => current?.filter((r) => r.player.code !== code) ?? null);
      onChanged();
    }
  };

  return (
    <Sheet open={open} title="Demandes d'entrée" onClose={onClose}>
      {requests === null ? (
        <Text style={styles.small}>Un instant…</Text>
      ) : requests.length === 0 ? (
        <Text style={styles.empty}>Aucune demande en attente. Partage ton lien pour recruter.</Text>
      ) : (
        requests.map((request) => {
          const name = playerName(request.player);
          return (
            <View key={request.player.code} style={styles.request}>
              <View style={styles.requestHead}>
                <Avatar avatar={request.player.avatar} frame={null} size={40} />
                <View style={styles.headText}>
                  <Text style={styles.name}>{name}</Text>
                  <LevelMedal level={request.player.level} size={24} labelled />
                </View>
              </View>
              <Button
                label="Accepter"
                disabled={busy}
                onPress={() => void answer(request.player.code, name, true)}
              />
              <TextButton
                label="Refuser"
                disabled={busy}
                onPress={() => void answer(request.player.code, name, false)}
              />
            </View>
          );
        })
      )}
    </Sheet>
  );
}

/** The clan's options: change it (chief), the invitation code, report its name, leave. */
export function ClanSettings({
  view,
  open,
  onClose,
  onChanged,
  onLeft,
}: {
  readonly view: ClanView;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onChanged: () => void;
  readonly onLeft: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const me = view.me;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reopening starts afresh
  useEffect(() => {
    setLeaving(false);
    setError(null);
  }, [open]);

  if (me === null) return null;
  const clanId = view.clan.id;

  const save = async (value: Parameters<typeof api.updateClan>[1]) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.updateClan(clanId, value);
      if (result.kind === "ok") {
        toast("C'est changé.");
        profile.refresh();
        myClan.refresh();
        onChanged();
        onClose();
      } else {
        setError(refusalText(result.reason));
      }
    } catch {
      setError("Ça n'a pas marché. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const renew = async () => {
    setBusy(true);
    const ok = await act(
      () => api.renewInviteCode(clanId),
      "Nouveau code. L'ancien ne marche plus.",
    );
    setBusy(false);
    if (ok) onChanged();
  };

  const leave = async () => {
    setBusy(true);
    const ok = await act(
      () => api.leaveClan(),
      view.clan.memberCount <= 1 ? "Clan dissous." : "Tu as quitté le clan.",
    );
    setBusy(false);
    if (ok) {
      myClan.refresh();
      onClose();
      onLeft();
    }
  };

  return (
    <Sheet open={open} title={view.clan.name} onClose={onClose}>
      <View style={styles.group}>
        <Text style={styles.kicker}>CODE D'INVITATION</Text>
        <Text style={styles.inviteCode} selectable>
          {formatPlayerCode(me.inviteCode)}
        </Text>
        {canAct(me.role, "renew_invite") && (
          <TextButton label="Changer de code" disabled={busy} onPress={() => void renew()} />
        )}
      </View>

      {canAct(me.role, "edit_clan") && (
        <View style={styles.group}>
          <Text style={styles.kicker}>LE CLAN</Text>
          <ClanForm
            initial={{
              name: view.clan.name,
              motto: view.clan.motto,
              entryMode: view.clan.entryMode,
              emblem: view.clan.emblem,
            }}
            choices={view.emblemChoices}
            submitLabel="Enregistrer"
            busy={busy}
            error={error}
            onSubmit={(value) => void save(value)}
          />
        </View>
      )}

      {me.role !== "chief" && (
        <TextButton
          label="Signaler le nom du clan"
          disabled={busy}
          onPress={() =>
            void act(() => api.reportClanName(clanId), "Signalement envoyé. L'équipe va le lire.")
          }
        />
      )}

      <Button
        danger
        label={
          leaving
            ? `Oui : ${leaveLabel(view.clan.memberCount).toLowerCase()}`
            : leaveLabel(view.clan.memberCount)
        }
        disabled={busy}
        onPress={() => (leaving ? void leave() : setLeaving(true))}
      />
    </Sheet>
  );
}

/** It is read on a sheet, a leaf of paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.s8 },
  headText: { flex: 1, gap: space.s2 },
  small: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInkMuted,
  },
  role: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.rubric },
  name: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  group: { gap: space.s5 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s4 },
  empty: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.subtitle,
    lineHeight: 25,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  request: {
    gap: space.s4,
    padding: space.s7,
    borderRadius: radii.xxl,
    backgroundColor: ink.panel,
  },
  requestHead: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  inviteCode: {
    fontFamily: fonts.display,
    fontSize: fontSizes.heading,
    letterSpacing: 2,
    color: ink.pageInk,
  },
});
