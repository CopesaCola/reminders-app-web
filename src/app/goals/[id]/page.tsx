import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { goals, entries } from '@/lib/schema';
import { and, eq, gte } from 'drizzle-orm';
import { Nav } from '@/components/Nav';
import { CheckInForm } from '@/components/CheckInForm';
import { TrendChart } from '@/components/TrendChart';
import { Heatmap } from '@/components/Heatmap';
import { GoalForm } from '@/components/GoalForm';
import { addDaysISO, localDateStr } from '@/lib/date';
import { bucketEntries, computeStreak, periodHits, periodKey } from '@/lib/cadence';

export const dynamic = 'force-dynamic';

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const goal = (await db.select().from(goals).where(eq(goals.id, Number(id))).limit(1))[0];
  if (!goal) notFound();

  const isTodo = goal.type === 'todo';
  const today = localDateStr();
  const since = addDaysISO(today, -365);
  const rows = isTodo
    ? []
    : await db
        .select()
        .from(entries)
        .where(and(eq(entries.goalId, goal.id), gte(entries.entryDate, since)));

  const todayEntry = rows.find((r) => r.entryDate === today) ?? null;
  const streak = computeStreak(goal, rows, today);
  const buckets = bucketEntries(goal, rows);

  // chart data: last 30 daily entries OR last 12 weeks/months depending on cadence
  let chartData: { date: string; value: number }[] = [];
  if (goal.cadence === 'daily') {
    for (let i = 29; i >= 0; i--) {
      const d = addDaysISO(today, -i);
      chartData.push({ date: d, value: buckets.get(d) ?? 0 });
    }
  } else {
    // walk back 12 periods
    let cur = periodKey(goal.cadence as any, today);
    const stack: { date: string; value: number }[] = [];
    for (let i = 0; i < 12; i++) {
      stack.unshift({ date: cur, value: buckets.get(cur) ?? 0 });
      const [y, m, d] = cur.split('-').map(Number);
      const prev = goal.cadence === 'weekly'
        ? addDaysISO(cur, -7)
        : `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}-01`;
      cur = prev;
    }
    chartData = stack;
  }

  // Heatmap cells from rows
  const cellMap = new Map<string, { date: string; level: 0 | 1 | 2 | 3 | 4 }>();
  for (const r of rows) {
    const lvl = (periodHits(goal, r.value) ? 4 : 1) as 0 | 1 | 2 | 3 | 4;
    cellMap.set(r.entryDate, { date: r.entryDate, level: lvl });
  }

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">{goal.title}</h1>
            {goal.why && <p className="text-sm text-muted mt-1">Why: {goal.why}</p>}
            <div className="text-xs text-muted mt-2 flex flex-wrap gap-x-3">
              {isTodo ? (
                <>
                  <span>one-time</span>
                  {goal.dueDate && (
                    <span
                      className={
                        !goal.completedAt && goal.dueDate < today ? 'text-bad' : undefined
                      }
                    >
                      due {goal.dueDate}
                    </span>
                  )}
                  <span>{goal.completedAt ? 'completed' : 'open'}</span>
                </>
              ) : (
                <>
                  <span>{goal.type}</span>
                  <span>{goal.cadence}</span>
                  {goal.targetValue ? (
                    <span>
                      target {goal.targetValue} {goal.targetUnit ?? ''}
                    </span>
                  ) : null}
                  <span>🔥 current {streak.current}</span>
                  <span>best {streak.longest}</span>
                </>
              )}
            </div>
          </div>
          <Link href="/goals" className="btn">
            All goals
          </Link>
        </div>

        {!goal.archivedAt && !goal.pausedUntil && (
          <div className="card p-4">
            <p className="text-sm font-medium mb-2">
              {isTodo ? 'Mark this done when you finish it' : `Check in for today (${today})`}
            </p>
            <CheckInForm goal={goal} todayEntry={todayEntry} />
          </div>
        )}

        {!isTodo && (
          <>
            <div className="card p-4">
              <p className="text-sm font-medium mb-2">
                Trend ({goal.cadence === 'daily' ? 'last 30 days' : 'last 12 periods'})
              </p>
              <TrendChart
                data={chartData}
                target={goal.targetValue ?? undefined}
                unit={goal.targetUnit ?? undefined}
                kind={goal.cadence === 'daily' ? 'line' : 'bar'}
              />
            </div>

            <div className="card p-4">
              <p className="text-sm font-medium mb-2">History</p>
              <Heatmap cells={[...cellMap.values()]} weeks={26} />
            </div>
          </>
        )}

        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-medium">Edit goal</summary>
          <div className="mt-3">
            <GoalForm goal={goal} />
          </div>
        </details>
      </main>
    </>
  );
}
