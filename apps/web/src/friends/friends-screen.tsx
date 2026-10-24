"use client";

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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useNow } from "@/lib/use-now";
import { friends } from "@/player/friends";
import { useShared, useSharedFailed } from "@/player/resource";
import { PseudoDialog } from "@/profile/pseudo-dialog";
import { usePlayerView } from "@/shell/use-player-view";
import { Button, ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { Bone, WaitingScreen } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import { acceptFriend, askFriend, cancelFriendRequest, declineFriend, fetchReferrer } from "./api";
import { FriendFeed } from "./feed";
import { FriendSearch } from "./friend-search";
import { FriendSheet } from "./friend-sheet";
import styles from "./friends.module.css";
import { Podium } from "./podium";
import { useFriendAction } from "./use-friend-action";

/** Amis: requests, the friend link, the weekly podium, the list and the feed. */
export function FriendsScreen() {
  const view = usePlayerView();
  const data = useShared(friends);
  const failed = useSharedFailed(friends);
  const now = useNow(30_000);
  const [pseudoOpen, setPseudoOpen] = useState(false);
  const [chosen, setChosen] = useState<Friend | null>(null);

  useEffect(() => friends.refresh(), []);

  if (view.guest) {
    return (
      <main className={styles.screen}>
        <h1 className={`${ui.display} ${styles.title}`}>{FRIENDS_TITLE}</h1>
        <section className={`${ui.panel} ${styles.card} ${styles.lone}`}>
          <Icon name="amis" size={40} />
          <p className={styles.hint}>{FRIENDS_GUEST}</p>
          <ButtonLink href="/compte">Créer mon compte</ButtonLink>
        </section>
      </main>
    );
  }
  if (data === null && failed) {
    return (
      <main className={styles.screen}>
        <LoadFailed onRetry={() => friends.ensure()} />
      </main>
    );
  }
  if (data === null || view.profile === null || now === 0) {
    return (
      <WaitingScreen className={styles.screen}>
        <Bone className={styles.titleBone} />
        <Bone className={styles.cardBone} />
        <Bone className={styles.cardBone} />
      </WaitingScreen>
    );
  }

  const hasPseudo = view.profile.pseudo !== null;
  // Once there are friends, they come first; before that, the ways to get some.
  const hasFriends = data.friends.length > 0;
  const list = <FriendList friends={data.friends} now={now} onChoose={setChosen} />;
  const adding = hasPseudo ? (
    <>
      <FriendLink code={data.link.code} placesLeft={data.link.betaPlacesLeft} />
      <AddByPseudo />
    </>
  ) : (
    <section className={`${ui.panel} ${styles.card}`}>
      <p className={styles.hint}>{FRIENDS_PSEUDO_FIRST}</p>
      <Button small onClick={() => setPseudoOpen(true)}>
        Choisir mon pseudo
      </Button>
    </section>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <h1 className={`${ui.display} ${styles.title}`}>{FRIENDS_TITLE}</h1>
        <span className={styles.small}>
          {friendsCountLabel(data.friends.length, data.maxFriends)}
        </span>
      </header>

      <div className={styles.columns}>
        <div className={styles.column}>
          <AddFromLink />
          {data.incoming.length > 0 && <Incoming requests={data.incoming} />}

          {hasFriends && list}
          {adding}
          {!hasFriends && list}

          {data.outgoing.length > 0 && <Outgoing requests={data.outgoing} />}
        </div>

        <div className={styles.column}>
          <Podium alone={data.friends.length === 0} now={now} />
          <FriendFeed now={now} />
        </div>
      </div>

      <FriendSheet friend={chosen} now={now} onClose={() => setChosen(null)} />
      <PseudoDialog open={pseudoOpen} onClose={() => setPseudoOpen(false)} />
    </main>
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
    <section className={`${ui.panel} ${styles.card}`}>
      <p className={ui.kicker}>Tes amis</p>
      {list.length === 0 && <p className={styles.empty}>{FRIENDS_EMPTY}</p>}
      {view.searchable && (
        <div className={styles.search}>
          <FriendSearch value={query} onChange={setQuery} />
          <div className={styles.filters}>
            {view.filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className={styles.reaction}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {view.empty !== null && <p className={styles.empty}>{view.empty}</p>}
      {view.shown.length > 0 && (
        <ul className={styles.list}>
          {view.shown.map((friend) => (
            <li key={friend.player.code}>
              <button type="button" className={styles.row} onClick={() => onChoose(friend)}>
                <span className={styles.rowAvatar}>
                  <Avatar avatar={friend.player.avatar} frame={null} size={44} />
                  {friend.online && <span className={styles.online} />}
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowName}>
                    {playerName(friend.player)}
                    {friend.crowned && (
                      <span className={styles.crown} title="Premier la semaine passée">
                        <Icon name="crown" size={14} />
                      </span>
                    )}
                  </span>
                  <span className={styles.small}>{friendLine(friend, now)}</span>
                </span>
                {tradesLabel(friend.trades) !== null && (
                  <span className={`${ui.chip} ${ui.chipGold} ${styles.trades}`}>
                    <Icon name="echange" size={15} />
                    {tradesLabel(friend.trades)}
                  </span>
                )}
                <Icon name="chev" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {view.folded > 0 && (
        <Button variant="ghost" small onClick={() => setUnfolded(true)}>
          {unfoldLabel(view.folded)}
        </Button>
      )}
    </section>
  );
}

/** Past a few requests, the rest waits behind a button: the page is not a queue. */
const REQUESTS_SHOWN = 3;

function Incoming({ requests }: { readonly requests: readonly FriendRequest[] }) {
  const act = useFriendAction();
  const [busy, setBusy] = useState<string | null>(null);
  const [unfolded, setUnfolded] = useState(false);
  const shown = unfolded ? requests : requests.slice(0, REQUESTS_SHOWN);

  const answer = async (request: FriendRequest, accept: boolean) => {
    const code = request.player.code;
    setBusy(code);
    const name = playerName(request.player);
    await (accept
      ? act(
          () => acceptFriend(code),
          () => `${name} et toi, vous êtes amis.`,
        )
      : act(
          () => declineFriend(code),
          () => null,
        ));
    setBusy(null);
  };

  return (
    <section className={`${ui.panel} ${styles.card} ${styles.incoming}`}>
      <p className={ui.kicker}>
        {requests.length > 1 ? `${requests.length} demandes d'ami` : "Une demande d'ami"}
      </p>
      <ul className={styles.list}>
        {shown.map((request) => (
          <li key={request.player.code} className={styles.requestRow}>
            <Avatar avatar={request.player.avatar} frame={null} size={40} />
            <span className={styles.rowText}>
              <span className={styles.rowName}>{playerName(request.player)}</span>
              <span className={styles.small}>niv. {request.player.level}</span>
            </span>
            <span className={styles.requestActions}>
              <Button small disabled={busy !== null} onClick={() => void answer(request, true)}>
                Accepter
              </Button>
              <Button
                variant="ghost"
                small
                disabled={busy !== null}
                onClick={() => void answer(request, false)}
              >
                Refuser
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {shown.length < requests.length && (
        <Button variant="ghost" small onClick={() => setUnfolded(true)}>
          {unfoldLabel(requests.length - shown.length)}
        </Button>
      )}
    </section>
  );
}

function Outgoing({ requests }: { readonly requests: readonly FriendRequest[] }) {
  const act = useFriendAction();
  return (
    <details className={`${ui.panel} ${styles.card} ${styles.outgoing}`}>
      <summary className={styles.summary}>
        {requests.length > 1 ? `${requests.length} demandes envoyées` : "Une demande envoyée"}
        <Icon name="chevd" size={16} />
      </summary>
      <ul className={styles.list}>
        {requests.map((request) => (
          <li key={request.player.code} className={styles.requestRow}>
            <Avatar avatar={request.player.avatar} frame={null} size={36} />
            <span className={styles.rowText}>
              <span className={styles.rowName}>{playerName(request.player)}</span>
            </span>
            <Button
              variant="ghost"
              small
              onClick={() =>
                void act(
                  () => cancelFriendRequest(request.player.code),
                  () => "Demande annulée.",
                )
              }
            >
              Annuler
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function FriendLink({
  code,
  placesLeft,
}: {
  readonly code: string;
  readonly placesLeft: number | null;
}) {
  const toast = useToast();
  const places = betaPlacesLabel(placesLeft);

  const share = async () => {
    const text = friendLinkText(window.location.origin, code);
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Closed without sharing, or refused: the copy below still helps.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Lien copié.");
    } catch {
      toast(`Copie impossible. Ton lien : ${window.location.origin}/ami/${code}`);
    }
  };

  return (
    <section className={`${ui.panel} ${styles.card}`}>
      <p className={ui.kicker}>Ton lien d'ami</p>
      <p className={styles.linkLine}>
        Qui arrive par ton lien devient ton ami. Au niveau 5, un sachet bonus pour chacun.
      </p>
      {places !== null && <p className={styles.small}>{places}</p>}
      <div className={styles.linkActions}>
        <Button small onClick={() => void share()}>
          <Icon name="share" size={17} />
          Partager mon lien
        </Button>
      </div>
    </section>
  );
}

function AddByPseudo() {
  const id = useId();
  const act = useFriendAction();
  const [pseudo, setPseudo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const typed = pseudo.trim();
    if (typed === "") return;
    setBusy(true);
    const sent = await act(
      () => askFriend({ pseudo: typed }),
      (value) => requestSentToast(value.outcome, value.player),
    );
    setBusy(false);
    if (sent) setPseudo("");
  };

  return (
    <section className={`${ui.panel} ${styles.card}`}>
      <form className={styles.addForm} onSubmit={(event) => void submit(event)}>
        <label htmlFor={id} className={ui.kicker}>
          Ajouter par pseudo
        </label>
        <div className={styles.addRow}>
          <input
            id={id}
            className={ui.field}
            type="text"
            autoComplete="off"
            maxLength={40}
            placeholder="Le pseudo exact"
            value={pseudo}
            onChange={(event) => setPseudo(event.target.value)}
          />
          <Button type="submit" small disabled={busy || pseudo.trim() === ""}>
            {busy ? "Envoi…" : "Envoyer la demande"}
          </Button>
        </div>
      </form>
    </section>
  );
}

/** `/amis?ajouter=<code>`, from a friend link followed by a player who already plays. */
function AddFromLink() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const act = useFriendAction();
  const [code] = useState(() => params.get("ajouter"));
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (params.get("ajouter") !== null) router.replace(pathname, { scroll: false });
  }, [params, router, pathname]);

  useEffect(() => {
    if (code === null) return;
    fetchReferrer(code)
      .then((referrer) => setPseudo(referrer?.player.pseudo ?? null))
      .catch(() => setPseudo(null));
  }, [code]);

  if (code === null || pseudo === null || done) return null;
  return (
    <section className={`${ui.panel} ${styles.card} ${styles.incoming}`}>
      <p className={styles.hint}>Ajouter {pseudo} en ami ?</p>
      <div className={styles.linkActions}>
        <Button
          small
          onClick={() =>
            void act(
              () => askFriend({ code }),
              (value) => requestSentToast(value.outcome, value.player),
            ).then(() => setDone(true))
          }
        >
          Envoyer la demande
        </Button>
        <Button variant="ghost" small onClick={() => setDone(true)}>
          Plus tard
        </Button>
      </div>
    </section>
  );
}
