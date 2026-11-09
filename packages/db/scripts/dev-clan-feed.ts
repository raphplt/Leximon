/**
 * `pnpm dev:clan-feed [clanName]`: resets the clan's discussion and journal, and replaces
 * it with a realistic, lively feed (members joining, legendary cards found, goal tiers,
 * friendly chat and mentions).
 *
 * Local database only: refuses any other host.
 */

import { parseArgs } from "node:util";
import { mentionCandidates, PSEUDO_SCHEDULE, pseudoRulesAt, resolveMentions } from "@leximon/core";
import { and, eq, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import {
  type ClanEventPayload,
  type ClanMention,
  clanMembers,
  clanMessages,
  clans,
} from "../src/schema/clan";
import { moderationReports, players } from "../src/schema/game";
import { mailLetters } from "../src/schema/mail";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

const { positionals } = parseArgs({
  allowPositionals: true,
});

const targetName = (positionals[0] ?? "Les Coquefredouilles").trim().toLowerCase();

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repository root.");
}
if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
  throw new Error("dev:clan-feed only runs against a local database.");
}

const { db, close } = createDb(url, { maxConnections: 1 });

try {
  const [clan] = await db
    .select({ id: clans.id, name: clans.name })
    .from(clans)
    .where(sql`lower(${clans.name}) = ${targetName}`);

  if (clan === undefined) {
    const allClans = await db.select({ name: clans.name }).from(clans);
    console.error(`Clan introuvable : "${targetName}".`);
    console.info("Clans existants :", allClans.map((c) => c.name).join(", "));
    process.exitCode = 1;
  } else {
    console.info(`Clan trouvé : ${clan.name} (${clan.id})`);

    const members = await db
      .select({
        userId: clanMembers.userId,
        pseudo: players.pseudo,
        pseudoKey: players.pseudoKey,
        role: clanMembers.role,
        joinedAt: clanMembers.joinedAt,
      })
      .from(clanMembers)
      .leftJoin(players, eq(players.userId, clanMembers.userId))
      .where(eq(clanMembers.clanId, clan.id));

    console.info(
      `${members.length} membres dans le clan :`,
      members.map((m) => m.pseudo ?? m.userId).join(", "),
    );

    const byPseudo = new Map<string, (typeof members)[number]>();
    for (const m of members) {
      if (m.pseudo) {
        byPseudo.set(m.pseudo.toLowerCase(), m);
      }
    }

    const getMember = (name: string) => {
      const found = byPseudo.get(name.toLowerCase());
      if (!found) {
        throw new Error(`Membre attendu "${name}" non trouvé dans le clan ${clan.name}.`);
      }
      return found;
    };

    // 1. Reset existing discussion & clean up references
    console.info("Suppression des anciens messages...");
    await db.delete(clanMessages).where(eq(clanMessages.clanId, clan.id));

    // Reset messageId on moderation reports for this clan
    await db
      .update(moderationReports)
      .set({ messageId: null })
      .where(eq(moderationReports.clanId, clan.id));

    // Clean up clan_mention mail letters for this clan
    await db
      .delete(mailLetters)
      .where(
        and(
          eq(mailLetters.kind, "clan_mention"),
          sql`${mailLetters.payload}->>'clanId' = ${clan.id}`,
        ),
      );

    // 2. Prepare mock feed items
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const HOUR = 60 * 60 * 1000;
    const MINUTE = 60 * 1000;

    const computeMentions = (body: string, time: number): ClanMention[] => {
      const candidates = mentionCandidates(body, pseudoRulesAt(PSEUDO_SCHEDULE, time).maxLength);
      if (candidates.length === 0) return [];
      const keyMap = new Map<string, string>();
      for (const m of members) {
        if (m.pseudoKey) {
          keyMap.set(m.pseudoKey, m.userId);
        }
      }
      return resolveMentions(candidates, keyMap);
    };

    const raphtest = getMember("Raphtest");
    const mirabelle = getMember("Mirabelle");
    const raph = getMember("Raph");
    const mobilette = getMember("Mobilette");
    const raph2 = getMember("raph2");
    const recette = getMember("Recette");

    // Anchor dates:
    // Some events ~18 days ago (clan founding), ~15 days ago, ~3 days ago (raph2/recette joining),
    // yesterday evening (weekly goal bronze reached), and today (discussion & legendary card).
    const tClanStart = new Date("2026-10-22T09:03:38Z").getTime();
    const tMobiletteJoin = new Date("2026-10-25T13:20:34Z").getTime();
    const tRaph2Join = new Date("2026-11-06T09:41:15Z").getTime();
    const tRecetteJoin = new Date("2026-11-06T10:42:32Z").getTime();

    // Yesterday evening: around 20:15 - 21:05 (matches "hier")
    const tYesterdayBronze = now - 1 * DAY - 2 * HOUR;
    const tYesterdayMsg1 = now - 1 * DAY - 100 * MINUTE;
    const tYesterdayMsg2 = now - 1 * DAY - 70 * MINUTE;

    // Today (matches "10:12", "11:45", etc.)
    const tTodayMsg1 = now - 6 * HOUR;
    const tTodayLegendary = now - 4 * HOUR - 50 * MINUTE;
    const tTodayMsg2 = now - 4 * HOUR - 45 * MINUTE;
    const tTodayMsg3 = now - 3 * HOUR;
    const tTodayMsg4 = now - 2 * HOUR;

    type FeedItem =
      | {
          readonly kind: "event";
          readonly event: ClanEventPayload;
          readonly eventKey?: string;
          readonly createdAt: Date;
        }
      | {
          readonly kind: "message";
          readonly authorId: string;
          readonly body: string;
          readonly createdAt: Date;
        };

    const feed: FeedItem[] = [
      // 18 days ago - clan creation & first members
      {
        kind: "event",
        event: { type: "joined", userId: raphtest.userId },
        createdAt: new Date(tClanStart),
      },
      {
        kind: "event",
        event: { type: "joined", userId: mirabelle.userId },
        createdAt: new Date(tClanStart + 56 * 1000),
      },
      {
        kind: "event",
        event: { type: "joined", userId: raph.userId },
        createdAt: new Date(tClanStart + 5 * HOUR),
      },
      {
        kind: "message",
        authorId: raph.userId,
        body: "Bienvenue aux Coquefredouilles ! On monte le clan tranquillement.",
        createdAt: new Date(tClanStart + 5 * HOUR + 2 * MINUTE),
      },
      {
        kind: "message",
        authorId: mirabelle.userId,
        body: "Merci pour l'invitation @Raph ! Hâte de voir ce qu'on va débloquer.",
        createdAt: new Date(tClanStart + 5 * HOUR + 4 * MINUTE),
      },
      {
        kind: "event",
        event: { type: "legendary", userId: mirabelle.userId, cardId: "antanagoge" },
        eventKey: `legendary:${mirabelle.userId}:antanagoge`,
        createdAt: new Date(tClanStart + 8 * HOUR),
      },
      {
        kind: "message",
        authorId: raphtest.userId,
        body: "Déjà une Légendaire, bien joué !",
        createdAt: new Date(tClanStart + 8 * HOUR + 2 * MINUTE),
      },

      // 15 days ago - Mobilette joins
      {
        kind: "event",
        event: { type: "joined", userId: mobilette.userId },
        createdAt: new Date(tMobiletteJoin),
      },
      {
        kind: "message",
        authorId: mobilette.userId,
        body: "Bonjour tout le monde ! J'ai quelques cartes des Fondateurs en double si besoin.",
        createdAt: new Date(tMobiletteJoin + 2 * MINUTE),
      },
      {
        kind: "message",
        authorId: mirabelle.userId,
        body: "Bienvenue @Mobilette ! Tu aurais un brisoir par hasard ?",
        createdAt: new Date(tMobiletteJoin + 5 * MINUTE),
      },
      {
        kind: "message",
        authorId: mobilette.userId,
        body: "Oui j'en ai deux ! Je te le garde pour un prochain échange.",
        createdAt: new Date(tMobiletteJoin + 7 * MINUTE),
      },

      // 3 days ago - raph2 & Recette join
      {
        kind: "event",
        event: { type: "joined", userId: raph2.userId },
        createdAt: new Date(tRaph2Join),
      },
      {
        kind: "event",
        event: { type: "joined", userId: recette.userId },
        createdAt: new Date(tRecetteJoin),
      },
      {
        kind: "message",
        authorId: recette.userId,
        body: "Salut la compagnie ! Belle petite équipe ici.",
        createdAt: new Date(tRecetteJoin + 30 * MINUTE),
      },
      {
        kind: "message",
        authorId: raph2.userId,
        body: "Bonjour à tous, ravi de rejoindre les Coquefredouilles !",
        createdAt: new Date(tRecetteJoin + 35 * MINUTE),
      },
      {
        kind: "message",
        authorId: mobilette.userId,
        body: "Bienvenue @raph2 et @Recette !",
        createdAt: new Date(tRecetteJoin + 2 * HOUR),
      },

      // Yesterday evening - Bronze tier reached
      {
        kind: "event",
        event: { type: "tier", week: "2026-11-02", tier: "bronze" },
        eventKey: "tier:2026-11-02:bronze",
        createdAt: new Date(tYesterdayBronze),
      },
      {
        kind: "message",
        authorId: recette.userId,
        body: "Palier de bronze validé sur le fil, bien joué à tous !",
        createdAt: new Date(tYesterdayMsg1),
      },
      {
        kind: "message",
        authorId: raph2.userId,
        body: "Super ! Hâte de récupérer le sachet bonus.",
        createdAt: new Date(tYesterdayMsg2),
      },

      // Today - Morning chat & fresh legendary
      {
        kind: "message",
        authorId: mobilette.userId,
        body: "Nouvelle semaine qui commence, on vise l'argent cette fois ?",
        createdAt: new Date(tTodayMsg1),
      },
      {
        kind: "event",
        event: { type: "legendary", userId: mobilette.userId, cardId: "talpinette" },
        eventKey: `legendary:${mobilette.userId}:talpinette`,
        createdAt: new Date(tTodayLegendary),
      },
      {
        kind: "message",
        authorId: mobilette.userId,
        body: "Oh jolie surprise du matin, une Légendaire au tirage !",
        createdAt: new Date(tTodayMsg2),
      },
      {
        kind: "message",
        authorId: raph2.userId,
        body: "Bien joué ! J'attaque mes séries de défis pour faire monter le compteur.",
        createdAt: new Date(tTodayMsg3),
      },
      {
        kind: "message",
        authorId: mobilette.userId,
        body: "Merci @raph2 ! J'en ferai quelques-uns ce soir après le boulot.",
        createdAt: new Date(tTodayMsg4),
      },
    ];

    const lastMessageByAuthor = new Map<string, Date>();

    for (const item of feed) {
      if (item.kind === "message") {
        const mentions = computeMentions(item.body, item.createdAt.getTime());
        await db.insert(clanMessages).values({
          clanId: clan.id,
          kind: "message",
          authorId: item.authorId,
          body: item.body,
          mentions: mentions.length === 0 ? null : mentions,
          createdAt: item.createdAt,
        });
        lastMessageByAuthor.set(item.authorId, item.createdAt);
      } else {
        await db.insert(clanMessages).values({
          clanId: clan.id,
          kind: "event",
          event: item.event,
          eventKey: item.eventKey,
          createdAt: item.createdAt,
        });
      }
    }

    // Update lastMessageAt for each member who posted
    for (const [userId, lastMessageAt] of lastMessageByAuthor.entries()) {
      await db
        .update(clanMembers)
        .set({ lastMessageAt })
        .where(and(eq(clanMembers.clanId, clan.id), eq(clanMembers.userId, userId)));
    }

    console.info(
      `✓ Discussion du clan réinitialisée avec succès (${feed.length} entrées insérées).`,
    );
  }
} finally {
  await close();
}
