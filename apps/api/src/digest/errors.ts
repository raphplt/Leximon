import { z } from "zod";

/** Where the error counts are read: the Workers Observability API of the account. */
export interface ObservabilityConfig {
  readonly accountId: string;
  readonly token: string;
}

export interface ErrorGroup {
  readonly service: string;
  readonly message: string;
  readonly count: number;
}

export type ErrorReport =
  | { readonly kind: "read"; readonly total: number; readonly groups: readonly ErrorGroup[] }
  | { readonly kind: "unavailable"; readonly status: number | null };

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_GROUPS = 8;

const responseSchema = z.object({
  success: z.boolean().optional(),
  result: z.object({
    calculations: z
      .array(
        z.object({
          aggregates: z.array(
            z.object({
              count: z.number(),
              value: z.number().optional(),
              groups: z
                .array(
                  z.object({
                    key: z.string(),
                    value: z.union([z.string(), z.number(), z.boolean()]),
                  }),
                )
                .optional(),
            }),
          ),
        }),
      )
      .optional(),
  }),
});

/**
 * Errors of the last 24 hours across the account's Workers (API and web), grouped by Worker and
 * message: uncaught exceptions and every `console.error`, as Workers Logs keeps them.
 */
export async function readErrors(
  config: ObservabilityConfig,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<ErrorReport> {
  const response = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/workers/observability/telemetry/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        queryId: "leximon-daily-errors",
        timeframe: { from: now - DAY_MS, to: now },
        view: "calculations",
        chartType: "aggregate",
        ignoreSeries: true,
        dry: true,
        parameters: {
          datasets: ["cloudflare-workers"],
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
      }),
    },
  ).catch(() => null);
  if (response === null) return { kind: "unavailable", status: null };
  if (!response.ok) return { kind: "unavailable", status: response.status };
  const body = responseSchema.safeParse(await response.json().catch(() => null));
  if (!body.success) return { kind: "unavailable", status: response.status };

  const aggregates = body.data.result.calculations?.[0]?.aggregates ?? [];
  const groups = aggregates.map((aggregate) => {
    const field = (key: string) => {
      const value = aggregate.groups?.find((group) => group.key === key)?.value;
      return value === undefined ? "?" : String(value);
    };
    return {
      service: field("$metadata.service"),
      message: field("$metadata.message"),
      count: Math.round(aggregate.value ?? aggregate.count),
    };
  });
  groups.sort((a, b) => b.count - a.count);
  return {
    kind: "read",
    total: groups.reduce((sum, group) => sum + group.count, 0),
    groups: groups.slice(0, TOP_GROUPS),
  };
}
