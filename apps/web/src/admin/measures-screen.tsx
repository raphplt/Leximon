"use client";

import type { AdminMeasures, AdminTester, RetentionRow } from "@leximon/contract";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { Bar, ColumnChart, heat, Legend, LineChart, SERIES, type Series } from "./charts";
import { type Delta, Kpi, PanelHead } from "./dashboard";
import { formatNumber } from "./format";
import m from "./measures.module.css";
import {
  change,
  cohortTable,
  type DayMetric,
  daysBetween,
  type Grain,
  type Range,
  type Rate,
  retentionCurve,
  retentionOn,
  share,
  total,
} from "./measures-model";
import { dayParam, PeriodPicker } from "./period-picker";

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const LONG_DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const FULL_DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const shortDay = (day: string) => DAY_FORMAT.format(asDate(day));
const longDay = (day: string) => LONG_DAY_FORMAT.format(asDate(day));
const fullDay = (day: string) => FULL_DAY_FORMAT.format(asDate(day));

function percent(value: number | null, digits = 0): string {
  return value === null ? "—" : `${(value * 100).toFixed(digits).replace(".", ",")} %`;
}

/**
 * Retention, activity and funnel of the beta over a period, computed from the game's own database.
 * The period lives in the address, so that a view can be shared or reloaded.
 */
