"use client";

import type { ClanMember, ClanRole, ClanView } from "@leximon/contract";
import { canAct } from "@leximon/core";
import {
  formatPlayerCode,
  leaveLabel,
  memberLine,
  muteChoices,
  mutedUntilLabel,
  playerName,
  roleLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { myClan } from "@/player/clan";
import { profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import {
  answerRequest,
  type ClanResult,
  fetchRequests,
  handOver,
  kickMember,
  leaveClan,
  muteMember,
  renewInviteCode,
  reportClanName,
  setRole,
  updateClan,
} from "./api";
import { refusalText } from "./chat";
import styles from "./clan.module.css";
import { ClanForm } from "./clan-form";

/** Runs a clan action and says how it went: the refusal, or `done`. `true` on success. */
function useAct() {
  const toast = useToast();
  return async (action: () => Promise<ClanResult<unknown>>, done: string): Promise<boolean> => {
    try {
      const result = await action();
      if (result.kind === "ok") {
        toast(done);
        return true;
      }
      toast(refusalText(result.reason));
    } catch {
      toast("Ça n'a pas marché. Réessaie.");
    }
    return false;
  };
}

type Pending = "kick" | "hand_over" | null;

/** A member, and what the chief or a deputy may do to them (K-05, K-10). */
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
    <Dialog
      open={member !== null}
      title={member === null ? "Membre" : playerName(member.player)}
      onClose={onClose}
      variant="center"
    >
      {member !== null && (
        <MemberActions
          key={member.player.code}
          clanId={clanId}
          myRole={myRole}
          member={member}
          now={now}
          onChanged={onChanged}
        />
      )}
    </Dialog>
  );
}

function MemberActions({
  clanId,
  myRole,
  member,
  now,
  onChanged,
}: {
  readonly clanId: string;
  readonly myRole: ClanRole;
  readonly member: ClanMember;
  readonly now: number;
  readonly onChanged: () => void;
}) {
  const me = useShared(profile);
  const act = useAct();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const name = playerName(member.player);
  const code = member.player.code;
  const self = me?.playerCode === code;
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
    <div className={styles.sheet}>
      <div className={styles.sheetHead}>
        <Avatar avatar={member.player.avatar} frame={member.player.frame} size={72} />
        <div>
          <p className={styles.small}>{now > 0 && memberLine(member, now)}</p>
          {role !== null && <p className={styles.sheetRole}>{role}</p>}
          {muted && member.mutedUntil !== null && (
            <p className={styles.small}>{mutedUntilLabel(member.mutedUntil, now)}</p>
          )}
        </div>
      </div>

      {member.player.pseudo !== null && (
        <Link
          href={`/joueur/${encodeURIComponent(member.player.pseudo)}`}
          className={`${ui.secondary} ${ui.small}`}
        >
          Voir son profil
        </Link>
      )}

      {!self && canAct(myRole, "appoint_deputy") && target !== "chief" && (
        <Button
          variant="secondary"
          small
          disabled={busy}
          onClick={() =>
            void run(
              () => setRole(clanId, code, target === "deputy" ? "member" : "deputy"),
              target === "deputy" ? `${name} n'est plus adjoint.` : `${name} devient adjoint.`,
            )
          }
        >
          {target === "deputy" ? "Retirer le rôle d'adjoint" : "Nommer adjoint"}
        </Button>
      )}

      {!self && canAct(myRole, "mute", target) && (
        <div className={styles.sheetGroup}>
          <p className={ui.kicker}>Rendre muet</p>
          <div className={styles.chips}>
            {muteChoices(now).map((choice) => (
              <button
                key={choice.durationMs}
                type="button"
                className={ui.chip}
                disabled={busy}
                onClick={() =>
                  void run(
                    () => muteMember(clanId, code, choice.durationMs),
                    `${name} se tait pour ${choice.label}.`,
                  )
                }
              >
                {choice.label}
              </button>
            ))}
            {muted && (
              <button
                type="button"
                className={ui.chip}
                disabled={busy}
                onClick={() =>
                  void run(() => muteMember(clanId, code, null), `${name} peut reparler.`)
                }
              >
                Lever le silence
              </button>
            )}
          </div>
        </div>
      )}

      {!self && canAct(myRole, "hand_over", target) && (
        <Button
          variant="secondary"
          small
          disabled={busy}
          onClick={() =>
            pending === "hand_over"
              ? void run(() => handOver(clanId, code), `${name} prend la tête du clan.`)
              : setPending("hand_over")
          }
        >
          {pending === "hand_over" ? `Oui, ${name} devient chef` : "Lui passer la tête du clan"}
        </Button>
      )}

      {!self && canAct(myRole, "kick", target) && (
        <Button
          variant="ghost"
          small
          className={styles.danger}
          disabled={busy}
          onClick={() =>
            pending === "kick"
              ? void run(() => kickMember(clanId, code), `${name} est exclu.`)
              : setPending("kick")
          }
        >
          {pending === "kick" ? `Oui, exclure ${name}` : "Exclure du clan"}
        </Button>
      )}
    </div>
  );
}

