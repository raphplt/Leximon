"use client";

import type { ClanView } from "@leximon/contract";
import { onlineCountLabel } from "@leximon/view-model";
import { type ComponentProps, useEffect, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { useNow } from "@/lib/use-now";
import { myClan } from "@/player/clan";
import { useShared } from "@/player/resource";
import { ButtonLink } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { fetchClan } from "./api";
import { ClanChat } from "./chat";
import styles from "./clan.module.css";

/** The clan's discussion over the Jouer screen: a side panel, a sheet on a phone. */
export function ChatPanel({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const mine = useShared(myClan);
  const [view, setView] = useState<ClanView | null>(null);
  const now = useNow(30_000);
  const clanId = mine?.clanId ?? null;

  useEffect(() => {
    if (!open || clanId === null) return;
    fetchClan(clanId)
      .then(setView)
      .catch(() => setView(null));
  }, [open, clanId]);

  const me = view?.me ?? null;
  return (
    <Dialog open={open} title={view === null ? "Discussion" : view.clan.name} onClose={onClose}>
      {clanId === null ? (
        <div className={styles.sheet}>
          <p className={styles.emptyThread}>
            <em>Pas encore de clan, pas encore de bavardage.</em>
          </p>
          <ButtonLink href="/clan" onClick={onClose}>
            Trouver un clan
          </ButtonLink>
        </div>
      ) : view === null || me === null ? (
        <p className={styles.faint}>Un instant…</p>
      ) : (
        <ChatWithWords
          clanId={clanId}
          role={me.role}
          mutedUntil={me.mutedUntil}
          online={onlineCountLabel(view.members)}
          now={now}
          compact
        />
      )}
    </Dialog>
  );
}

/** The words of the chat's events come from the catalogue, read only once the panel is open. */
function ChatWithWords(props: Omit<ComponentProps<typeof ClanChat>, "wordOf">) {
  const catalog = useCatalog();
  return (
    <ClanChat {...props} wordOf={(cardId) => catalog?.cardsById.get(cardId)?.word ?? cardId} />
  );
}
