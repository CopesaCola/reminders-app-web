import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { goals, entries } from '@/lib/schema';
import { and, eq, gte } from 'drizzle-orm';
import { ArrowLeft, Flame, Trophy, Target as TargetIcon, CalendarClock, Pencil } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { CheckInForm } from '@/components/CheckInForm';
import { TrendChart } from '@/components/TrendChart';
import { Heatmap } from '@/components/Heatmap';
import { GoalForm } from '@/components/GoalForm';
import { addDaysISO, localDateStr } from '@/lib/date';
import { bucketEntries, computeStreak, periodHits, periodKey } from '@/lib/cadence';

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-card-2 border border-border px-3 py-2">
      <Icon size={18} className="text-accent shrink-0" />
      <div className="leading-tight">
        <div className="text-sm font-semibold tnum">{value}</div>
        <div className="text-[11px] text-muted">{label}</div>
      </div>
    </div>
  );
}

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

  const overdue = isTodo && !goal.completedAt && goal.dueDate != null && goal.dueDate < today;

  return (
    <>
      <Nav />
      <main
        className={`${isTodo ? 'max-w-2xl' : 'max-w-6xl'} mx-auto px-4 py-8 space-y-6 animate-fade-in`}
      >
        <Link
          href="/goals"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft size={16} />
          All goals
        </Link>

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip-accent capitalize">{isTodo ? 'one-time' : goal.type}</span>
            {!isTodo && <span className="chip-muted capitalize">{goal.cadence}</span>}
            {goal.pausedUntil && <span className="chip-muted">paused until {goal.pausedUntil}</span>}
            {goal.archivedAt && <span className="chip-muted">archived</span>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{goal.title}</h1>
          {goal.why && <p className="text-muted">{goal.why}</p>}
        </header>

        {/* Stats */}
        {isTodo ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Stat
              icon={CalendarClock}
              label="Due date"
              value={goal.dueDate ?? 'None'}
            />
            <Stat
              icon={TargetIcon}
              label="Status"
              value={goal.completedAt ? 'Completed' : overdue ? 'Overdue' : 'Open'}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Stat icon={Flame} label="Current streak" value={String(streak.current)} />
            <Stat icon={Trophy} label="Best streak" value={String(streak.longest)} />
            {goal.targetValue ? (
              <Stat
                icon={TargetIcon}
                label="Target"
                value={`${goal.targetValue} ${goal.targetUnit ?? ''}`.trim()}
              />
            ) : null}
          </div>
        )}

        {isTodo ? (
          <>
            {!goal.archivedAt && !goal.pausedUntil && (
              <div className="card p-5">
                <p className="text-sm font-semibold mb-3">Mark this done when you finish it</p>
                <CheckInForm goal={goal} todayEntry={todayEntry} />
              </div>
            )}
            <details className="card p-5 group">
              <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold list-none">
                <Pencil size={16} className="text-accent" />
                Edit goal
              </summary>
              <div className="mt-4 pt-4 border-t border-border">
                <GoalForm goal={goal} />
              </div>
            </details>
          </>
        ) : (
          /* Desktop: trend + history fill the wide left column; check-in + edit sit in the
             right column. Explicit grid placement keeps the mobile DOM order intact
             (check-in → trend → history → edit). */
          <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start space-y-6 lg:space-y-0">
            {!goal.archivedAt && !goal.pausedUntil && (
              <div className="card p-5 lg:col-start-3 lg:row-start-1">
                <p className="text-sm font-semibold mb-3">Check in for today · {today}</p>
                <CheckInForm goal={goal} todayEntry={todayEntry} />
              </div>
            )}

            <div className="card p-5 lg:col-span-2 lg:col-start-1 lg:row-start-1">
              <p className="text-sm font-semibold mb-3">
                Trend
                <span className="text-muted font-normal">
                  {' · '}
                  {goal.cadence === 'daily' ? 'last 30 days' : 'last 12 periods'}
                </span>
              </p>
              <TrendChart
                data={chartData}
                target={goal.targetValue ?? undefined}
                unit={goal.targetUnit ?? undefined}
                kind={goal.cadence === 'daily' ? 'line' : 'bar'}
              />
            </div>

            <div className="card p-5 lg:col-span-2 lg:col-start-1 lg:row-start-2">
              <p className="text-sm font-semibold mb-3">History</p>
              <Heatmap cells={[...cellMap.values()]} weeks={26} />
            </div>

            <details className="card p-5 group lg:col-start-3 lg:row-start-2">
              <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold list-none">
                <Pencil size={16} className="text-accent" />
                Edit goal
              </summary>
              <div className="mt-4 pt-4 border-t border-border">
                <GoalForm goal={goal} />
              </div>
            </details>
          </div>
        )}
      </main>
    </>
  );
}
