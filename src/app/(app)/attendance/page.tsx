"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useStaffAccess } from "@/lib/hooks/useStaffAccess";
import {
  checkOut,
  listAttendanceBetween,
  searchAttendance,
  signIn,
  softDeleteAttendance,
} from "@/features/attendance/api";
import {
  addDays,
  formatTime,
  formatWeekRange,
  sameDay,
  startOfWeekSat,
  weekDays,
  WEEKDAY_LABELS,
} from "@/features/attendance/week";
import type { AttendanceEntry } from "@/lib/types";
import { money } from "@/lib/format";

export default function AttendancePage() {
  const { authorized } = useStaffAccess();
  const { push } = useToast();

  const [signName, setSignName] = useState("");
  const [bankIn, setBankIn] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // The entry currently being checked out (drives the Bank Out dialog).
  const [checkoutTarget, setCheckoutTarget] = useState<AttendanceEntry | null>(null);

  const [weekStart, setWeekStart] = useState(() => startOfWeekSat(new Date()));
  const [rows, setRows] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AttendanceEntry[]>([]);
  const [searching, setSearching] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const searchActive = query.trim().length > 0;

  const refreshWeek = async () => {
    setLoading(true);
    try {
      const from = weekStart;
      const to = addDays(weekStart, 7);
      const data = await listAttendanceBetween(from, to);
      setRows(data);
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    refreshWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, weekStart]);

  // Debounced search
  useEffect(() => {
    if (!authorized) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await searchAttendance(q);
        setResults(data);
      } catch (e: any) {
        push({ kind: "err", msg: e.message });
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, authorized]);

  const handleSignIn = async () => {
    if (!signName.trim() || submitting) return;
    const amount = Number(bankIn);
    if (bankIn.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      push({ kind: "err", msg: "Enter a valid Bank In amount to check in" });
      return;
    }
    setSubmitting(true);
    try {
      await signIn(signName, amount);
      setSignName("");
      setBankIn("");
      push({ kind: "ok", msg: "Checked in" });
      // Jump to the current week so the new entry is visible.
      setWeekStart(startOfWeekSat(new Date()));
      await refreshWeek();
      if (searchActive) {
        setResults(await searchAttendance(query));
      }
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async (entry: AttendanceEntry, bankOut: number) => {
    try {
      await checkOut(entry.id, bankOut);
      setCheckoutTarget(null);
      push({ kind: "ok", msg: "Checked out" });
      await refreshWeek();
      if (searchActive) setResults(await searchAttendance(query));
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await softDeleteAttendance(deletingId);
      setDeletingId(null);
      push({ kind: "ok", msg: "Entry removed" });
      await refreshWeek();
      if (searchActive) setResults(await searchAttendance(query));
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const today = new Date();

  // Group week rows by day index (Sat..Fri).
  const byDay = useMemo(() => {
    const map: AttendanceEntry[][] = days.map(() => []);
    for (const r of rows) {
      const ci = new Date(r.check_in);
      const idx = days.findIndex((d) => sameDay(d, ci));
      if (idx >= 0) map[idx].push(r);
    }
    return map;
  }, [rows, days]);

  const isThisWeek = sameDay(weekStart, startOfWeekSat(new Date()));

  if (!authorized) {
    return (
      <>
        <Topbar title="Attendance" />
        <div className="p-5 text-sm" style={{ color: "var(--muted)" }}>
          Checking access…
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Attendance" />
      <div className="p-5">
        {/* Sign-in bar */}
        <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--muted)" }}>
              Sign Name
            </label>
            <input
              className="input w-full"
              placeholder="e.g. Eslam, Ahmed, Mostafa"
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSignIn();
              }}
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--muted)" }}>
              Bank In (EGP)
            </label>
            <input
              className="input w-full"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={bankIn}
              onChange={(e) => setBankIn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSignIn();
              }}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSignIn}
            disabled={!signName.trim() || bankIn.trim() === "" || submitting}
          >
            <LogIn className="h-4 w-4" /> Check In
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
          />
          <input
            className="input w-full pl-9 pr-9"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searchActive && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--muted)" }}
              onClick={() => setQuery("")}
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {searchActive ? (
          /* ───── Search results: listed view ───── */
          <SearchResults
            loading={searching}
            results={results}
            onRequestCheckOut={setCheckoutTarget}
            onDelete={(id) => setDeletingId(id)}
          />
        ) : (
          <>
            {/* Week navigation */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <button className="btn btn-ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <div className="text-center">
                <div className="text-sm font-semibold">{formatWeekRange(weekStart)}</div>
                {!isThisWeek && (
                  <button
                    className="text-xs underline"
                    style={{ color: "var(--brand)" }}
                    onClick={() => setWeekStart(startOfWeekSat(new Date()))}
                  >
                    Jump to this week
                  </button>
                )}
              </div>
              <button className="btn btn-ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekly sheet */}
            {loading ? (
              <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                Loading…
              </div>
            ) : (
              <div className="grid gap-3">
                {days.map((day, i) => {
                  const entries = byDay[i];
                  const isToday = sameDay(day, today);
                  return (
                    <div
                      key={day.toISOString()}
                      className="card overflow-hidden"
                      style={isToday ? { borderColor: "var(--brand)" } : undefined}
                    >
                      <div
                        className="flex items-center justify-between border-b px-4 py-2.5"
                        style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{WEEKDAY_LABELS[i]}</span>
                          <span className="text-xs" style={{ color: "var(--muted)" }}>
                            {day.toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                          {isToday && (
                            <span
                              className="badge"
                              style={{ background: "var(--brand)", color: "#fff" }}
                            >
                              Today
                            </span>
                          )}
                        </div>
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {entries.length} {entries.length === 1 ? "entry" : "entries"}
                        </span>
                      </div>

                      {entries.length === 0 ? (
                        <div className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                          No sign-ins.
                        </div>
                      ) : (
                        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                          {entries.map((e) => (
                            <AttendanceRow
                              key={e.id}
                              entry={e}
                              onRequestCheckOut={setCheckoutTarget}
                              onDelete={(id) => setDeletingId(id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deletingId}
        title="Remove attendance entry"
        message="This sign-in record will be removed. This cannot be undone."
        confirmLabel="Remove"
        destructive
        onCancel={() => setDeletingId(null)}
        onConfirm={handleDelete}
      />

      <CheckOutDialog
        entry={checkoutTarget}
        onCancel={() => setCheckoutTarget(null)}
        onConfirm={(amount) => {
          if (checkoutTarget) handleCheckOut(checkoutTarget, amount);
        }}
      />
    </>
  );
}

function CheckOutDialog({
  entry,
  onCancel,
  onConfirm,
}: {
  entry: AttendanceEntry | null;
  onCancel: () => void;
  onConfirm: (bankOut: number) => void;
}) {
  const [bankOut, setBankOut] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset the field whenever a new entry is targeted.
  useEffect(() => {
    setBankOut("");
    setBusy(false);
  }, [entry?.id]);

  if (!entry) return null;

  const amount = Number(bankOut);
  const valid = bankOut.trim() !== "" && Number.isFinite(amount) && amount >= 0;

  const submit = () => {
    if (!valid || busy) return;
    setBusy(true);
    onConfirm(amount);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onCancel}
    >
      <div
        className="card w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2">
          <LogOut className="h-4 w-4" style={{ color: "var(--brand)" }} />
          <h2 className="text-sm font-semibold">Check Out — {entry.sign_name}</h2>
        </div>
        <p className="mb-4 text-xs" style={{ color: "var(--muted)" }}>
          Checking out now. Enter the money amount left before checkout.
        </p>

        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--muted)" }}>
          Bank Out (EGP)
        </label>
        <input
          className="input w-full"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          autoFocus
          value={bankOut}
          onChange={(e) => setBankOut(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!valid || busy}>
            <LogOut className="h-4 w-4" /> Check Out
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchResults({
  loading,
  results,
  onRequestCheckOut,
  onDelete,
}: {
  loading: boolean;
  results: AttendanceEntry[];
  onRequestCheckOut: (e: AttendanceEntry) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
        Searching…
      </div>
    );
  }
  if (results.length === 0) {
    return (
      <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
        No matching entries.
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {results.map((e) => (
          <AttendanceRow
            key={e.id}
            entry={e}
            showDate
            onRequestCheckOut={onRequestCheckOut}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function AttendanceRow({
  entry,
  showDate = false,
  onRequestCheckOut,
  onDelete,
}: {
  entry: AttendanceEntry;
  showDate?: boolean;
  onRequestCheckOut: (e: AttendanceEntry) => void;
  onDelete: (id: string) => void;
}) {
  const checkedOut = !!entry.check_out;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{entry.sign_name}</div>
        <div
          className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]"
          style={{ color: "var(--muted)" }}
        >
          {showDate && <span>{new Date(entry.check_in).toLocaleDateString()}</span>}
          <span className="inline-flex items-center gap-1">
            <LogIn className="h-3 w-3" /> In {formatTime(entry.check_in)}
          </span>
          <span className="inline-flex items-center gap-1">
            <LogOut className="h-3 w-3" />
            {checkedOut ? `Out ${formatTime(entry.check_out)}` : "Still in"}
          </span>
        </div>
        {/* Bank amounts */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
          <span className="inline-flex items-center gap-1" style={{ color: "var(--muted)" }}>
            <Wallet className="h-3 w-3" /> In{" "}
            <span style={{ color: "var(--text)", fontWeight: 500 }}>
              {entry.bank_in != null ? money(entry.bank_in) : "—"}
            </span>
          </span>
          <span className="inline-flex items-center gap-1" style={{ color: "var(--muted)" }}>
            Out{" "}
            <span style={{ color: "var(--text)", fontWeight: 500 }}>
              {entry.bank_out != null ? money(entry.bank_out) : "—"}
            </span>
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {checkedOut ? (
          <span
            className="badge inline-flex items-center gap-1"
            style={{
              background: "var(--brand-success)",
              color: "#14532D",
              border: "1px solid rgba(22,163,74,0.35)",
            }}
          >
            <Clock className="h-3 w-3" /> Done
          </span>
        ) : (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition"
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
            onClick={() => onRequestCheckOut(entry)}
            title="Check out now"
          >
            <LogOut className="h-3.5 w-3.5" /> Check Out
          </button>
        )}
        <button
          className="rounded-md p-1.5 transition hover:opacity-70"
          style={{ color: "var(--muted)" }}
          onClick={() => onDelete(entry.id)}
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
