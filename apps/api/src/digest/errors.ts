import { groupValue, type ObservabilityConfig, queryTelemetry } from "./telemetry";

export type { ObservabilityConfig } from "./telemetry";

export interface ErrorGroup {
  readonly service: string;
  readonly message: string;
  readonly count: number;
}

export type ErrorReport =
  | { readonly kind: "read"; readonly total: number; readonly groups: readonly ErrorGroup[] }
  | { readonly kind: "unavailable"; readonly status: number | null };

const TOP_GROUPS = 8;

/**
 * Errors of the last 24 hours across the account's Workers (API and web), grouped by Worker and
 * message: uncaught exceptions and every `console.error`, as Workers Logs keeps them.
 */
export async function readErrors(
  config: ObservabilityConfig,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<ErrorReport> {
  const result = await queryTelemetry(
    config,
    {
      queryId: "leximon-daily-errors",
      now,
      parameters: {
        calculations: [{ operator: "count", alias: "errors" }],
        filterCombination: "or",
        filters: [
          { key: "$metadata.level", operation: "eq", type: "string", value: "error" },
          { key: "$metadata.error", operation: "exists", type: "string" },
        ],
        groupBys: [
          { type: "string", value: "$metadata.service" },
          { type: "string", value: "$metadata.message" },
        ],
        orderBy: { value: "errors", order: "desc" },
        limit: 50,
      },
    },
    fetcher,
  );
  if (result.kind === "unavailable") return result;

  const groups = (result.calculations[0] ?? []).map((aggregate) => ({
    service: groupValue(aggregate, "$metadata.service"),
    message: groupValue(aggregate, "$metadata.message"),
    count: Math.round(aggregate.value ?? aggregate.count),
  }));
  groups.sort((a, b) => b.count - a.count);
  return {
    kind: "read",
    total: groups.reduce((sum, group) => sum + group.count, 0),
    groups: groups.slice(0, TOP_GROUPS),
  };
}
