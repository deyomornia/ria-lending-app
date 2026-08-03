import type { PaymentFrequency } from "./types";

/**
 * Pure calendar-date math on YYYY-MM-DD strings. Dates are Manila calendar
 * dates; by never constructing a local-timezone Date we avoid all tz bugs.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function parseYmd(s: string): { y: number; m: number; d: number } {
  if (!YMD.test(s)) throw new Error(`Invalid date "${s}", expected YYYY-MM-DD`);
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    throw new Error(`Invalid calendar date "${s}"`);
  }
  return { y, m, d };
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parseYmd(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: string, b: string): number {
  const pa = parseYmd(a);
  const pb = parseYmd(b);
  return Math.round(
    (Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000
  );
}

/** Add months keeping the anchor day-of-month, clamped to month length (Jan 31 → Feb 28). */
export function addMonthsClamped(date: string, months: number, anchorDay?: number): string {
  const { y, m, d } = parseYmd(date);
  const day = anchorDay ?? d;
  const total = (m - 1) + months;
  const ty = y + Math.floor(total / 12);
  const tm = (total % 12 + 12) % 12 + 1;
  return fmt(ty, tm, Math.min(day, daysInMonth(ty, tm)));
}

/** Next kinsenas/katapusan date strictly after `date`: the 15th or end of month. */
export function nextSemiMonthly(date: string): string {
  const { y, m, d } = parseYmd(date);
  const eom = daysInMonth(y, m);
  if (d < 15) return fmt(y, m, 15);
  if (d < eom) return fmt(y, m, eom);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return fmt(ny, nm, 15);
}

/**
 * Generate `count` due dates for a schedule.
 * - daily: consecutive days
 * - weekly: every 7 days
 * - semi_monthly: alternating 15th / end-of-month (kinsenas & katapusan)
 * - monthly: same day-of-month as the first due date, clamped
 */
export function generateDueDates(
  releaseDate: string,
  frequency: PaymentFrequency,
  count: number,
  firstDueDate?: string
): string[] {
  if (count <= 0) throw new Error(`count must be > 0, got ${count}`);
  const first = firstDueDate ?? defaultFirstDueDate(releaseDate, frequency);
  parseYmd(first);
  const dates: string[] = [first];
  const anchorDay = parseYmd(first).d;
  for (let i = 1; i < count; i++) {
    const prev = dates[i - 1];
    switch (frequency) {
      case "daily":
        dates.push(addDays(prev, 1));
        break;
      case "weekly":
        dates.push(addDays(prev, 7));
        break;
      case "semi_monthly":
        dates.push(nextSemiMonthly(prev));
        break;
      case "monthly":
        dates.push(addMonthsClamped(prev, 1, anchorDay));
        break;
    }
  }
  return dates;
}

export function defaultFirstDueDate(releaseDate: string, frequency: PaymentFrequency): string {
  switch (frequency) {
    case "daily":
      return addDays(releaseDate, 1);
    case "weekly":
      return addDays(releaseDate, 7);
    case "semi_monthly":
      return nextSemiMonthly(releaseDate);
    case "monthly":
      return addMonthsClamped(releaseDate, 1);
  }
}
