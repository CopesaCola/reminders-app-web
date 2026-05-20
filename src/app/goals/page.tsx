import Link from 'next/link';
import { db } from '@/lib/db';
import { goals } from '@/lib/schema';
import { asc, desc } from 'drizzle-orm';
import { Nav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

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
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Goals</h1>
          <Link href="/goals/new" className="btn-primary">
            New goal
          </Link>
        </div>
        <div className="space-y-2">
          {active.map((g) => (
            <Link key={g.id} href={`/goals/${g.id}`} className="card p-3 block hover:bg-muted/5">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{g.title}</p>
                  <p className="text-xs text-muted">
                    {g.type === 'todo' ? (
                      <>
                        one-time
                        {g.dueDate ? ` · due ${g.dueDate}` : ''}
                        {` · ${g.completedAt ? 'completed' : 'open'}`}
                      </>
                    ) : (
                      <>
                        {g.type} · {g.cadence}
                        {g.targetValue ? ` · target ${g.targetValue} ${g.targetUnit ?? ''}` : ''}
                        {g.pausedUntil ? ` · paused until ${g.pausedUntil}` : ''}
                      </>
                    )}
                  </p>
                </div>
                <span className="text-muted">›</span>
              </div>
            </Link>
          ))}
          {active.length === 0 && (
            <p className="text-muted text-sm">No active goals.</p>
          )}
        </div>
        {archived.length > 0 && (
          <div className="space-y-2 pt-4">
            <h2 className="text-sm font-medium text-muted">Archived</h2>
            {archived.map((g) => (
              <Link
                key={g.id}
                href={`/goals/${g.id}`}
                className="card p-3 block opacity-60 hover:opacity-80"
              >
                <p className="font-medium">{g.title}</p>
                <p className="text-xs text-muted">archived</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
