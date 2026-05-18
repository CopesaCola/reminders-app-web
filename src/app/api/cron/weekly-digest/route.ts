import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { goals, entries } from '@/lib/schema';
import { gte, isNull } from 'drizzle-orm';
import { sendPushToAll } from '@/lib/push';
import { addDaysISO, localDateStr, localDayOfWeek } from '@/lib/date';
import { bucketEntries, computeStreak, isPaused, periodHits, periodKey } from '@/lib/cadence';

export const dynamic = 'force-dynamic';

async function handle(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const today = localDateStr();
  // Only send on Sunday by default; can be forced with ?force=1
  const force = new URL(req.url).searchParams.get('force') === '1';
  if (!force && localDayOfWeek() !== 0) {
    return NextResponse.json({ skipped: 'not sunday' });
  }

  const since = addDaysISO(today, -60);
  const activeGoals = await db.select().from(goals).where(isNull(goals.archivedAt));
  const recent = await db.select().from(entries).where(gte(entries.entryDate, since));

  const byGoal = new Map<number, typeof recent>();
  for (const e of recent) {
    const arr = byGoal.get(e.goalId) ?? [];
    arr.push(e);
    byGoal.set(e.goalId, arr);
  }

  let hits = 0;
  let total = 0;
  const lines: string[] = [];
  for (const g of activeGoals) {
    if (isPaused(g, today)) continue;
    const ents = byGoal.get(g.id) ?? [];
    const buckets = bucketEntries(g, ents);
    if (g.cadence === 'daily') {
      // Count last 7 days
      for (let i = 0; i < 7; i++) {
        const d = addDaysISO(today, -(i + 1)); // last full week, prior to today
        total++;
        if (periodHits(g, buckets.get(d) ?? 0)) hits++;
      }
    } else if (g.cadence === 'weekly') {
      // Count last completed week
      const lastWeek = periodKey('weekly' as any, addDaysISO(today, -7));
      total++;
      if (periodHits(g, buckets.get(lastWeek) ?? 0)) hits++;
    }
    const streak = computeStreak(g, ents, today);
    lines.push(`• ${g.title} — streak ${streak.current}`);
  }

  const pct = total === 0 ? 0 : Math.round((hits / total) * 100);
  const summary = `Last 7 days: ${hits}/${total} hits (${pct}%)`;
  await sendPushToAll(
    {
      title: 'Weekly review',
      body: `${summary}\n${lines.slice(0, 3).join('\n')}`,
      url: '/',
      tag: 'weekly-digest',
    },
    'digest'
  );
  return NextResponse.json({ hits, total, pct, lines });
}

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export const GET = handle;
export const POST = handle;
