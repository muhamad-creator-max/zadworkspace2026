"use client";
import { createClient } from "@/lib/supabase/client";

const sb = () => createClient();

export interface DailyRevenue {
  date: string;       // YYYY-MM-DD
  sessions: number;
  orders: number;
  subscriptions: number;
  total: number;
}

export interface RetentionPoint {
  month: string;      // YYYY-MM
  returning: number;  // customers who visited >1 time in the month
  new: number;        // customers who visited for the first time ever
  retentionRate: number; // returning / (returning + new) * 100
}

export interface AvgVisitsPoint {
  month: string;
  avgVisits: number;
  uniqueCustomers: number;
  totalVisits: number;
}

export interface ActiveMembersPoint {
  month: string;
  activeSubscribers: number;    // subscribers with a session that month
  totalSubscribers: number;     // all non-expired subscribers at month end
  activeRate: number;
}

export interface TopCustomer {
  name: string;
  visits: number;
  totalSpend: number;
}

export interface AnalyticsSummary {
  totalCustomers: number;
  totalSubscribers: number;
  activeSubscribersNow: number;
  avgVisitsPerCustomer: number;
  retentionRate: number;         // last 30 days
  totalSessions: number;
}

// ── Revenue over time ─────────────────────────────────────────────────────────
export async function getDailyRevenue(from: string, to: string): Promise<DailyRevenue[]> {
  const { data, error } = await sb()
    .from("invoices")
    .select("issued_at, kind, session_amount, orders_amount, total_amount")
    .is("deleted_at", null)
    .gte("issued_at", from)
    .lte("issued_at", to)
    .order("issued_at", { ascending: true });
  if (error) throw error;

  const map = new Map<string, DailyRevenue>();
  for (const row of data ?? []) {
    const date = row.issued_at.slice(0, 10);
    if (!map.has(date))
      map.set(date, { date, sessions: 0, orders: 0, subscriptions: 0, total: 0 });
    const b = map.get(date)!;
    b.sessions += Number(row.session_amount);
    b.orders += Number(row.orders_amount);
    if (row.kind === "subscription") b.subscriptions += Number(row.total_amount);
    b.total += Number(row.total_amount);
  }
  return Array.from(map.values());
}

// ── Retention rate per month ──────────────────────────────────────────────────
export async function getRetentionByMonth(from: string, to: string): Promise<RetentionPoint[]> {
  // Fetch all closed sessions with customer_id (walk-ins) in range
  const { data, error } = await sb()
    .from("sessions")
    .select("customer_id, subscriber_id, started_at")
    .is("deleted_at", null)
    .eq("status", "closed")
    .gte("started_at", from)
    .lte("started_at", to)
    .order("started_at", { ascending: true });
  if (error) throw error;

  // Track first-ever visit per entity across all time to classify new vs returning
  const { data: allEarlier } = await sb()
    .from("sessions")
    .select("customer_id, subscriber_id, started_at")
    .is("deleted_at", null)
    .lt("started_at", from)
    .order("started_at", { ascending: true });

  const everSeen = new Set<string>();
  for (const s of allEarlier ?? []) {
    const key = s.customer_id ?? s.subscriber_id;
    if (key) everSeen.add(key);
  }

  // Group by month
  type MonthBucket = { returning: Set<string>; new_: Set<string> };
  const months = new Map<string, MonthBucket>();

  const seenThisRun = new Map<string, string>(); // entity -> first month seen

  for (const s of data ?? []) {
    const key = s.customer_id ?? s.subscriber_id;
    if (!key) continue;
    const month = s.started_at.slice(0, 7);
    if (!months.has(month)) months.set(month, { returning: new Set(), new_: new Set() });
    const b = months.get(month)!;

    if (everSeen.has(key)) {
      b.returning.add(key);
    } else if (seenThisRun.has(key) && seenThisRun.get(key) !== month) {
      // seen in a previous month in this window = returning
      b.returning.add(key);
    } else if (!seenThisRun.has(key)) {
      b.new_.add(key);
      seenThisRun.set(key, month);
    }
  }

  return Array.from(months.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, b]) => {
      const ret = b.returning.size;
      const nw = b.new_.size;
      const total = ret + nw;
      return {
        month,
        returning: ret,
        new: nw,
        retentionRate: total > 0 ? Math.round((ret / total) * 100) : 0,
      };
    });
}

// ── Avg visits per customer per month ────────────────────────────────────────
export async function getAvgVisitsByMonth(from: string, to: string): Promise<AvgVisitsPoint[]> {
  const { data, error } = await sb()
    .from("sessions")
    .select("customer_id, subscriber_id, started_at")
    .is("deleted_at", null)
    .eq("status", "closed")
    .gte("started_at", from)
    .lte("started_at", to)
    .order("started_at", { ascending: true });
  if (error) throw error;

  type Bucket = { visitors: Set<string>; visits: number };
  const months = new Map<string, Bucket>();
  for (const s of data ?? []) {
    const key = s.customer_id ?? s.subscriber_id;
    if (!key) continue;
    const month = s.started_at.slice(0, 7);
    if (!months.has(month)) months.set(month, { visitors: new Set(), visits: 0 });
    const b = months.get(month)!;
    b.visitors.add(key);
    b.visits++;
  }

  return Array.from(months.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, b]) => ({
      month,
      uniqueCustomers: b.visitors.size,
      totalVisits: b.visits,
      avgVisits: b.visitors.size > 0 ? Math.round((b.visits / b.visitors.size) * 10) / 10 : 0,
    }));
}

