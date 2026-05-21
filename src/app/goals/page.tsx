import Link from 'next/link';
import { db } from '@/lib/db';
import { goals } from '@/lib/schema';
import { asc, desc } from 'drizzle-orm';
import { ChevronRight, Plus, CheckCircle2, Circle, Repeat, Hash, Flag, ListTodo } from 'lucide-react';
import { Nav } from '@/components/Nav';
import type { Goal } from '@/lib/schema';

export const dynamic = 'force-dynamic';

const typeMeta: Record<string, { label: string; icon: any }> = {
  binary: { label: 'Habit', icon: Repeat },
  quantitative: { label: 'Target', icon: Hash },
  milestone: { label: 'Milestone', icon: Flag },
  todo: { label: 'One-time', icon: ListTodo },
};

function meta(g: Goal): string {
  if (g.type === 'todo') {
    const bits = [g.dueDate ? `due ${g.dueDate}` : null, g.completedAt ? 'completed' : 'open'].filter(
      Boolean
    );
    return bits.join(' · ');
  }
  const bits = [
    g.cadence,
    g.targetValue ? `target ${g.targetValue} ${g.targetUnit ?? ''}`.trim() : null,
    g.pausedUntil ? `paused until ${g.pausedUntil}` : null,
  ].filter(Boolean);
  return bits.join(' · ');
}

function GoalRow({ g, dim = false }: { g: Goal; dim?: boolean }) {
  const t = typeMeta[g.type] ?? typeMeta.binary;
  const Icon = t.icon;
  const done = g.type === 'todo' && g.completedAt != null;
  return (
    <Link
      href={`/goals/${g.id}`}
      className={`card p-4 flex items-center gap-3 hover:border-accent/40 transition-colors ${
        dim ? 'opacity-60 hover:opacity-90' : ''
      }`}
    >
      <span className="grid place-items-center w-9 h-9 rounded-xl bg-accent-soft text-accent shrink-0">
        {done ? <CheckCircle2 size={18} /> : <Icon size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-medium truncate ${done ? 'line-through text-muted' : ''}`}>{g.title}</p>
        <p className="text-xs text-muted truncate">
          <span className="text-accent">{t.label}</span>
          {meta(g) && <span> · {meta(g)}</span>}
        </p>
      </div>
      <ChevronRight size={18} className="text-muted-2 shrink-0" />
    </Link>
  );
}

export default async function GoalsPage() {
  const rows = await db
    .select()
    .from(goals)
    .orderBy(asc(goals.archivedAt), asc(goals.sortOrder), desc(goals.createdAt));
  const active = rows.filter((r) => !r.archivedAt);
  const archived = rows.filter((r) => r.archivedAt);
  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-5 animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
          <Link href="/goals/new" className="btn-primary">
            <Plus size={16} />
            New goal
          </Link>
        </header>

        {active.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((g) => (
              <GoalRow key={g.id} g={g} />
            ))}
          </div>
        )}
        {active.length === 0 && (
          <div className="card p-10 text-center text-sm text-muted flex flex-col items-center gap-3">
            <Circle size={28} className="text-muted-2" />
            No active goals yet.
            <Link href="/goals/new" className="btn-primary">
              <Plus size={16} />
              New goal
            </Link>
          </div>
        )}

        {archived.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <h2 className="text-sm font-semibold text-muted px-1">Archived</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {archived.map((g) => (
                <GoalRow key={g.id} g={g} dim />
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
