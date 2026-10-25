"use client";

import type { PlayerBadge } from "@leximon/contract";
import { blockRefusalMessage, playerName, UNBLOCKED_TOAST } from "@leximon/view-model";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { useToast } from "@/ui/toast";
import styles from "./settings.module.css";
import { failureMessage } from "./use-profile-actions";

/** The players the player blocked, each one unblocked with a tap. */
export function BlocksDialog({
  open,
  onClose,
  onCount,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCount: (count: number) => void;
}) {
  const [players, setPlayers] = useState<readonly PlayerBadge[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setPlayers(null);
    api
      .fetchBlocks()
      .then((list) => {
        setPlayers(list);
        onCount(list.length);
      })
      .catch((error: unknown) => toast(failureMessage(error)));
  }, [open, onCount, toast]);

  const unblock = async (player: PlayerBadge) => {
    setBusy(player.code);
    try {
      const result = await api.setBlocked(player.code, false);
      if (result.kind === "refused") {
        toast(blockRefusalMessage(result.reason));
        return;
      }
      const rest = (players ?? []).filter((p) => p.code !== player.code);
      setPlayers(rest);
      onCount(rest.length);
      toast(UNBLOCKED_TOAST);
    } catch (error) {
      toast(failureMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} title="Joueurs bloqués" onClose={onClose} variant="center">
      <div className={styles.pad}>
        {players !== null && players.length === 0 && <p className={styles.muted}>Personne.</p>}
        {players !== null && players.length > 0 && (
          <ul className={styles.list}>
            {players.map((player) => (
              <li key={player.code} className={styles.row}>
                <Avatar avatar={player.avatar} frame={player.frame} size={40} />
                <span className={styles.rowName}>{playerName(player)}</span>
                <Button
                  variant="secondary"
                  small
                  disabled={busy !== null}
                  onClick={() => void unblock(player)}
                >
                  Débloquer
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
