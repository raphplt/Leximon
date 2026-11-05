/**
 * `pnpm economy:snapshot` (or `economy:snapshot:prod`): the game's economy as players really live
 * it, for balancing. Sachets, cards, duplicates, challenges, XP and trades, per player-day and per
 * seniority, printed as Markdown.
 *
 * Read only (the transaction refuses any write) and aggregated: no id, pseudo or address is ever
 * printed, and a bucket of fewer than 3 players shows no figure.
 */

import { levelOf } from "@leximon/core";
import pg from "pg";

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repository root.");
}

const MIN_BUCKET = 3;

// Everyone seen at least one day, except admins and guests whose game moved to an account.
const COUNTED = `
  counted as (
    select u.id, min(d.day) as first_day, count(d.day)::int as days_played,
           max(d.day) as last_day, u.is_anonymous as guest
    from users u
    join player_days d on d.user_id = u.id
    where coalesce(u.role, '') <> 'admin'
      and not exists (select 1 from guest_links g where g.guest_id = u.id)
    group by u.id
  )`;

const PARIS_DAY = (column: string) => `(${column} at time zone 'Europe/Paris')::date`;

const QUERIES: readonly { title: string; note?: string; sql: string }[] = [
  {
    title: "Joueurs",
    sql: `with ${COUNTED}
      select count(*) as joueurs,
             count(*) filter (where not guest) as inscrits,
             min(first_day)::text as premier_jour, max(last_day)::text as dernier_jour,
             round(avg(days_played), 1) as jours_joues_moyens,
             percentile_cont(0.5) within group (order by days_played) as jours_joues_median
      from counted`,
  },
  {
    title: "Joueurs actifs par jour",
    sql: `with ${COUNTED}
      select d.day::text as jour, count(*) as actifs,
             count(*) filter (where d.day = c.first_day) as nouveaux
      from player_days d join counted c on c.id = d.user_id
      group by d.day order by d.day`,
  },
  {
    title: "Retour selon l'ancienneté",
    note: "Part des joueurs arrivés depuis assez longtemps qui reviennent le jour J (J0 = premier jour).",
    sql: `with ${COUNTED},
      today as (select max(day) as d from player_days)
      select k as jour_j,
             count(*) filter (where c.first_day + k <= (select d from today)) as eligibles,
             round(100.0 * count(*) filter (where exists (
               select 1 from player_days p where p.user_id = c.id and p.day = c.first_day + k))
               / nullif(count(*) filter (where c.first_day + k <= (select d from today)), 0), 1) as pct_revenus
      from counted c cross join (values (1), (2), (3), (5), (7)) v(k)
      group by k order by k`,
  },
  {
    title: "Jours joués par joueur",
    sql: `with ${COUNTED}
      select case when days_played = 1 then '1' when days_played = 2 then '2'
                  when days_played <= 4 then '3-4' when days_played <= 7 then '5-7' else '8+' end as jours,
             count(*) as joueurs
      from counted group by 1 order by min(days_played)`,
  },
  {
    title: "Sachets ouverts par jour joué",
    note: "Un jour joué compte même sans sachet. Gratuits, bonus et garnis séparés.",
    sql: `with ${COUNTED},
      per_day as (
        select d.user_id, d.day, (d.day = c.first_day) as first,
               count(o.id) as opens,
               count(o.id) filter (where not o.from_bonus and not o.garni) as free,
               count(o.id) filter (where o.from_bonus) as bonus,
               count(o.id) filter (where o.garni) as garni
        from player_days d join counted c on c.id = d.user_id
        left join booster_opens o on o.user_id = d.user_id and ${PARIS_DAY("o.opened_at")} = d.day
        group by d.user_id, d.day, c.first_day
      )
      select case when first then 'premier jour' else 'jours suivants' end as jour,
             count(*) as jours_joues,
             round(avg(opens), 1) as moyenne,
             percentile_cont(0.5) within group (order by opens) as mediane,
             percentile_cont(0.75) within group (order by opens) as p75,
             percentile_cont(0.9) within group (order by opens) as p90,
             max(opens) as max,
             round(100.0 * count(*) filter (where opens = 0) / nullif(count(*), 0), 1) as pct_sans_sachet,
             round(avg(free), 1) as gratuits, round(avg(bonus), 1) as bonus, round(avg(garni), 2) as garnis
      from per_day group by first order by first desc`,
  },
  {
    title: "Heures d'ouverture (heure de Paris)",
    sql: `with ${COUNTED}
      select extract(hour from o.opened_at at time zone 'Europe/Paris')::int as heure, count(*) as sachets
      from booster_opens o join counted c on c.id = o.user_id
      group by 1 order by 1`,
  },
  {
    title: "Séances : sachets ouverts d'affilée",
    note: "Une séance s'arrête après 20 minutes sans sachet. Le stock plein permet 6 sachets d'un coup.",
    sql: `with ${COUNTED},
      opens as (
        select o.user_id, o.opened_at,
               case when o.opened_at - lag(o.opened_at) over (partition by o.user_id order by o.opened_at)
                         < interval '20 minutes' then 0 else 1 end as starts
        from booster_opens o join counted c on c.id = o.user_id
      ),
      numbered as (select user_id, opened_at, sum(starts) over (partition by user_id order by opened_at) as session from opens),
      sessions as (select user_id, session, count(*) as opens from numbered group by 1, 2)
      select count(*) as seances, round(avg(opens), 1) as sachets_moyens,
             percentile_cont(0.5) within group (order by opens) as mediane,
             percentile_cont(0.9) within group (order by opens) as p90,
             round(100.0 * count(*) filter (where opens >= 6) / nullif(count(*), 0), 1) as pct_6_ou_plus
      from sessions`,
  },
  {
    title: "Cartes neuves selon le rang du sachet",
    note: "Part des cartes d'un sachet que le joueur n'avait jamais tirées, selon le nombre de sachets déjà ouverts.",
    sql: `with ${COUNTED},
      opens as (
        select o.user_id, o.opened_at, o.cards,
               row_number() over (partition by o.user_id order by o.opened_at) as rank
        from booster_opens o join counted c on c.id = o.user_id
      ),
      drawn as (
        select o.user_id, o.rank, x.card ->> 'cardId' as card_id,
               row_number() over (partition by o.user_id, x.card ->> 'cardId' order by o.opened_at, x.ord) as nth
        from opens o cross join lateral jsonb_array_elements(o.cards) with ordinality x(card, ord)
      )
      select case when rank <= 10 then '01-10' when rank <= 25 then '11-25' when rank <= 50 then '26-50'
                  when rank <= 100 then '51-100' when rank <= 200 then '101-200' else '201+' end as sachets,
             count(distinct user_id) as joueurs, count(*) as cartes,
             round(100.0 * count(*) filter (where nth = 1) / nullif(count(*), 0), 1) as pct_neuves
      from drawn group by 1 order by min(rank)`,
  },
  {
    title: "Raretés tirées",
    note: "À comparer aux probabilités P11 : 60, 25, 10, 4, 0,9 et 0,1 %.",
    sql: `with ${COUNTED}
      select x.card ->> 'rarity' as rarete, count(*) as cartes,
             round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 2) as pct
      from booster_opens o join counted c on c.id = o.user_id
      cross join lateral jsonb_array_elements(o.cards) x(card)
      group by 1 order by 2 desc`,
  },
  {
    title: "Album et doubles selon les jours joués",
    sql: `with ${COUNTED},
      album as (
        select uc.user_id, count(*) as distinct_cards, sum(uc.quantity) as copies,
               sum(uc.quantity - 1) as extra, count(*) filter (where uc.quantity >= 2) as with_double,
               count(*) filter (where uc.quantity >= 5) as five_plus
        from user_cards uc join counted c on c.id = uc.user_id group by uc.user_id
      )
      select case when c.days_played = 1 then '1' when c.days_played = 2 then '2'
                  when c.days_played <= 4 then '3-4' when c.days_played <= 7 then '5-7' else '8+' end as jours,
             count(*) as joueurs,
             percentile_cont(0.5) within group (order by coalesce(a.distinct_cards, 0)) as cartes_differentes,
             percentile_cont(0.5) within group (order by coalesce(a.copies, 0)) as exemplaires,
             percentile_cont(0.5) within group (order by coalesce(a.extra, 0)) as exemplaires_en_trop,
             percentile_cont(0.5) within group (order by coalesce(a.with_double, 0)) as cartes_avec_double,
             percentile_cont(0.5) within group (order by coalesce(a.five_plus, 0)) as cartes_5_exemplaires
      from counted c left join album a on a.user_id = c.id
      group by 1 order by min(c.days_played)`,
  },
  {
    title: "Défis par jour joué",
    note: "Révisions (comptent pour la mémoire) et entraînement. « Défi du jour » : au moins 5 réponses ce jour-là.",
    sql: `with ${COUNTED},
      per_day as (
        select d.user_id, d.day,
               (select count(*) from review_logs r where r.user_id = d.user_id and ${PARIS_DAY("r.reviewed_at")} = d.day) as reviews,
               (select count(*) from practice_answers p where p.user_id = d.user_id and ${PARIS_DAY("p.answered_at")} = d.day) as practice
        from player_days d join counted c on c.id = d.user_id
      )
      select count(*) as jours_joues,
             round(100.0 * count(*) filter (where reviews + practice > 0) / nullif(count(*), 0), 1) as pct_avec_defi,
             round(100.0 * count(*) filter (where reviews + practice >= 5) / nullif(count(*), 0), 1) as pct_5_reponses,
             round(avg(reviews), 1) as revisions_moyennes, round(avg(practice), 1) as entrainement_moyen,
             percentile_cont(0.5) within group (order by reviews + practice) as reponses_mediane,
             percentile_cont(0.9) within group (order by reviews + practice) as reponses_p90
      from per_day`,
  },
  {
    title: "Taux de bonnes réponses",
    sql: `with ${COUNTED}
      select 'révision' as sorte, count(*) as reponses, round(100.0 * avg(r.correct::int), 1) as pct_justes
      from review_logs r join counted c on c.id = r.user_id
      union all
      select 'entraînement', count(*), round(100.0 * avg(p.correct::int), 1)
      from practice_answers p join counted c on c.id = p.user_id`,
  },
  {
    title: "Sachets bonus gagnés",
    sql: `with ${COUNTED}
      select a.kind::text as sorte, count(*) as fois, sum(a.amount) as sachets, sum(a.credited) as credites
      from booster_bonus_awards a join counted c on c.id = a.user_id group by 1`,
  },
  {
    title: "Énigme du jour",
    sql: `with ${COUNTED}
      select count(*) as parties, count(distinct r.user_id) as joueurs,
             round(100.0 * count(*) / nullif((select count(*) from player_days d join counted c2 on c2.id = d.user_id
               where d.day >= (select min(day) from riddle_plays)), 0), 1) as pct_jours_joues,
             round(avg(r.step), 1) as etape_moyenne,
             round(100.0 * count(*) filter (where r.xp > 0) / nullif(count(*), 0), 1) as pct_trouvees
      from riddle_plays r join counted c on c.id = r.user_id`,
  },
  {
    title: "Mémoire des mots",
    sql: `with ${COUNTED}
      select m.level::text as palier, count(*) as mots, count(distinct m.user_id) as joueurs
      from user_mastery m join counted c on c.id = m.user_id group by 1 order by 1`,
  },
  {
    title: "Échanges",
    sql: `with ${COUNTED}
      select t.status::text as etat, count(*) as offres,
             count(distinct t.proposer_id) as proposeurs, count(distinct t.recipient_id) as destinataires
      from trades t where t.proposer_id in (select id from counted) or t.recipient_id in (select id from counted)
      group by 1 order by 2 desc`,
  },
  {
    title: "Social",
    sql: `with ${COUNTED}
      select count(*) as joueurs,
             count(*) filter (where exists (select 1 from friendships f where f.user_id = c.id)) as avec_un_ami,
             count(*) filter (where exists (select 1 from clan_members m where m.user_id = c.id)) as dans_un_clan,
             count(*) filter (where exists (select 1 from trades t where (t.proposer_id = c.id or t.recipient_id = c.id)
               and t.status = 'completed')) as un_echange_conclu,
             count(*) filter (where exists (select 1 from players p where p.user_id = c.id and p.pseudo is not null)) as avec_pseudo
      from counted c`,
  },
];

