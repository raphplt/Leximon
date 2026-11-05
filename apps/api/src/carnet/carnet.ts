import type {
  BoosterWalletResponse,
  CarnetRefusal,
  CarnetResponse,
  LevelRewardView,
} from "@leximon/contract";
import {
  CARNET_SCHEDULE,
  type CarnetRules,
  carnetPages,
  carnetPeriodOf,
  carnetRewards,
  carnetRulesAt,
  type EpochMs,
  gameDayOf,
  type LevelReward,
  nextCarnetCase,
  rewardEcus,
  WELCOME_SCHEDULE,
  welcomeRulesAt,
} from "@leximon/core";
import { type Database, type EcuMovementDetails, schema } from "@leximon/db";
import { eq, sql, type WithSubquery } from "drizzle-orm";
import { lockWallet, walletView, withRewards } from "../levels/rewards";
import { readPlayedDays } from "../progress/streak";

const { boosterWallets, ecuMovements, guestLinks, userCarnetCases, userWelcomeDays, users } =
  schema;

/**
 * Where the player's carnet stands, in one round trip and the days played: whether they have an
 * account, the day the welcome week ended (the carnet starts after it) and the cases claimed.
 */
async function readStanding(db: Pick<Database, "execute">, userId: string, now: EpochMs) {
  const lastWelcomeDay = welcomeRulesAt(WELCOME_SCHEDULE, now).days.length;
  const result = await db.execute<{
    guest: boolean;
    archived: boolean;
    welcome_ended: string | null;
    claims: { period: number; case: number; rewards: LevelReward[] }[];
  }>(sql`
    select
      coalesce((select ${users.isAnonymous} from ${users} where ${users.id} = ${userId}), true)
        as guest,
      exists (select 1 from ${guestLinks} where ${guestLinks.guestId} = ${userId}) as archived,
      (select ${userWelcomeDays.claimedOn}::text from ${userWelcomeDays}
        where ${userWelcomeDays.userId} = ${userId} and ${userWelcomeDays.day} = ${lastWelcomeDay})
        as welcome_ended,
      coalesce((select json_agg(json_build_object('period', ${userCarnetCases.period},
          'case', ${userCarnetCases.case}, 'rewards', ${userCarnetCases.rewards}))
        from ${userCarnetCases} where ${userCarnetCases.userId} = ${userId}), '[]'::json) as claims
  `);
  const row = result.rows[0];
  if (row === undefined) throw new Error("Carnet lookup returned no row");
  return row;
}

function pagesOf(
  rules: CarnetRules,
  standing: Awaited<ReturnType<typeof readStanding>>,
  played: ReadonlySet<string>,
  today: string,
) {
  return carnetPages(
    rules,
    standing.guest ? null : standing.welcome_ended,
    played,
    standing.claims,
    today,
  );
}

/** The player's carnet: the current period, its cases, and the next case to claim. */
export async function readCarnet(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<CarnetResponse> {
  const rules = carnetRulesAt(CARNET_SCHEDULE, now);
  const today = gameDayOf(now).key;
  const [standing, played] = await Promise.all([
    readStanding(db, userId, now),
    readPlayedDays(db, userId),
  ]);
  const pages = pagesOf(rules, standing, played, today);
  const period = carnetPeriodOf(rules, today);
  const current = pages.find((page) => page.period.index === period.index);
  return {
    account: !standing.guest,
    started: !standing.guest && standing.welcome_ended !== null,
    cases: rules.cases.map((rewards) => [...rewards]),
    period,
    earned: current?.earned ?? 0,
    claimed: current?.claimed ?? 0,
    next: nextCarnetCase(pages),
    waiting: pages.reduce((sum, page) => sum + page.earned - page.claimed, 0),
  };
}

export type CarnetClaimResult =
  | {
      readonly kind: "claimed";
      readonly period: number;
      readonly case: number;
      readonly rewards: readonly LevelRewardView[];
      readonly wallet: BoosterWalletResponse;
    }
  | { readonly kind: "refused"; readonly reason: CarnetRefusal }
  | { readonly kind: "guest_archived" };

/**
 * Claims a case of the carnet. Idempotent by nature: the period and the case are the key, a
 * second claim of the same case returns what the first one gave. Cases are claimed in order
 * within a period, each earned by a day played; a case whose sachets do not fit in the reserve
 * waits (`reserve_full`).
 *
 * One transaction, the wallet locked first as for every reward: BEGIN, lock the wallet, the
 * account and claims lookup and the days played, one combined write (the case, the reserve and
 * the écus with their movement), COMMIT.
 */
export async function claimCarnetCase(
  db: Database,
  input: {
    readonly userId: string;
    readonly period: number;
    readonly case: number;
    readonly now: EpochMs;
  },
): Promise<CarnetClaimResult> {
  const { userId, period, now } = input;
  const caseNumber = input.case;
  const rules = carnetRulesAt(CARNET_SCHEDULE, now);
  const today = gameDayOf(now).key;

  return db.transaction(async (tx): Promise<CarnetClaimResult> => {
    const locked = await lockWallet(tx, userId, now);
    // After the lock: sees a case claimed by a concurrent request.
    const standing = await readStanding(tx, userId, now);
    const previous = standing.claims.find(
      (claim) => claim.period === period && claim.case === caseNumber,
    );
    if (previous !== undefined) {
      return {
        kind: "claimed",
        period,
        case: caseNumber,
        rewards: previous.rewards,
        wallet: walletView(locked, now),
      };
    }
    if (standing.archived) return { kind: "guest_archived" };
    if (standing.guest) return { kind: "refused", reason: "account_required" };

    const played = await readPlayedDays(tx, userId);
    const page = pagesOf(rules, standing, played, today).find(
      (candidate) => candidate.period.index === period,
    );
    if (page === undefined || page.claimed + 1 !== caseNumber || caseNumber > page.earned) {
      return { kind: "refused", reason: "not_open" };
    }

    const rewards = [...carnetRewards(rules, caseNumber)];
    const reserved = withRewards(locked, rewards, locked.reserveSlots, now);
    if (reserved === null) return { kind: "refused", reason: "reserve_full" };
    const ecus = rewardEcus(rewards);
    const after = { ...reserved, ecus: reserved.ecus + ecus };

    const claimInsert = tx.$with("claim_insert").as(
      tx
        .insert(userCarnetCases)
        .values({ userId, period, case: caseNumber, rewards, claimedAt: new Date(now) })
        .returning({ period: userCarnetCases.period }),
    );
    const ctes: WithSubquery[] = [claimInsert];
    if (ecus > 0) {
      const details: EcuMovementDetails = { kind: "carnet", period, case: caseNumber };
      ctes.push(
        tx.$with("movement_insert").as(
          tx
            .insert(ecuMovements)
            .values({
              id: crypto.randomUUID(),
              userId,
              kind: "carnet",
              amount: ecus,
              idempotencyKey: crypto.randomUUID(),
              details,
              createdAt: new Date(now),
            })
            .returning({ userId: ecuMovements.userId }),
        ),
      );
    }
    await tx
      .with(...ctes)
      .update(boosterWallets)
      .set(after)
      .where(eq(boosterWallets.userId, userId));
    return { kind: "claimed", period, case: caseNumber, rewards, wallet: walletView(after, now) };
  });
}
