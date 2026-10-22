"use client";

import type { Sanction } from "@leximon/contract";
import { CONTEST_HINT, contestState, sanctionTitle, sanctionUntil } from "@leximon/view-model";
import { type FormEvent, useState } from "react";
import { contestSanction, markSanctionsSeen } from "@/clan/api";
import { sanctions } from "@/player/clan";
import { useShared } from "@/player/resource";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./panels.module.css";

/**
 * A sanction the player has not read yet: what was done, why, until when, and how to
 * contest it (DSA). Opens over any screen; closing it marks them read.
 */
export function SanctionDialog({ now }: { readonly now: number }) {
  const all = useShared(sanctions);
  const [closed, setClosed] = useState(false);
  const unseen = all?.filter((sanction) => !sanction.seen) ?? [];

  const close = () => {
    setClosed(true);
    if (all !== null) sanctions.publish(all.map((sanction) => ({ ...sanction, seen: true })));
    void markSanctionsSeen().catch(() => undefined);
  };

  return (
    <Dialog
      open={!closed && unseen.length > 0 && now > 0}
      title={unseen.length > 1 ? "Des sanctions te concernent" : "Une sanction te concerne"}
      onClose={close}
      variant="center"
    >
      <div className={styles.sanctions}>
        {unseen.map((sanction) => (
          <SanctionCard key={sanction.id} sanction={sanction} now={now} />
        ))}
        <Button wide onClick={close}>
          J'ai lu
        </Button>
      </div>
    </Dialog>
  );
}

export function SanctionCard({
  sanction,
  now,
}: {
  readonly sanction: Sanction;
  readonly now: number;
}) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const until = sanctionUntil(sanction, now);
  const state = contestState(sanction);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (text.trim() === "") return;
    setBusy(true);
    try {
      const sent = await contestSanction(sanction.id, text.trim());
      toast(sent ? "Contestation envoyée." : "Cette sanction ne se conteste plus.");
      const current = sanctions.current();
      if (current !== null) {
        sanctions.publish(
          current.map((s) =>
            s.id === sanction.id
              ? {
                  ...s,
                  contestable: false,
                  contestedAt: sent ? new Date().toISOString() : s.contestedAt,
                }
              : s,
          ),
        );
      }
      setWriting(false);
    } catch {
      toast("Pas envoyé. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={styles.sanction}>
      <h3 className={styles.sanctionTitle}>{sanctionTitle(sanction.kind)}</h3>
      <p className={styles.sanctionReason}>{sanction.reason}</p>
      {sanction.content !== null && (
        <blockquote className={styles.sanctionContent}>« {sanction.content} »</blockquote>
      )}
      {until !== null && <p className={styles.letterDetail}>{until}</p>}
      {state !== null && <p className={styles.letterDetail}>{state}</p>}
      {sanction.contestable &&
        (writing ? (
          <form className={styles.contestForm} onSubmit={(event) => void send(event)}>
            <label className={styles.letterDetail}>
              {CONTEST_HINT}
              <textarea
                className={`${ui.field} ${styles.contestText}`}
                value={text}
                maxLength={2000}
                rows={4}
                onChange={(event) => setText(event.target.value)}
              />
            </label>
            <Button type="submit" small disabled={busy || text.trim() === ""}>
              Envoyer ma contestation
            </Button>
          </form>
        ) : (
          <Button variant="secondary" small onClick={() => setWriting(true)}>
            Contester
          </Button>
        ))}
    </article>
  );
}