// Levels need the curve of packages/core: the XP comes back per player, but only buckets print.
const LEVELS_SQL = `with ${COUNTED}
  select c.days_played, coalesce(p.xp, 0) as xp, (c.last_day - c.first_day) as span
  from counted c left join user_progress p on p.user_id = c.id`;

type Row = Record<string, unknown>;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(Math.round(value * 100) / 100);
  return String(value).replace(/\|/g, "\\|");
}

/** A row about fewer than MIN_BUCKET players would describe someone: keep its label and size only. */
function masked(row: Row, columns: readonly string[]): Row {
  if (!("joueurs" in row) || Number(row["joueurs"]) >= MIN_BUCKET) return row;
  return Object.fromEntries(
    columns.map((column, index) => [
      column,
      index === 0 || column === "joueurs" ? row[column] : null,
    ]),
  );
}

function table(rows: readonly Row[]): string {
  const first = rows[0];
  if (first === undefined) return "_Aucune ligne._";
  const columns = Object.keys(first);
  const lines = [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows
      .map((row) => masked(row, columns))
      .map((row) => `| ${columns.map((column) => cell(row[column])).join(" | ")} |`),
  ];
  return lines.join("\n");
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function levelBuckets(rows: readonly { days_played: number; xp: number }[]): Row[] {
  const buckets: readonly [string, (days: number) => boolean][] = [
    ["1", (d) => d === 1],
    ["2", (d) => d === 2],
    ["3-4", (d) => d >= 3 && d <= 4],
    ["5-7", (d) => d >= 5 && d <= 7],
    ["8+", (d) => d >= 8],
  ];
  return buckets.map(([label, test]) => {
    const levels = rows.filter((row) => test(row.days_played)).map((row) => levelOf(row.xp).level);
    const enough = levels.length >= MIN_BUCKET;
    return {
      jours: label,
      joueurs: levels.length,
      niveau_median: enough ? median(levels) : null,
      niveau_max: enough ? Math.max(...levels) : null,
      pct_niveau_5: enough ? (100 * levels.filter((l) => l >= 5).length) / levels.length : null,
      pct_niveau_8: enough ? (100 * levels.filter((l) => l >= 8).length) / levels.length : null,
      pct_niveau_10: enough ? (100 * levels.filter((l) => l >= 10).length) / levels.length : null,
    };
  });
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("begin transaction read only");
  const out: string[] = [
    `# Économie de Leximon, relevé du ${new Date().toISOString().slice(0, 10)}`,
  ];
  for (const query of QUERIES) {
    const { rows } = await client.query<Row>(query.sql);
    out.push(`\n## ${query.title}\n`);
    if (query.note) out.push(`${query.note}\n`);
    out.push(table(rows));
  }
  const { rows } = await client.query<{ days_played: number; xp: number }>(LEVELS_SQL);
  out.push("\n## Niveaux selon les jours joués\n");
  out.push(
    table(
      levelBuckets(
        rows.map((row) => ({ days_played: Number(row.days_played), xp: Number(row.xp) })),
      ),
    ),
  );
  await client.query("rollback");
  console.info(out.join("\n"));
} finally {
  await client.end();
}
