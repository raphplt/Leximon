"use client";

import type { CreateClanRequest, MyClanResponse } from "@leximon/contract";
import { CLAN_SCHEDULE, clanRulesAt } from "@leximon/core";
import { isFeatureOpen, lockedToast } from "@leximon/view-model";
import { type FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import { refusalText } from "./chat";
import styles from "./clan.module.css";
import { ClanForm } from "./clan-form";
import { ClanList } from "./clan-list";
import { useJoinClan } from "./use-join-clan";

/**
 * Without a clan: find one by its name, enter by an invitation code, or found
 * one from the level that opens it.
 */
export function FindClan({
  mine,
  level,
  now,
  presetCode,
  onJoined,
}: {
  readonly mine: MyClanResponse;
  readonly level: number;
  readonly now: number;
  /** From an invitation link, `/clan?code=…`. */
  readonly presetCode: string | null;
  readonly onJoined: (clanId: string) => void;
}) {
  const [code, setCode] = useState(presetCode ?? "");
  const [founding, setFounding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const toast = useToast();
  const join = useJoinClan(mine, onJoined);

  const enterByCode = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim() === "") return;
    void join.enterByCode(code.trim());
  };

  const found = async (value: CreateClanRequest) => {
    setFounding(true);
    setCreateError(null);
    try {
      const result = await api.createClan(value);
      if (result.kind === "ok") {
        setCreating(false);
        onJoined(result.value.clanId);
      } else {
        setCreateError(refusalText(result.reason));
      }
    } catch {
      setCreateError("Ça n'a pas marché. Réessaie.");
    } finally {
      setFounding(false);
    }
  };

  const rules = clanRulesAt(CLAN_SCHEDULE, now);
  const canCreate = isFeatureOpen("create_clan", level, now);

  return (
    <main className={styles.screen}>
      <header className={styles.findHeader}>
        <h1 className={`${ui.display} ${styles.title}`}>Rejoindre un clan</h1>
        <Button
          variant={canCreate ? "primary" : "secondary"}
          onClick={() => (canCreate ? setCreating(true) : toast(lockedToast("create_clan", now)))}
        >
          <Icon name={canCreate ? "plus" : "lock"} size={18} />
          Fonder un clan
        </Button>
      </header>

      <div className={styles.findGrid}>
        <ClanList join={join} />

        <aside className={`${ui.panel} ${styles.codePanel}`}>
          <p className={ui.kicker}>Un code d'invitation</p>
          <p className={styles.small}>Il ouvre n'importe quel clan, même sur invitation.</p>
          <form className={styles.codeForm} onSubmit={enterByCode}>
            <input
              className={ui.field}
              value={code}
              maxLength={20}
              placeholder="ABCD1234"
              aria-label="Code d'invitation"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <Button type="submit" disabled={join.busy !== null || code.trim() === ""}>
              Entrer
            </Button>
          </form>
        </aside>
      </div>

      <Dialog open={creating} title="Fonder un clan" onClose={() => setCreating(false)}>
        <ClanForm
          initial={{
            name: "",
            motto: "",
            entryMode: "open",
            emblem: {
              engraving: rules.emblemEngravings[0] ?? "",
              colors: [rules.emblemColors[0] ?? "sang", rules.emblemColors[1] ?? "or"],
            },
          }}
          choices={{ engravings: rules.emblemEngravings, colors: rules.emblemColors }}
          submitLabel="Fonder le clan"
          busy={founding}
          error={createError}
          onSubmit={(value) => void found(value)}
        />
      </Dialog>
    </main>
  );
}
