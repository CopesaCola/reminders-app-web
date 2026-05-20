import Link from 'next/link';
import { db } from '@/lib/db';
import { goals, entries } from '@/lib/schema';
import { and, isNull, eq, gte, asc, desc } from 'drizzle-orm';
import { Nav } from '@/components/Nav';
import { Heatmap } from '@/components/Heatmap';
import { CheckInForm } from '@/components/CheckInForm';
import { addDaysISO, localDateStr } from '@/lib/date';
import { computeStreak, isPaused, periodHits, periodKey, bucketEntries } from '@/lib/cadence';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const today = localDateStr();
  const since = addDaysISO(today, -180);

  const goalRows = await db
    .select()
    .from(goals)
    .where(isNull(goals.archivedAt))
    .orderBy(asc(goals.sortOrder), desc(goals.createdAt));

  const entryRows = await db.select().from(entries).where(gte(entries.entryDate, since));

  // Group entries by goal
  const entriesByGoal = new Map<number, typeof entryRows>();
  for (const e of entryRows) {
    const arr = entriesByGoal.get(e.goalId) ?? [];
    arr.push(e);
    entriesByGoal.set(e.goalId, arr);
  }

  // Split one-time todos out from recurring goals.
  const recurringGoals = goalRows.filter((g) => g.type !== 'todo');
  const todoGoals = goalRows.filter((g) => g.type === 'todo');
  // Show open todos first (overdue first), then completed ones last.
  todoGoals.sort((a, b) => {
    const ac = a.completedAt ? 1 : 0;
    const bc = b.completedAt ? 1 : 0;
    if (ac !== bc) return ac - bc;
    const ad = a.dueDate ?? '9999-12-31';
    const bd = b.dueDate ?? '9999-12-31';
    return ad.localeCompare(bd);
  });

  // Aggregate heatmap across recurring daily goals: level = fraction of goals hit that day.
  const dailyHitCount = new Map<string, { hit: number; total: number }>();
  for (const g of recurringGoals) {
    if (g.cadence !== 'daily') continue;
    const gEntries = entriesByGoal.get(g.id) ?? [];
    const byDate = new Map(gEntries.map((e) => [e.entryDate, e.value]));
    for (let i = 0; i < 180; i++) {
      const d = addDaysISO(today, -i);
      if (isPaused(g, d)) continue;
      const v = byDate.get(d) ?? 0;
      const stats = dailyHitCount.get(d) ?? { hit: 0, total: 0 };
      stats.total++;
      if (periodHits(g, v)) stats.hit++;
      dailyHitCount.set(d, stats);
    }
  }
  const heatCells = [...dailyHitCount.entries()].map(([date, s]) => {
    const frac = s.total === 0 ? 0 : s.hit / s.total;
    const level = (frac === 0 ? 0 : frac < 0.34 ? 1 : frac < 0.67 ? 2 : frac < 1 ? 3 : 4) as
      | 0
      | 1
      | 2
      | 3
      | 4;
    return { date, level, label: `${s.hit}/${s.total}` };
  });

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">
              Last ~6 months
            </h2>
            <span className="text-xs text-muted">{today}</span>
          </div>
          <Heatmap cells={heatCells} />
          <p className="text-xs text-muted mt-1">
            Each square is one day. Darker = more daily goals hit.
          </p>
        </section>

        {goalRows.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-muted">No goals yet.</p>
            <Link href="/goals/new" className="btn-primary mt-3 inline-flex">
              Create your first goal
            </Link>
          </div>
        )}

        <section className="space-y-3">
          {recurringGoals.map((g) => {
            const gEntries = entriesByGoal.get(g.id) ?? [];
            const todayEntry = gEntries.find((e) => e.entryDate === today) ?? null;
            const streak = computeStreak(g, gEntries, today);
            const paused = isPaused(g, today);
            const periodTotal =
              bucketEntries(g, gEntries).get(periodKey(g.cadence as any, today)) ?? 0;
            const target = g.targetValue ?? 0;
            return (
              <div key={g.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/goals/${g.id}`}
                      className="font-medium text-base hover:underline truncate block"
                    >
                      {g.title}
                    </Link>
                    {g.why && (
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">
                        Why: {g.why}
                      </p>
                    )}
                    <div className="text-xs text-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{g.cadence}</span>
                      {g.type === 'quantitative' && target > 0 && (
                        <span>
                          {periodTotal}/{target} {g.targetUnit ?? ''}
                        </span>
                      )}
                      <span>🔥 {streak.current}</span>
                      {streak.longest > 0 && <span>best {streak.longest}</span>}
                      {paused && <span className="text-warn">paused</span>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {paused ? (
                      <span className="text-xs text-muted">resumes {g.pausedUntil}</span>
                    ) : (
                      <CheckInForm goal={g} todayEntry={todayEntry} compact />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {todoGoals.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted">To-do</h2>
            {todoGoals.map((g) => {
              const done = g.completedAt != null;
              const overdue = !done && g.dueDate != null && g.dueDate < today;
              const dueToday = !done && g.dueDate === today;
              return (
                <div key={g.id} className="card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/goals/${g.id}`}
                        className={`font-medium hover:underline truncate block ${
                          done ? 'line-through text-muted' : ''
                        }`}
                      >
                        {g.title}
                      </Link>
                      <div className="text-xs mt-0.5 flex flex-wrap gap-x-3">
                        {g.dueDate && (
                          <span
                            className={
                              overdue ? 'text-bad' : dueToday ? 'text-warn' : 'text-muted'
                            }
                          >
                            {overdue ? 'Overdue ' : dueToday ? 'Due today' : 'Due '}
                            {!dueToday && g.dueDate}
                          </span>
                        )}
                        {done && <span className="text-muted">completed</span>}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <CheckInForm goal={g} compact />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </>
  );
}