/** Requests to enter, for the chief and the deputies (K-10). */
export function RequestsDialog({
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
  const [requests, setRequests] = useState<
    Awaited<ReturnType<typeof fetchRequests>>["requests"] | null
  >(null);
  const [busy, setBusy] = useState(false);
  const act = useAct();

  useEffect(() => {
    if (!open) return;
    setRequests(null);
    fetchRequests(clanId)
      .then((page) => setRequests(page.requests))
      .catch(() => setRequests([]));
  }, [open, clanId]);

  const answer = async (code: string, name: string, accept: boolean) => {
    setBusy(true);
    const ok = await act(
      () => answerRequest(clanId, code, accept),
      accept ? `${name} entre dans le clan.` : "Demande refusée.",
    );
    setBusy(false);
    if (ok) {
      setRequests((current) => current?.filter((r) => r.player.code !== code) ?? null);
      onChanged();
    }
  };

  return (
    <Dialog open={open} title="Demandes d'entrée" onClose={onClose}>
      {requests === null ? (
        <p className={styles.faint}>Un instant…</p>
      ) : requests.length === 0 ? (
        <p className={styles.emptyThread}>
          <em>Personne ne frappe. Partage ton lien.</em>
        </p>
      ) : (
        <ul className={styles.requests}>
          {requests.map((request) => {
            const name = playerName(request.player);
            return (
              <li key={request.player.code} className={styles.request}>
                <Avatar avatar={request.player.avatar} frame={null} size={40} />
                <span className={styles.memberText}>
                  <span className={styles.memberName}>{name}</span>
                  <span className={styles.small}>niv. {request.player.level}</span>
                </span>
                <Button
                  small
                  disabled={busy}
                  onClick={() => void answer(request.player.code, name, true)}
                >
                  Accepter
                </Button>
                <Button
                  small
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void answer(request.player.code, name, false)}
                >
                  Refuser
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

/** The clan's options: change it (chief), the invitation code, report its name, leave (K-11). */
export function ClanSettings({
  view,
  open,
  now,
  onClose,
  onChanged,
  onLeft,
}: {
  readonly view: ClanView;
  readonly open: boolean;
  readonly now: number;
  readonly onClose: () => void;
  readonly onChanged: () => void;
  readonly onLeft: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const act = useAct();
  const toast = useToast();
  const me = view.me;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reopening starts afresh
  useEffect(() => {
    setLeaving(false);
    setError(null);
  }, [open]);

  if (me === null) return null;
  const clanId = view.clan.id;

  const save = async (value: Parameters<typeof updateClan>[1]) => {
    setBusy(true);
    setError(null);
    try {
      const result = await updateClan(clanId, value);
      if (result.kind === "ok") {
        toast("C'est changé.");
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
    const ok = await act(() => renewInviteCode(clanId), "Nouveau code. L'ancien ne marche plus.");
    setBusy(false);
    if (ok) onChanged();
  };

  const leave = async () => {
    setBusy(true);
    const ok = await act(
      () => leaveClan(),
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
    <Dialog open={open} title={view.clan.name} onClose={onClose}>
      <div className={styles.settings}>
        <div className={styles.sheetGroup}>
          <p className={ui.kicker}>Code d'invitation</p>
          <p className={`${ui.display} ${styles.inviteCode}`}>{formatPlayerCode(me.inviteCode)}</p>
          {canAct(me.role, "renew_invite") && (
            <Button variant="ghost" small disabled={busy} onClick={() => void renew()}>
              Changer de code
            </Button>
          )}
        </div>

        {canAct(me.role, "edit_clan") && (
          <div className={styles.sheetGroup}>
            <p className={ui.kicker}>Le clan</p>
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
          </div>
        )}

        {me.role !== "chief" && (
          <Button
            variant="ghost"
            small
            disabled={busy}
            onClick={() => void act(() => reportClanName(clanId), "Signalé. On regarde.")}
          >
            Signaler le nom du clan
          </Button>
        )}

        <Button
          variant="ghost"
          className={styles.danger}
          disabled={busy || now === 0}
          onClick={() => (leaving ? void leave() : setLeaving(true))}
        >
          {leaving
            ? `Oui : ${leaveLabel(view.clan.memberCount).toLowerCase()}`
            : leaveLabel(view.clan.memberCount)}
        </Button>
      </div>
    </Dialog>
  );
}
