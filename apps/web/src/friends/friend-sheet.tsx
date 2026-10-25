"use client";

import type { Friend } from "@leximon/contract";
import { friendLine, playerName, tradesLabel } from "@leximon/view-model";
import { useState } from "react";
import { Emblem } from "@/clan/emblem";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { Button, ButtonLink } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import ui from "@/ui/ui.module.css";
import styles from "./friends.module.css";
import { useFriendAction } from "./use-friend-action";

/** A friend touched in the list: their profile, a trade, the albums side by side. */
export function FriendSheet({
  friend,
  now,
  onClose,
}: {
  readonly friend: Friend | null;
  readonly now: number;
  readonly onClose: () => void;
}) {
  return (
    <Dialog
      open={friend !== null}
      title={friend === null ? "Ami" : playerName(friend.player)}
      onClose={onClose}
      variant="center"
    >
      {friend !== null && (
        <FriendActions key={friend.player.code} friend={friend} now={now} onDone={onClose} />
      )}
    </Dialog>
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
  const act = useFriendAction();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const code = friend.player.code;
  const name = playerName(friend.player);
  const trades = tradesLabel(friend.trades);

  const remove = async () => {
    setBusy(true);
    const done = await act(
      () => api.removeFriend(code),
      () => `${name} n'est plus ton ami.`,
    );
    setBusy(false);
    if (done) onDone();
  };

  return (
    <div className={styles.sheet}>
      <div className={styles.sheetHead}>
        <Avatar avatar={friend.player.avatar} frame={friend.player.frame} size={72} />
        <div>
          <p className={styles.small}>{friendLine(friend, now)}</p>
          {friend.clan !== null && (
            <p className={styles.sheetClan}>
              <Emblem emblem={friend.clan.emblem} size={22} />
              {friend.clan.name}
            </p>
          )}
          {trades !== null && <p className={styles.sheetTrades}>{trades}</p>}
        </div>
      </div>

      {friend.player.pseudo !== null && (
        <ButtonLink
          variant="secondary"
          small
          href={`/joueur/${encodeURIComponent(friend.player.pseudo)}`}
        >
          Voir son profil
        </ButtonLink>
      )}
      <ButtonLink small href={`/echanges?avec=${code}`}>
        Proposer un échange
      </ButtonLink>
      <ButtonLink variant="secondary" small href={`/album?ami=${code}`}>
        Comparer nos albums
      </ButtonLink>
      <Button
        variant="ghost"
        small
        className={styles.danger}
        disabled={busy}
        onClick={() => (confirming ? void remove() : setConfirming(true))}
      >
        {confirming ? `Oui, retirer ${name}` : "Retirer de mes amis"}
      </Button>
      {confirming && (
        <p className={`${styles.small} ${ui.enter}`}>Sans prévenir, des deux côtés.</p>
      )}
    </div>
  );
}