// ── Active members per month ──────────────────────────────────────────────────
export async function getActiveMembersByMonth(from: string, to: string): Promise<ActiveMembersPoint[]> {
  // Sessions by subscribers
  const { data: sessions, error: se } = await sb()
    .from("sessions")
    .select("subscriber_id, started_at")
    .is("deleted_at", null)
    .not("subscriber_id", "is", null)
    .gte("started_at", from)
    .lte("started_at", to)
    .order("started_at", { ascending: true });
  if (se) throw se;

  // Total subscribers alive at each month end (starts_at <= month_end AND expires_at >= month_start AND not deleted)
  const { data: subs, error: subE } = await sb()
    .from("subscribers")
    .select("id, starts_at, expires_at")
    .is("deleted_at", null);
  if (subE) throw subE;

  // Build month list from range
  const monthSet = new Set<string>();
  for (const s of sessions ?? []) monthSet.add(s.started_at.slice(0, 7));
  // Ensure we have all months in the range
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1)) {
    monthSet.add(d.toISOString().slice(0, 7));
  }

  // Active subscribers (had a session) per month
  const activeMap = new Map<string, Set<string>>();
  for (const s of sessions ?? []) {
    const month = s.started_at.slice(0, 7);
    if (!activeMap.has(month)) activeMap.set(month, new Set());
    activeMap.get(month)!.add(s.subscriber_id!);
  }

  return Array.from(monthSet)
    .sort()
    .map((month) => {
      const monthStart = new Date(month + "-01");
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const totalSubs = (subs ?? []).filter((s) => {
        const startsAt = new Date(s.starts_at);
        const expiresAt = new Date(s.expires_at);
        return startsAt <= monthEnd && expiresAt >= monthStart;
      }).length;

      const activeSubs = activeMap.get(month)?.size ?? 0;
      return {
        month,
        activeSubscribers: activeSubs,
        totalSubscribers: totalSubs,
        activeRate: totalSubs > 0 ? Math.round((activeSubs / totalSubs) * 100) : 0,
      };
    });
}

// ── Summary KPIs ──────────────────────────────────────────────────────────────
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const now = new Date().toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [custRes, subRes, activeSubRes, sessionsRes, recentSessRes] = await Promise.all([
    sb().from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
    sb().from("subscribers").select("id", { count: "exact", head: true }).is("deleted_at", null),
    sb().from("subscribers").select("id", { count: "exact", head: true })
      .is("deleted_at", null).gte("expires_at", now),
    // avg visits: sessions per unique entity last 30 days
    sb().from("sessions").select("customer_id, subscriber_id")
      .is("deleted_at", null).eq("status", "closed")
      .gte("started_at", thirtyDaysAgo),
    sb().from("sessions").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  const sessionRows = sessionsRes.data ?? [];
  const uniqueEntities = new Set(sessionRows.map((s: any) => s.customer_id ?? s.subscriber_id).filter(Boolean));
  const avgVisits = uniqueEntities.size > 0 ? Math.round((sessionRows.length / uniqueEntities.size) * 10) / 10 : 0;

  // Retention last 30 days: entities seen before thirtyDaysAgo that came back
  const { data: recentSessions } = await sb()
    .from("sessions")
    .select("customer_id, subscriber_id, started_at")
    .is("deleted_at", null)
    .eq("status", "closed")
    .gte("started_at", thirtyDaysAgo);

  const { data: olderSessions } = await sb()
    .from("sessions")
    .select("customer_id, subscriber_id")
    .is("deleted_at", null)
    .eq("status", "closed")
    .lt("started_at", thirtyDaysAgo);

  const prevSeen = new Set((olderSessions ?? []).map((s: any) => s.customer_id ?? s.subscriber_id).filter(Boolean));
  const recentEntities = new Set((recentSessions ?? []).map((s: any) => s.customer_id ?? s.subscriber_id).filter(Boolean));
  const returning = [...recentEntities].filter((e) => prevSeen.has(e)).length;
  const retentionRate = recentEntities.size > 0 ? Math.round((returning / recentEntities.size) * 100) : 0;

  return {
    totalCustomers: custRes.count ?? 0,
    totalSubscribers: subRes.count ?? 0,
    activeSubscribersNow: activeSubRes.count ?? 0,
    avgVisitsPerCustomer: avgVisits,
    retentionRate,
    totalSessions: recentSessRes.count ?? 0,
  };
}

// ── Top customers ─────────────────────────────────────────────────────────────
export async function getTopCustomers(limit = 10): Promise<TopCustomer[]> {
  const { data, error } = await sb()
    .from("invoices")
    .select("customer_name, total_amount")
    .is("deleted_at", null)
    .not("customer_name", "is", null);
  if (error) throw error;

  const map = new Map<string, { visits: number; spend: number }>();
  for (const row of data ?? []) {
    const name = row.customer_name!;
    if (!map.has(name)) map.set(name, { visits: 0, spend: 0 });
    const b = map.get(name)!;
    b.visits++;
    b.spend += Number(row.total_amount);
  }

  return Array.from(map.entries())
    .map(([name, b]) => ({ name, visits: b.visits, totalSpend: b.spend }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, limit);
}
