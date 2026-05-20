import { addDaysISO, diffDaysISO, isoWeekStart, monthStart } from './date';
import type { Goal, Entry } from './schema';

export type Cadence = 'daily' | 'weekly' | 'monthly';

// "did this goal count as done on/within this period?"
export function entryCountsAsDone(goal: Goal, e: Entry): boolean {
  if (goal.type === 'binary') return e.value > 0;
  if (goal.type === 'quantitative') {
    // single entry alone doesn't satisfy a target; period-aggregation handles that
    return e.value > 0;
  }
  if (goal.type === 'milestone') return e.value > 0;
  return false;
}

// Group entries into period buckets (date string -> sum of values).
export function bucketEntries(goal: Goal, entries: Entry[]): Map<string, number> {
  const buckets = new Map<string, number>();
  for (const e of entries) {
    const key = periodKey(goal.cadence as Cadence, e.entryDate);
    buckets.set(key, (buckets.get(key) ?? 0) + e.value);
  }
  return buckets;
}

export function periodKey(cadence: Cadence, dateStr: string): string {
  if (cadence === 'daily') return dateStr;
  if (cadence === 'weekly') return isoWeekStart(dateStr);
  return monthStart(dateStr);
}

export function previousPeriodKey(cadence: Cadence, key: string): string {
  if (cadence === 'daily') return addDaysISO(key, -1);
  if (cadence === 'weekly') return addDaysISO(key, -7);
  // monthly: subtract one month
  const [y, m] = key.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  return `${prev}-01`;
}

export function periodHits(goal: Goal, totalForPeriod: number): boolean {
  if (goal.type === 'binary') return totalForPeriod > 0;
  if (goal.type === 'milestone') return totalForPeriod > 0;
  // quantitative: needs to meet target
  const target = goal.targetValue ?? 0;
  if (target <= 0) return totalForPeriod > 0;
  return totalForPeriod >= target;
}

// Current streak: how many consecutive prior+current periods hit the target.
// We include the current period if it already hits; otherwise start from the previous period.
export function computeStreak(goal: Goal, entries: Entry[], todayStr: string): {
  current: number;
  longest: number;
} {
  // One-time todos have no recurring cadence, so streaks don't apply.
  if (goal.type === 'todo') return { current: 0, longest: 0 };
  const buckets = bucketEntries(goal, entries);
  const cadence = goal.cadence as Cadence;
  const currentPeriod = periodKey(cadence, todayStr);

  // Walk backward from current period (if hit) or previous period (if not yet hit today)
  let cursor = periodHits(goal, buckets.get(currentPeriod) ?? 0)
    ? currentPeriod
    : previousPeriodKey(cadence, currentPeriod);

  let current = 0;
  while (periodHits(goal, buckets.get(cursor) ?? 0)) {
    current++;
    cursor = previousPeriodKey(cadence, cursor);
    // Safety: cap at 10 years of daily streaks
    if (current > 4000) break;
  }

  // Longest streak: walk all observed buckets sorted asc
  const keys = [...buckets.keys()].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    if (!periodHits(goal, buckets.get(k) ?? 0)) {
      prev = k;
      run = 0;
      continue;
    }
    if (prev && previousPeriodKey(cadence, k) === prev) run++;
    else run = 1;
    if (run > longest) longest = run;
    prev = k;
  }
  if (current > longest) longest = current;

  return { current, longest };
}

export function isPaused(goal: Goal, todayStr: string): boolean {
  if (!goal.pausedUntil) return false;
  return todayStr <= goal.pausedUntil;
}
