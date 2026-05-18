export const TZ = process.env.APP_TIMEZONE || 'UTC';

// "YYYY-MM-DD" in the configured app timezone
export function localDateStr(d: Date = new Date(), tz: string = TZ): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d);
}

export function localDayOfWeek(d: Date = new Date(), tz: string = TZ): number {
  // 0 = Sunday .. 6 = Saturday, matched to JS getDay()
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[fmt.format(d).slice(0, 3)] ?? 0;
}

export function localMinutesSinceMidnight(d: Date = new Date(), tz: string = TZ): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [h, m] = fmt.format(d).split(':').map(Number);
  return h * 60 + m;
}

export function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function diffDaysISO(a: string, b: string): number {
  // b - a, in whole days
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  const aMs = Date.UTC(ya, ma - 1, da);
  const bMs = Date.UTC(yb, mb - 1, db);
  return Math.round((bMs - aMs) / 86_400_000);
}

export function isoWeekStart(dateStr: string): string {
  // Returns Monday of the week containing dateStr (ISO week, Mon=start)
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7; // Sun = 7
  if (day !== 1) dt.setUTCDate(dt.getUTCDate() - (day - 1));
  return dt.toISOString().slice(0, 10);
}

export function monthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01';
}
