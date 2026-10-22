"use client";

import type {
  ClanEntryMode,
  ClanSummary,
  CreateClanRequest,
  MyClanResponse,
} from "@leximon/contract";
import { CLAN_SCHEDULE, clanRulesAt } from "@leximon/core";
import {
  capitalize,
  clanSubline,
  entryModeLabel,
  isFeatureOpen,
  joinLabel,
  lockedToast,
  NO_CLAN_FOUND,
  NO_CLAN_YET,
} from "@leximon/view-model";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { myClan } from "@/player/clan";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import {
  type ClanResult,
  createClan,
  fetchClans,
  joinByCode,
  joinClan,
  withdrawRequest,
} from "./api";
import { refusalText } from "./chat";
import styles from "./clan.module.css";
import { ClanForm } from "./clan-form";
import { Emblem } from "./emblem";

const ENTRY_FILTERS: readonly (ClanEntryMode | undefined)[] = [
  undefined,
  "open",
  "request",
  "invite",
];

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
  const [query, setQuery] = useState("");
  const [entry, setEntry] = useState<ClanEntryMode | undefined>(undefined);
  const [clans, setClans] = useState<readonly ClanSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [code, setCode] = useState(presetCode ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const toast = useToast();

  const filter = useCallback(
    (cursorValue: string | null) => ({
      q: query.trim(),
      cursor: cursorValue,
      ...(entry === undefined ? {} : { entry }),
    }),
    [query, entry],
  );

  // Searches as the name is typed, once the player pauses.
  useEffect(() => {
    const timer = setTimeout(
      async () => {
        const page = await fetchClans(filter(null)).catch(() => null);
        setClans(page?.clans ?? []);
        setCursor(page?.nextCursor ?? null);
      },
      query === "" ? 0 : 300,
    );
    return () => clearTimeout(timer);
  }, [query, filter]);

  const more = async () => {
    if (cursor === null) return;
    const page = await fetchClans(filter(cursor)).catch(() => null);
    if (page === null) return;
    setClans((current) => [...(current ?? []), ...page.clans]);
    setCursor(page.nextCursor);
  };

  const settle = async (
    key: string,
    action: () => Promise<ClanResult<{ outcome: "joined" | "requested"; clanId: string }>>,
  ) => {
    setBusy(key);
    try {
      const result = await action();
      if (result.kind === "refused") {
        toast(refusalText(result.reason));
        return;
      }
      if (result.value.outcome === "joined") {
        onJoined(result.value.clanId);
        return;
      }
      toast("Demande envoyée.");
      myClan.publish({ ...mine, requests: [...mine.requests, result.value.clanId] });
    } catch {
      toast("Ça n'a pas marché. Réessaie.");
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (clanId: string) => {
    setBusy(clanId);
    const result = await withdrawRequest(clanId).catch(() => null);
    setBusy(null);
    if (result?.kind !== "ok") {
      toast("Ça n'a pas marché. Réessaie.");
      return;
    }
    myClan.publish({ ...mine, requests: mine.requests.filter((id) => id !== clanId) });
  };

  const enterByCode = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim() === "") return;
    void settle("code", () => joinByCode(code.trim()));
  };

  const found = async (value: CreateClanRequest) => {
    setBusy("create");
    setCreateError(null);
    try {
      const result = await createClan(value);
      if (result.kind === "ok") {
        setCreating(false);
        onJoined(result.value.clanId);
      } else {
        setCreateError(refusalText(result.reason));
      }
    } catch {
      setCreateError("Ça n'a pas marché. Réessaie.");
    } finally {
      setBusy(null);
    }
  };

  const rules = clanRulesAt(CLAN_SCHEDULE, now);
  const canCreate = isFeatureOpen("create_clan", level, now);

  return (
    <main className={styles.screen}>
      <header className={styles.findHeader}>
        <h1 className={`${ui.display} ${styles.title}`}>Trouve ton clan</h1>
        <Button
          variant={canCreate ? "primary" : "secondary"}
          onClick={() => (canCreate ? setCreating(true) : toast(lockedToast("create_clan", now)))}
        >
          <Icon name={canCreate ? "plus" : "lock"} size={18} />
          Fonder un clan
        </Button>
      </header>

      <div className={styles.findGrid}>
        <section>
          <label className={styles.search}>
            <Icon name="search" size={18} />
            <span className={styles.visuallyHidden}>Nom du clan</span>
            <input
              className={styles.searchInput}
              value={query}
              maxLength={30}
              placeholder="Nom du clan"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className={`${styles.chips} ${styles.entryFilter}`}>
            {ENTRY_FILTERS.map((mode) => (
              <button
                key={mode ?? "all"}
                type="button"
                className={ui.chip}
                aria-pressed={entry === mode}
                onClick={() => setEntry(mode)}
              >
                {mode === undefined ? "Tous" : capitalize(entryModeLabel(mode))}
              </button>
            ))}
          </div>
          {clans === null ? (
            <p className={styles.faint}>Un instant…</p>
          ) : clans.length === 0 ? (
            <p className={styles.emptyThread}>
              <em>{query.trim() === "" ? NO_CLAN_YET : NO_CLAN_FOUND}</em>
            </p>
          ) : (
            <ul className={styles.clanList}>
              {clans.map((clan) => {
                const requested = mine.requests.includes(clan.id);
                return (
                  <li key={clan.id} className={`${ui.panel} ${styles.clanRow}`}>
                    <Emblem emblem={clan.emblem} size={44} />
                    <div className={styles.clanRowText}>
                      <p className={styles.clanRowName}>{clan.name}</p>
                      <p className={styles.small}>{clanSubline(clan)}</p>
                    </div>
                    {requested ? (
                      <Button
                        small
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => void withdraw(clan.id)}
                      >
                        Retirer ma demande
                      </Button>
                    ) : (
                      <Button
                        small
                        variant={clan.entryMode === "open" ? "primary" : "secondary"}
                        disabled={busy !== null || clan.entryMode === "invite"}
                        onClick={() => void settle(clan.id, () => joinClan(clan.id))}
                      >
                        {joinLabel(clan.entryMode, false)}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {cursor !== null && (
            <Button variant="ghost" onClick={() => void more()}>
              Voir plus de clans
            </Button>
          )}
        </section>

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
            <Button type="submit" disabled={busy !== null || code.trim() === ""}>
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
          busy={busy === "create"}
          error={createError}
          onSubmit={(value) => void found(value)}
        />
      </Dialog>
    </main>
  );
}
