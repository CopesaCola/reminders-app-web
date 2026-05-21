import Link from 'next/link';
import { db } from '@/lib/db';
import { goals, entries } from '@/lib/schema';
import { isNull, gte, asc, desc } from 'drizzle-orm';
import { Flame, Plus, Target, CircleCheck, ListChecks, Trophy } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Heatmap } from '@/components/Heatmap';
import { CheckInForm } from '@/components/CheckInForm';
import { ProgressRing } from '@/components/ProgressRing';
import { addDaysISO, localDateStr } from '@/lib/date';
import { computeStreak, isPaused, periodHits, periodKey, bucketEntries } from '@/lib/cadence';

export const dynamic = 'force-dynamic';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const periodWord = (c: string) => (c === 'daily' ? 'today' : c === 'weekly' ? 'this week' : 'this month');

function SummaryStat({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent-soft text-accent shrink-0">
        <Icon size={20} />
      </span>
      <div className="leading-tight">
        <div className="text-xl font-bold tnum">{value}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const today = localDateStr();
  const since = addDaysISO(today, -180);

  const goalRows = await db
    .select()
    .from(goals)
    .where(isNull(goals.archivedAt))
    .orderBy(asc(goals.sortOrder), desc(goals.createdAt));

  const entryRows = await db.select().from(entries).where(gte(entries.entryDate, since));

  const entriesByGoal = new Map<number, typeof entryRows>();
  for (const e of entryRows) {
    const arr = entriesByGoal.get(e.goalId) ?? [];
    arr.push(e);
    entriesByGoal.set(e.goalId, arr);
  }

  const recurringGoals = goalRows.filter((g) => g.type !== 'todo');
  const todoGoals = goalRows.filter((g) => g.type === 'todo');
  todoGoals.sort((a, b) => {
    const ac = a.completedAt ? 1 : 0;
    const bc = b.completedAt ? 1 : 0;
    if (ac !== bc) return ac - bc;
    const ad = a.dueDate ?? '9999-12-31';
    const bd = b.dueDate ?? '9999-12-31';
    return ad.localeCompare(bd);
  });

  // Today's progress across active, non-paused recurring goals whose current period is "today-ish".
  let dueCount = 0;
  let hitCount = 0;
  for (const g of recurringGoals) {
    if (isPaused(g, today)) continue;
    const gEntries = entriesByGoal.get(g.id) ?? [];
    const total = bucketEntries(g, gEntries).get(periodKey(g.cadence as any, today)) ?? 0;
    dueCount++;
    if (periodHits(g, total)) hitCount++;
  }
  // Once a to-do is done it drops off the dashboard (still kept in Goals for the record).
  const openTodoGoals = todoGoals.filter((t) => !t.completedAt);
  const openTodos = openTodoGoals.length;

  // Longest current streak among active recurring goals (for the desktop summary).
  let maxStreak = 0;
  for (const g of recurringGoals) {
    const s = computeStreak(g, entriesByGoal.get(g.id) ?? [], today).current;
    if (s > maxStreak) maxStreak = s;
  }

  // Heatmap: fraction of daily recurring goals hit each day over ~6 months.
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
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
        {/* Header */}
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{greeting()}</p>
            <h1 className="text-2xl font-bold tracking-tight">
              {dueCount === 0
                ? 'Ready when you are'
                : hitCount === dueCount
                  ? 'All done for today'
                  : `${hitCount} of ${dueCount} done today`}
            </h1>
          </div>
          <Link href="/goals/new" className="btn-primary shrink-0">
            <Plus size={16} />
            New goal
          </Link>
        </header>

        {/* Desktop summary stats — hidden on mobile (the heading already covers today). */}
        {goalRows.length > 0 && (
          <div className="hidden lg:grid grid-cols-3 gap-4">
            <SummaryStat
              icon={ListChecks}
              value={dueCount === 0 ? '—' : `${hitCount}/${dueCount}`}
              label="Goals done today"
            />
            <SummaryStat icon={Flame} value={String(maxStreak)} label="Longest active streak" />
            <SummaryStat icon={CircleCheck} value={String(openTodos)} label="Open to-dos" />
          </div>
        )}

        {/* Heatmap */}
        {heatCells.length > 0 && (
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted">Consistency</h2>
              <span className="text-xs text-muted-2 tnum">last 6 months</span>
            </div>
            <Heatmap cells={heatCells} />
            <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-2">
              <span>Less</span>
              <span className="w-3 h-3 rounded-[3px] bg-card-2 border border-border" />
              <span className="w-3 h-3 rounded-[3px] bg-accent/30" />
              <span className="w-3 h-3 rounded-[3px] bg-accent/55" />
              <span className="w-3 h-3 rounded-[3px] bg-accent/80" />
              <span className="w-3 h-3 rounded-[3px] bg-accent" />
              <span>More</span>
            </div>
          </section>
        )}

        {/* Empty state */}
        {goalRows.length === 0 && (
          <div className="card p-10 text-center flex flex-col items-center gap-3">
            <span className="grid place-items-center w-14 h-14 rounded-2xl bg-accent-soft text-accent">
              <Target size={26} />
            </span>
            <div>
              <p className="font-semibold">No goals yet</p>
              <p className="text-sm text-muted mt-1">
                Track a habit, a weekly target, or a one-time task.
              </p>
            </div>
            <Link href="/goals/new" className="btn-primary mt-1">
              <Plus size={16} />
              Create your first goal
            </Link>
          </div>
        )}

        {/* Recurring goals */}
        {recurringGoals.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recurringGoals.map((g) => {
              const gEntries = entriesByGoal.get(g.id) ?? [];
              const todayEntry = gEntries.find((e) => e.entryDate === today) ?? null;
              const streak = computeStreak(g, gEntries, today);
              const paused = isPaused(g, today);
              const periodTotal =
                bucketEntries(g, gEntries).get(periodKey(g.cadence as any, today)) ?? 0;
              const target = g.targetValue ?? 0;
              const hit = periodHits(g, periodTotal);
              return (
                <div
                  key={g.id}
                  className={`card p-4 transition-colors ${hit ? 'border-accent/30' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {g.type === 'quantitative' && target > 0 && (
                        <ProgressRing
                          value={periodTotal}
                          target={target}
                          label={`${periodTotal} of ${target} ${g.targetUnit ?? ''} ${periodWord(g.cadence)}`}
                        />
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/goals/${g.id}`}
                          className="font-semibold hover:text-accent transition-colors truncate block"
                        >
                          {g.title}
                        </Link>
                        <div className="text-xs text-muted mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="capitalize">{g.cadence}</span>
                          {g.type === 'quantitative' && target > 0 && (
                            <span className="tnum">
                              {periodTotal}/{target} {g.targetUnit ?? ''}
                            </span>
                          )}
                          {streak.current > 0 && (
                            <span className="inline-flex items-center gap-1 text-accent font-medium">
                              <Flame size={13} />
                              <span className="tnum">{streak.current}</span>
                            </span>
                          )}
                          {paused && <span className="chip-muted">paused</span>}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {paused ? (
                        <span className="text-xs text-muted-2">resumes {g.pausedUntil}</span>
                      ) : (
                        <CheckInForm goal={g} todayEntry={todayEntry} compact />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* To-dos — only open ones; completed items drop off automatically. */}
        {openTodoGoals.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted px-1">
              <CircleCheck size={16} />
              To-do
              <span className="chip-muted tnum">{openTodos}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {openTodoGoals.map((g) => {
                const overdue = g.dueDate != null && g.dueDate < today;
                const dueToday = g.dueDate === today;
                return (
                  <div key={g.id} className="card p-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckInForm goal={g} compact />
                      <div className="min-w-0">
                        <Link
                          href={`/goals/${g.id}`}
                          className="font-medium hover:text-accent transition-colors truncate block"
                        >
                          {g.title}
                        </Link>
                        {g.dueDate && (
                          <span
                            className={`text-xs ${
                              overdue
                                ? 'text-bad font-medium'
                                : dueToday
                                  ? 'text-warn font-medium'
                                  : 'text-muted'
                            }`}
                          >
                            {overdue
                              ? `Overdue · ${g.dueDate}`
                              : dueToday
                                ? 'Due today'
                                : `Due ${g.dueDate}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
