// Week helpers — the week starts on Saturday.

// Returns the Saturday (00:00 local) on or before the given date.
export function startOfWeekSat(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // JS getDay(): Sun=0, Mon=1 ... Sat=6. Days since the most recent Saturday.
  const diff = (d.getDay() + 1) % 7; // Sat->0, Sun->1, ... Fri->6
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// The 7 day-start dates (Sat..Fri) for the week containing `weekStart`.
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const WEEKDAY_LABELS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const fmtDay = new Intl.DateTimeFormat([], { month: "short", day: "numeric" });

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${fmtDay.format(weekStart)} – ${fmtDay.format(end)}, ${end.getFullYear()}`;
}

const fmtTime = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });

export function formatTime(iso: string | null): string {
  return iso ? fmtTime.format(new Date(iso)) : "—";
}
