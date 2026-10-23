import { z } from "zod";

/** Where the morning figures are read: the Workers Observability API of the account. */
export interface ObservabilityConfig {
  readonly accountId: string;
  readonly token: string;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

const aggregateSchema = z.object({
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
});
export type TelemetryAggregate = z.infer<typeof aggregateSchema>;

const responseSchema = z.object({
  success: z.boolean().optional(),
  result: z.object({
    calculations: z
      .array(z.object({ alias: z.string().optional(), aggregates: z.array(aggregateSchema) }))
      .optional(),
  }),
});

export type TelemetryResult =
  | {
      readonly kind: "read";
      /** One list per calculation asked, in the order asked. */
      readonly calculations: readonly (readonly TelemetryAggregate[])[];
    }
  | { readonly kind: "unavailable"; readonly status: number | null };

/** Runs one aggregate query over the last 24 hours of Workers Logs. */
export async function queryTelemetry(
  config: ObservabilityConfig,
  query: { readonly queryId: string; readonly now: number; readonly parameters: object },
  fetcher: typeof fetch,
): Promise<TelemetryResult> {
  const response = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/workers/observability/telemetry/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        queryId: query.queryId,
        timeframe: { from: query.now - DAY_MS, to: query.now },
        view: "calculations",
        chartType: "aggregate",
        ignoreSeries: true,
        dry: true,
        parameters: { datasets: ["cloudflare-workers"], ...query.parameters },
      }),
    },
  ).catch(() => null);
  if (response === null) return { kind: "unavailable", status: null };
  if (!response.ok) return { kind: "unavailable", status: response.status };
  const body = responseSchema.safeParse(await response.json().catch(() => null));
  if (!body.success) return { kind: "unavailable", status: response.status };
  return {
    kind: "read",
    calculations: (body.data.result.calculations ?? []).map(
      (calculation) => calculation.aggregates,
    ),
  };
}

/** The value of one group-by key in an aggregate row, `"?"` when absent. */
export function groupValue(aggregate: TelemetryAggregate, key: string): string {
  const value = aggregate.groups?.find((group) => group.key === key)?.value;
  return value === undefined ? "?" : String(value);
}
