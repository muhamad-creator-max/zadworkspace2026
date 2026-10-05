"use client";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { usePersistedState } from "@/hooks/usePersistedState";
import { GRANULARITY_LABEL, type Bucket, type Granularity } from "@/lib/timeBuckets";
import { cn } from "@/lib/utils";

export interface TrendSeries<K extends string> {
  key: K;
  label: string;
  color: string; // CSS color, e.g. "var(--chart-1)"
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Multi-series line chart with one toggle tile per series. Each tile shows the
 * series' total over the range; unticking it hides the line so another series
 * can be read on its own scale. Toggle state persists per `storageKey`.
 */
export function TrendChart<K extends string>({
  title,
  description,
  series,
  rows,
  granularity,
  formatValue,
  storageKey,
  showTotal = false,
  loading = false,
}: {
  title: string;
  description?: string;
  series: readonly TrendSeries<K>[];
  rows: (Bucket & Record<K, number>)[];
  granularity: Granularity;
  formatValue: (v: number) => string;
  storageKey: string;
  showTotal?: boolean; // add a "Total" line (sum of visible series) to the tooltip
  loading?: boolean;
}) {
  const [hidden, setHidden] = usePersistedState<K[]>(storageKey, []);
  const visible = series.filter((s) => !hidden.includes(s.key));

  const config = useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig,
    [series],
  );

  const totals = useMemo(() => {
    const t = {} as Record<K, number>;
    for (const s of series) t[s.key] = rows.reduce<number>((sum, r) => sum + Number((r as Record<K, number>)[s.key] ?? 0), 0);
    return t;
  }, [rows, series]);

  const toggle = (key: K, on: boolean) =>
    setHidden((h) => (on ? h.filter((k) => k !== key) : [...h, key]));

  // Dense ranges (e.g. 90 days) get smaller dots so the line stays readable.
  const dotR = rows.length > 45 ? 2 : 3;

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <CardAction>
          <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {GRANULARITY_LABEL[granularity]} · {rows.length} {granularity === "hour" ? "hours" : granularity === "day" ? "days" : "months"}
          </span>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className={cn("grid gap-3", series.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
          {series.map((s) => {
            const on = !hidden.includes(s.key);
            return (
              <label
                key={s.key}
                className={cn(
                  "group relative flex cursor-pointer select-none items-start gap-3 overflow-hidden rounded-xl border border-border px-4 py-3 transition",
                  on ? "bg-card" : "bg-muted opacity-60 hover:opacity-80",
                )}
              >
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: on ? s.color : "transparent" }} />
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) => toggle(s.key, v === true)}
                  className="mt-0.5"
                  style={{ "--checkbox-color": s.color } as React.CSSProperties}
                  aria-label={`Show ${s.label}`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
                  <div className="mt-1 truncate text-xl font-semibold tabular-nums">{formatValue(totals[s.key])}</div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="relative">
          <ChartContainer config={config} className={cn("aspect-auto h-[300px] w-full", loading && "opacity-50")}>
            <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={24}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={44}
                tickFormatter={(v: number) => compact.format(v)}
              />
              <ChartTooltip
                cursor={{ strokeDasharray: "4 4" }}
                content={(props) => (
                  <ChartTooltipContent
                    active={props.active}
                    payload={props.payload as never}
                    label={props.label}
                    labelFormatter={(_, p) => (p[0]?.payload as Bucket | undefined)?.fullLabel}
                    valueFormatter={(v) => formatValue(v)}
                    footer={
                      showTotal && visible.length > 1
                        ? (p) => (
                            <div className="flex items-center justify-between font-medium">
                              <span>Total</span>
                              <span className="font-mono tabular-nums">
                                {formatValue(p.reduce((sum, i) => sum + Number(i.value ?? 0), 0))}
                              </span>
                            </div>
                          )
                        : undefined
                    }
                  />
                )}
              />
              {visible.map((s) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  type="monotone"
                  stroke={`var(--color-${s.key})`}
                  strokeWidth={2}
                  dot={{ r: dotR, fill: `var(--color-${s.key})`, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: `var(--color-${s.key})`, stroke: "var(--surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
          {!visible.length && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Tick a series above to show it on the chart.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
