import { groupValue, type ObservabilityConfig, queryTelemetry } from "./telemetry";

/** The production API Worker: the staging one under load would blur the morning figures. */
const API_SERVICE = "leximon-api-production";

/** The routes a player waits on, in the order the summary lists them. */
export const KEY_ROUTES = [
  { path: "/boosters/open", label: "ouverture" },
  { path: "/challenges/answer", label: "défi" },
  { path: "/me/cards", label: "collection" },
] as const;

export interface RouteLatency {
  readonly label: string;
  readonly requests: number;
  /** Wall time of the invocation, as Workers Logs measures it; `null` without any request. */
  readonly p95Ms: number | null;
}

export type LatencyReport =
  | { readonly kind: "read"; readonly routes: readonly RouteLatency[] }
  | { readonly kind: "unavailable"; readonly status: number | null };

const PATH_KEY = "$workers.event.request.path";

/** Requests and 95th percentile of the key routes of the API over the last 24 hours. */
export async function readLatency(
  config: ObservabilityConfig,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<LatencyReport> {
  const result = await queryTelemetry(
    config,
    {
      queryId: "leximon-daily-latency",
      now,
      parameters: {
        calculations: [
          { operator: "count", alias: "requests" },
          { operator: "p95", key: "$workers.wallTimeMs", keyType: "number", alias: "p95" },
        ],
        filterCombination: "and",
        filters: [
          { key: "$metadata.service", operation: "eq", type: "string", value: API_SERVICE },
          // Only invocation events carry a wall time: the console lines of a request are left out.
          { key: "$workers.wallTimeMs", operation: "exists", type: "number" },
        ],
        groupBys: [{ type: "string", value: PATH_KEY }],
        orderBy: { value: "requests", order: "desc" },
        limit: 100,
      },
    },
    fetcher,
  );
  if (result.kind === "unavailable") return result;

  const [counts = [], percentiles = []] = result.calculations;
  const byPath = (rows: typeof counts) =>
    new Map(rows.map((row) => [groupValue(row, PATH_KEY), row.value ?? row.count]));
  const requests = byPath(counts);
  const p95 = byPath(percentiles);
  return {
    kind: "read",
    routes: KEY_ROUTES.map(({ path, label }) => {
      const count = Math.round(requests.get(path) ?? 0);
      const value = p95.get(path);
      return {
        label,
        requests: count,
        p95Ms: count === 0 || value === undefined ? null : Math.round(value),
      };
    }),
  };
}