export function MeasuresScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const from = dayParam(params.get("du"));
  const to = dayParam(params.get("au"));
  const [data, setData] = useState<AdminMeasures | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nonce, setNonce] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `nonce` asks for a fresh read.
  useEffect(() => {
    let live = true;
    setBusy(true);
    adminApi
      .fetchMeasures({ from, to })
      .then((measures) => {
        if (!live) return;
        setData(measures);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [from, to, nonce]);

  const choose = (range: Range) => {
    router.replace(`${pathname}?du=${range.from}&au=${range.to}`, { scroll: false });
  };

  return (
    <>
      <div className={m.header}>
        <h1 className={styles.title}>Mesure</h1>
        {data !== null && (
          <PeriodPicker
            period={data.period}
            firstDay={data.period.firstDay}
            busy={busy}
            onChoose={choose}
            onRefresh={() => setNonce((n) => n + 1)}
          />
        )}
      </div>
      {error !== null && <p className={styles.error}>{error}</p>}
      {data === null ? (
        error === null && <p className={styles.muted}>Chargement…</p>
      ) : (
        <div className={m.dashboard} data-busy={busy}>
          <Dashboard data={data} />
        </div>
      )}
      <Testers />
    </>
  );
}

function Dashboard({ data }: { readonly data: AdminMeasures }) {
  const { period } = data;
  const current: Range = { from: period.from, to: period.to };
  const previous: Range = { from: period.previousFrom, to: period.previousTo };
  const days = daysBetween(period.from, period.to) + 1;
  const currentDays = data.daily.filter((day) => day.day >= period.from);
  const series = (metric: DayMetric) => currentDays.map((day) => day[metric]);
  const sum = (metric: DayMetric, range: Range) => total(data.daily, metric, range);
  const d1 = retentionOn(data.cohorts, current, 1, period.today);
  const d1Before = retentionOn(data.cohorts, previous, 1, period.today);
  const d7 = retentionOn(data.cohorts, current, 7, period.today);
  const d7Before = retentionOn(data.cohorts, previous, 7, period.today);

  return (
    <>
      <p className={styles.muted}>
        Du {fullDay(period.from)} au {fullDay(period.to)} ({days} jour{days > 1 ? "s" : ""}),
        comparé aux {days} jours d'avant. Un joueur compte le jour où il ouvre le jeu, heure de
        Paris. Les admins ne comptent pas.
      </p>
      <div className={m.live}>
        <span className={m.liveDot} aria-hidden="true" />
        En ce moment : <strong>{formatNumber(data.activeToday)}</strong> aujourd'hui ·{" "}
        <strong>{formatNumber(data.active7d)}</strong> sur 7 jours ·{" "}
        <strong>{formatNumber(data.active30d)}</strong> sur 30 jours
      </div>

      <div className={m.kpis}>
        <Kpi
          label="Joueurs actifs"
          value={formatNumber(data.uniqueActive.current)}
          delta={ratioDelta(data.uniqueActive.current, data.uniqueActive.previous)}
          trend={series("active")}
        />
        <Kpi
          label="Nouveaux joueurs"
          value={formatNumber(sum("arrived", current))}
          delta={ratioDelta(sum("arrived", current), sum("arrived", previous))}
          trend={series("arrived")}
          color={SERIES.yellow}
        />
        <Kpi
          label="Actifs par jour, en moyenne"
          value={(sum("active", current) / days).toFixed(1).replace(".", ",")}
          delta={ratioDelta(sum("active", current), sum("active", previous))}
          trend={series("active")}
        />
        <Kpi
          label="Comptes créés"
          value={formatNumber(sum("accounts", current))}
          delta={ratioDelta(sum("accounts", current), sum("accounts", previous))}
          trend={series("accounts")}
        />
        <Kpi
          label="Sachets ouverts"
          value={formatNumber(sum("boosters", current))}
          delta={ratioDelta(sum("boosters", current), sum("boosters", previous))}
          trend={series("boosters")}
        />
        <Kpi
          label="Défis répondus"
          value={formatNumber(sum("answers", current))}
          delta={ratioDelta(sum("answers", current), sum("answers", previous))}
          trend={series("answers")}
        />
        <Kpi
          label="Revenus à J1"
          value={percent(share(d1))}
          note={`${formatNumber(d1.players)} sur ${formatNumber(d1.eligible)}`}
          delta={pointsDelta(d1, d1Before)}
        />
        <Kpi
          label="Revenus à J7"
          value={percent(share(d7))}
          note={`${formatNumber(d7.players)} sur ${formatNumber(d7.eligible)}`}
          delta={pointsDelta(d7, d7Before)}
        />
      </div>

      <Activity days={currentDays} />

      <div className={m.split}>
        <section className={m.panel}>
          <PanelHead
            title="Entonnoir"
            hint="Joueurs arrivés sur la période, et ce qu'ils ont fait depuis."
          />
          <Funnel funnel={data.funnel} />
        </section>
        <section className={m.panel}>
          <PanelHead
            title="Courbe de rétention"
            hint="Part des joueurs revenus pile N jours après leur arrivée, parmi ceux pour qui ce jour est passé."
          />
          <Legend
            items={[
              { label: "Arrivés sur la période", color: SERIES.blue },
              { label: "Arrivés la période d'avant", color: SERIES.gray },
            ]}
          />
          <RetentionCurve data={data} current={current} previous={previous} />
        </section>
      </div>

      <Cohorts data={data} current={current} days={days} />

      <div className={m.split}>
        <section className={m.panel}>
          <PanelHead title="Par invitation ou source" hint="Arrivés sur la période." />
          <Breakdown rows={data.byOrigin} />
        </section>
        <section className={m.panel}>
          <PanelHead title="Par âge déclaré" hint="Arrivés sur la période." />
          <Breakdown rows={data.byAge} labels={AGE_LABELS} />
        </section>
      </div>

      <Hours hours={data.hours} />

      <section className={m.panel}>
        <PanelHead
          title="Fausse porte « Devenir mécène »"
          hint="Signaux d'intérêt reçus sur la période, pour une offre pas encore en vente."
        />
        <div className={m.kpis}>
          <Kpi
            label="Ont ouvert la page"
            value={formatNumber(data.interest.patronDoor)}
            note={`${percent(
              data.uniqueActive.current === 0
                ? null
                : data.interest.patronDoor / data.uniqueActive.current,
            )} des joueurs actifs`}
          />
          <Kpi
            label="Ont demandé à être prévenus"
            value={formatNumber(data.interest.patronNotify)}
            note={`${percent(
              data.interest.patronDoor === 0
                ? null
                : data.interest.patronNotify / data.interest.patronDoor,
            )} de ceux qui ont ouvert`}
          />
        </div>
      </section>
    </>
  );
}

function ratioDelta(current: number, previous: number): Delta | null {
  const ratio = change(current, previous);
  if (ratio === null) return null;
  const rounded = Math.round(ratio * 100);
  return {
    text: `${rounded > 0 ? "+" : ""}${formatNumber(rounded)} %`,
    direction: rounded > 0 ? "up" : rounded < 0 ? "down" : "flat",
  };
}

function pointsDelta(current: Rate, previous: Rate): Delta | null {
  const now = share(current);
  const before = share(previous);
  if (now === null || before === null) return null;
  const points = Math.round((now - before) * 100);
  return {
    text: `${points > 0 ? "+" : ""}${points} pt${Math.abs(points) > 1 ? "s" : ""}`,
    direction: points > 0 ? "up" : points < 0 ? "down" : "flat",
  };
}

const METRICS = [
  { key: "players", label: "Joueurs" },
  { key: "boosters", label: "Sachets" },
  { key: "answers", label: "Défis" },
  { key: "accounts", label: "Comptes" },
] as const;
type Metric = (typeof METRICS)[number]["key"];

function Activity({ days }: { readonly days: AdminMeasures["daily"] }) {
  const [metric, setMetric] = useState<Metric>("players");
  const labels = days.map((day) => day.day);
  const series: Series[] =
    metric === "players"
      ? [
          {
            key: "back",
            label: "Revenus",
            color: SERIES.blue,
            values: days.map((day) => day.active - day.arrived),
          },
          {
            key: "new",
            label: "Nouveaux",
            color: SERIES.yellow,
            values: days.map((day) => day.arrived),
          },
        ]
      : [
          {
            key: metric,
            label: METRICS.find((candidate) => candidate.key === metric)?.label ?? "",
            color: SERIES.blue,
            values: days.map((day) => day[metric]),
          },
        ];
  return (
    <section className={m.panel}>
      <PanelHead title="Activité par jour">
        <fieldset className={styles.segmented} aria-label="Mesure affichée">
          {METRICS.map((candidate) => (
            <button
              key={candidate.key}
              type="button"
              className={styles.segment}
              aria-pressed={metric === candidate.key}
              onClick={() => setMetric(candidate.key)}
            >
              {candidate.label}
            </button>
          ))}
        </fieldset>
      </PanelHead>
      {metric === "players" && (
        <Legend
          items={[
            { label: "Nouveaux", color: SERIES.yellow },
            { label: "Revenus", color: SERIES.blue },
          ]}
        />
      )}
      <ColumnChart labels={labels} tickLabel={shortDay} tooltipTitle={longDay} series={series} />
    </section>
  );
}

const FUNNEL_STEPS = [
  ["arrived", "Arrivés"],
  ["openedBooster", "Un sachet ouvert"],
  ["answeredChallenge", "Un défi répondu"],
  ["createdAccount", "Compte créé"],
  ["cameBack", "Revenus un autre jour"],
  ["tradedOnce", "Un échange conclu"],
] as const;

function Funnel({ funnel }: { readonly funnel: AdminMeasures["funnel"] }) {
  if (funnel.arrived === 0)
    return <p className={styles.muted}>Personne d'arrivé sur la période.</p>;
  return (
    <div className={m.funnel}>
      {FUNNEL_STEPS.map(([key, label]) => {
        const value = funnel[key];
        const part = value / funnel.arrived;
        return (
          <div key={key} className={m.funnelStep}>
            <span className={m.funnelLabel}>{label}</span>
            <Bar share={part}>
              <span className={m.funnelValue}>
                <strong>{formatNumber(value)}</strong> {percent(part)}
              </span>
            </Bar>
          </div>
        );
      })}
    </div>
  );
}

const CURVE_DAYS = 30;
/** J1, J7, J14, J21 and J30, as positions on the curve. */
const CURVE_TICKS = [0, 6, 13, 20, 29];

function RetentionCurve({
  data,
  current,
  previous,
}: {
  readonly data: AdminMeasures;
  readonly current: Range;
  readonly previous: Range;
}) {
  const now = retentionCurve(data.cohorts, current, CURVE_DAYS, data.period.today);
  const before = retentionCurve(data.cohorts, previous, CURVE_DAYS, data.period.today);
  if (now.every((rate) => rate.eligible === 0) && before.every((rate) => rate.eligible === 0)) {
    return <p className={styles.muted}>Personne n'a encore eu de lendemain.</p>;
  }
  const detail = (rate: Rate) => `${rate.players}/${rate.eligible}`;
  return (
    <LineChart
      labels={now.map((_, i) => `J${i + 1}`)}
      ticks={CURVE_TICKS}
      format={(value) => percent(value)}
      maxValue={1}
      series={[
        {
          key: "previous",
          label: "Période d'avant",
          color: SERIES.gray,
          values: before.map(share),
          details: before.map(detail),
        },
        {
          key: "current",
          label: "Période",
          color: SERIES.blue,
          values: now.map(share),
          details: now.map(detail),
        },
      ]}
    />
  );
}

const COHORT_OFFSETS = [1, 2, 3, 4, 5, 6, 7, 14, 21, 30] as const;

function Cohorts({
  data,
  current,
  days,
}: {
  readonly data: AdminMeasures;
  readonly current: Range;
  readonly days: number;
}) {
  const [chosen, setChosen] = useState<Grain | null>(null);
  const grain = chosen ?? (days > 31 ? "week" : "day");
  const rows = cohortTable(data.cohorts, current, grain, COHORT_OFFSETS, data.period.today);
  return (
    <section className={m.panel}>
      <PanelHead
        title="Cohortes"
        hint="Joueurs arrivés le même jour ou la même semaine, et la part revenue pile N jours après."
      >
        <fieldset className={styles.segmented} aria-label="Regrouper par">
          {(
            [
              ["day", "Par jour"],
              ["week", "Par semaine"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={styles.segment}
              aria-pressed={grain === key}
              onClick={() => setChosen(key)}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </PanelHead>
      {rows.length === 0 ? (
        <p className={styles.muted}>Personne d'arrivé sur la période.</p>
      ) : (
        <div className={m.heatWrap}>
          <table className={m.heat}>
            <thead>
              <tr>
                <th>{grain === "day" ? "Arrivés le" : "Semaine du"}</th>
                <th>Joueurs</th>
                {COHORT_OFFSETS.map((offset) => (
                  <th key={offset}>J{offset}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{grain === "day" ? longDay(row.key) : shortDay(row.key)}</th>
                  <td className={m.count}>{formatNumber(row.players)}</td>
                  {row.rates.map((rate, i) => (
                    <HeatCell key={COHORT_OFFSETS[i]} rate={rate} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HeatCell({ rate }: { readonly rate: Rate }) {
  const value = share(rate);
  if (value === null) return <td className={m.pending} />;
  return (
    <td style={heat(value)} title={`${rate.players} sur ${rate.eligible}`}>
      {percent(value)}
    </td>
  );
}

const AGE_LABELS: Readonly<Record<string, string>> = { "50+": "50 et +" };

function Breakdown({
  rows,
  labels = {},
}: {
  readonly rows: readonly RetentionRow[];
  readonly labels?: Readonly<Record<string, string>>;
}) {
  if (rows.length === 0) return <p className={styles.muted}>Personne d'arrivé sur la période.</p>;
  const most = Math.max(...rows.map((row) => row.players));
  return (
    <div className={m.heatWrap}>
      <table className={m.heat}>
        <thead>
          <tr>
            <th />
            <th className={m.wide}>Joueurs</th>
            <th>J1</th>
            <th>J7</th>
            <th>J30</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{labels[row.key] ?? row.key}</th>
              <td className={m.wide}>
                <Bar share={row.players / most}>
                  <span className={m.count}>{formatNumber(row.players)}</span>
                </Bar>
              </td>
              <HeatCell rate={row.d1} />
              <HeatCell rate={row.d7} />
              <HeatCell rate={row.d30} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const WEEKDAYS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."] as const;
const LONG_WEEKDAYS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

function Hours({ hours }: { readonly hours: AdminMeasures["hours"] }) {
  const [hover, setHover] = useState<{ weekday: number; hour: number } | null>(null);
  const grid = new Map(hours.map((cell) => [`${cell.weekday}-${cell.hour}`, cell.events]));
  const most = Math.max(0, ...hours.map((cell) => cell.events));
  const all = hours.reduce((sum, cell) => sum + cell.events, 0);
  const hovered =
    hover === null ? null : { ...hover, events: grid.get(`${hover.weekday}-${hover.hour}`) ?? 0 };
  return (
    <section className={m.panel}>
      <PanelHead
        title="Heures de jeu"
        hint="Sachets ouverts et défis répondus sur la période, par jour de la semaine et heure de Paris."
      />
      {all === 0 ? (
        <p className={styles.muted}>Aucune partie sur la période.</p>
      ) : (
        <>
          <div className={m.hours} onPointerLeave={() => setHover(null)}>
            <span />
            {HOURS.map((hour) => (
              <span key={hour} className={m.hourLabel}>
                {hour % 3 === 0 ? `${hour} h` : ""}
              </span>
            ))}
            {WEEKDAYS.map((weekday, day) => (
              <HoursRow
                key={weekday}
                label={weekday}
                values={HOURS.map((hour) => grid.get(`${day}-${hour}`) ?? 0)}
                most={most}
                onHover={(hour) => setHover({ weekday: day, hour })}
              />
            ))}
          </div>
          <p className={m.hint} aria-live="polite">
            {hovered === null
              ? `${formatNumber(all)} actions en tout. Survolez une case pour le détail.`
              : `Le ${LONG_WEEKDAYS[hovered.weekday]} entre ${hovered.hour} h et ${hovered.hour + 1} h : ${formatNumber(hovered.events)} action${hovered.events > 1 ? "s" : ""} (${percent(hovered.events / all, 1)}).`}
          </p>
        </>
      )}
    </section>
  );
}

function HoursRow({
  label,
  values,
  most,
  onHover,
}: {
  readonly label: string;
  readonly values: readonly number[];
  readonly most: number;
  readonly onHover: (hour: number) => void;
}) {
  return (
    <>
      <span className={m.dayLabel}>{label}</span>
      {values.map((events, hour) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the hour is the identity of the cell.
          key={hour}
          className={m.hourCell}
          // A square root keeps the quiet hours visible beside one very busy player.
          style={events === 0 ? undefined : heat(most === 0 ? 0 : Math.sqrt(events / most))}
          onPointerEnter={() => onHover(hour)}
        />
      ))}
    </>
  );
}

/** Each tester, by the last day they played. */
function Testers() {
  const [testers, setTesters] = useState<readonly AdminTester[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    adminApi
      .fetchTesters()
      .then((page) => {
        if (!live) return;
        setTesters(page.testers);
        setCursor(page.nextCursor);
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      });
    return () => {
      live = false;
    };
  }, []);

  const more = async () => {
    if (cursor === null) return;
    setBusy(true);
    try {
      const page = await adminApi.fetchTesters(cursor);
      setTesters((current) => [...current, ...page.testers]);
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className={styles.subtitle}>Testeurs, du dernier venu au plus ancien</h2>
      {error !== null && <p className={styles.error}>{error}</p>}
      {testers.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Origine</th>
                <th>Âge</th>
                <th>Arrivé</th>
                <th>Dernier jour</th>
                <th>Jours</th>
                <th>Sachets</th>
                <th>Défis</th>
                <th>Niveau</th>
              </tr>
            </thead>
            <tbody>
              {testers.map((tester) => (
                <tr key={tester.id}>
                  <td>
                    <Link href={`/admin/joueurs/${encodeURIComponent(tester.id)}`}>
                      {tester.pseudo ?? tester.email ?? "Invité"}
                    </Link>
                  </td>
                  <td>{tester.origin ?? "—"}</td>
                  <td>
                    {tester.ageBracket === null
                      ? "—"
                      : (AGE_LABELS[tester.ageBracket] ?? tester.ageBracket)}
                  </td>
                  <td>{shortDay(tester.firstDay)}</td>
                  <td>{shortDay(tester.lastDay)}</td>
                  <td>{formatNumber(tester.daysPlayed)}</td>
                  <td>{formatNumber(tester.boosters)}</td>
                  <td>{formatNumber(tester.answers)}</td>
                  <td>{tester.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor !== null && (
        <button type="button" className={styles.button} disabled={busy} onClick={() => void more()}>
          Afficher plus
        </button>
      )}
    </>
  );
}
