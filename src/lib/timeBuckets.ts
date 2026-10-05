// Time buckets for trend charts, in local time. The granularity follows the
// range: one day → hours, up to ~3 months → days, anything longer → months.
// Every bucket in the range is emitted (zeros included) so lines stay continuous.

export type Granularity = "hour" | "day" | "month";

export interface Bucket {
  key: string;        // stable id, e.g. "2026-10-04T14" | "2026-10-04" | "2026-10"
  label: string;      // short axis label
  fullLabel: string;  // tooltip label
}

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

export function pickGranularity(from: Date, to: Date): Granularity {
  const days = (to.getTime() - from.getTime()) / DAY_MS;
  if (days <= 1) return "hour";
  if (days <= 93) return "day";
  return "month";
}

export function bucketKey(d: Date, g: Granularity): string {
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  if (g === "month") return day;
  const date = `${day}-${pad(d.getDate())}`;
  return g === "day" ? date : `${date}T${pad(d.getHours())}`;
}

function describe(d: Date, g: Granularity): Bucket {
  const key = bucketKey(d, g);
  if (g === "hour") {
    const hour = `${pad(d.getHours())}:00`;
    return {
      key,
      label: hour,
      fullLabel: `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${hour}`,
    };
  }
  if (g === "day") {
    return {
      key,
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      fullLabel: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    };
  }
  return {
    key,
    label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    fullLabel: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  };
}

export function buildBuckets(from: Date, to: Date, g: Granularity): Bucket[] {
  const out: Bucket[] = [];
  const cur = new Date(from);
  if (g === "hour") cur.setMinutes(0, 0, 0);
  else if (g === "day") cur.setHours(0, 0, 0, 0);
  else { cur.setDate(1); cur.setHours(0, 0, 0, 0); }

  while (cur <= to && out.length < 2000) {
    out.push(describe(cur, g));
    if (g === "hour") cur.setHours(cur.getHours() + 1);
    else if (g === "day") cur.setDate(cur.getDate() + 1);
    else cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/**
 * Sums timestamped entries into buckets. Returns one row per bucket with a
 * value for every series key (0 when nothing landed there).
 */
export function bucketize<K extends string>(
  from: Date,
  to: Date,
  keys: readonly K[],
  entries: { at: string; values: Partial<Record<K, number>> }[],
): { granularity: Granularity; rows: (Bucket & Record<K, number>)[] } {
  const granularity = pickGranularity(from, to);
  const rows = buildBuckets(from, to, granularity).map(
    (b) => ({ ...b, ...Object.fromEntries(keys.map((k) => [k, 0])) }) as Bucket & Record<K, number>,
  );
  const index = new Map(rows.map((r, i) => [r.key, i]));
  for (const e of entries) {
    const i = index.get(bucketKey(new Date(e.at), granularity));
    if (i === undefined) continue;
    const row = rows[i] as Record<K, number>;
    for (const k of keys) row[k] += e.values[k] ?? 0;
  }
  return { granularity, rows };
}

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  hour: "Hourly",
  day: "Daily",
  month: "Monthly",
};
