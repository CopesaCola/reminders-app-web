import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { goals, entries, reminderLog } from '@/lib/schema';
import { and, eq, gte, isNull } from 'drizzle-orm';
import { sendPushToAll } from '@/lib/push';
import {
  localDateStr,
  localDayOfWeek,
  localMinutesSinceMidnight,
  addDaysISO,
} from '@/lib/date';
import { isPaused, periodHits, periodKey, bucketEntries } from '@/lib/cadence';

export const dynamic = 'force-dynamic';

// Triggered by Vercel Cron every 15 minutes.
// Behavior:
//   - For each active goal scheduled within the past 15 min on this day-of-week,
//     and not yet checked in for the current period, send a reminder.
//   - If a daily goal has been missed >24h with no entry, send a "nudge" — but only once.
async function handle(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date();
  const today = localDateStr();
  const dow = localDayOfWeek(now);
  const minNow = localMinutesSinceMidnight(now);
  const WINDOW = 15; // minutes — must match cron interval

  const activeGoals = await db.select().from(goals).where(isNull(goals.archivedAt));
  // For nudges, look at the past 3 days
  const sinceForNudge = addDaysISO(today, -3);
  const recentEntries = await db
    .select()
    .from(entries)
    .where(gte(entries.entryDate, sinceForNudge));

  const recentByGoal = new Map<number, typeof recentEntries>();
  for (const e of recentEntries) {
    const arr = recentByGoal.get(e.goalId) ?? [];
    arr.push(e);
    recentByGoal.set(e.goalId, arr);
  }

  const fired: { goalId: number; kind: string }[] = [];

  for (const g of activeGoals) {
    if (isPaused(g, today)) continue;

    // One-time todos: remind on schedule until completed, plus a due-today/overdue nudge.
    if (g.type === 'todo') {
      if (g.completedAt) continue;
      const dayBit = 1 << dow;
      const dayMatches = g.remindDaysMask == null || (g.remindDaysMask & dayBit) !== 0;
      const overdue = g.dueDate != null && g.dueDate < today;
      const dueToday = g.dueDate === today;

      const scheduledNow =
        g.remindAtMinutes != null && dayMatches && Math.abs(minNow - g.remindAtMinutes) < WINDOW;

      if (scheduledNow && !(await alreadySent(g.id, 'reminder', 60))) {
        await sendPushToAll(
          {
            title: `To-do: ${g.title}`,
            body: g.dueDate ? (overdue ? `Overdue (was due ${g.dueDate})` : `Due ${g.dueDate}`) : 'Still on your list.',
            url: `/goals/${g.id}`,
            tag: `goal-${g.id}`,
            goalId: g.id,
            actions: [
              { action: 'done', title: '✓ Done' },
              { action: 'open', title: 'Open' },
            ],
          },
          'reminder'
        );
        fired.push({ goalId: g.id, kind: 'reminder' });
      } else if ((overdue || dueToday) && minNow >= 9 * 60 && !(await alreadySent(g.id, 'nudge', 60 * 12))) {
        // Due-date nudge once per day after 9am, even if no daily reminder time matched.
        await sendPushToAll(
          {
            title: overdue ? `Overdue: ${g.title}` : `Due today: ${g.title}`,
            body: overdue ? `Was due ${g.dueDate}. Knock it out?` : 'Due today — knock it out?',
            url: `/goals/${g.id}`,
            tag: `nudge-${g.id}`,
            goalId: g.id,
            actions: [
              { action: 'done', title: '✓ Done' },
              { action: 'open', title: 'Open' },
            ],
          },
          'nudge'
        );
        fired.push({ goalId: g.id, kind: 'nudge' });
      }
      continue;
    }

    if (g.remindAtMinutes == null) continue;

    const dayBit = 1 << dow;
    const dayMatches = g.remindDaysMask == null || (g.remindDaysMask & dayBit) !== 0;

    const inWindow = dayMatches && Math.abs(minNow - g.remindAtMinutes) < WINDOW;
    const goalEntries = recentByGoal.get(g.id) ?? [];
    const currentPeriod = periodKey(g.cadence as any, today);
    const periodTotal = bucketEntries(g, goalEntries).get(currentPeriod) ?? 0;
    const alreadyHit = periodHits(g, periodTotal);

    if (inWindow && !alreadyHit) {
      // Don't double-send within an hour for the same goal
      if (!(await alreadySent(g.id, 'reminder', 60))) {
        const body =
          g.type === 'quantitative' && g.targetValue
            ? `${periodTotal}/${g.targetValue} ${g.targetUnit ?? ''} this ${g.cadence === 'daily' ? 'day' : g.cadence === 'weekly' ? 'week' : 'month'}`
            : g.why
              ? `Why: ${g.why.slice(0, 90)}${g.why.length > 90 ? '…' : ''}`
              : 'Quick check-in?';
        await sendPushToAll(
          {
            title: g.title,
            body,
            url: `/goals/${g.id}`,
            tag: `goal-${g.id}`,
            goalId: g.id,
            actions:
              g.type === 'binary'
                ? [
                    { action: 'done', title: '✓ Done' },
                    { action: 'open', title: 'Open' },
                  ]
                : [{ action: 'open', title: 'Log progress' }],
          },
          'reminder'
        );
        fired.push({ goalId: g.id, kind: 'reminder' });
      }
    }

    // Escalating nudge — daily binary goals missed yesterday
    if (g.cadence === 'daily') {
      const yesterday = addDaysISO(today, -1);
      const hadEntryYesterday = goalEntries.some(
        (e) => e.entryDate === yesterday && periodHits(g, e.value)
      );
      if (!hadEntryYesterday && !alreadyHit) {
        // Send one nudge per missed day, only after 9am local
        if (minNow >= 9 * 60 && !(await alreadySent(g.id, 'nudge', 60 * 12))) {
          await sendPushToAll(
            {
              title: `Missed yesterday: ${g.title}`,
              body: 'Quick 30s update — even a small win counts.',
              url: `/goals/${g.id}`,
              tag: `nudge-${g.id}`,
              goalId: g.id,
              actions: [{ action: 'open', title: 'Update' }],
            },
            'nudge'
          );
          fired.push({ goalId: g.id, kind: 'nudge' });
        }
      }
    }
  }

  return NextResponse.json({ fired, count: fired.length });
}

async function alreadySent(goalId: number, kind: string, withinMinutes: number): Promise<boolean> {
  const since = new Date(Date.now() - withinMinutes * 60_000);
  const rows = await db
    .select()
    .from(reminderLog)
    .where(and(eq(reminderLog.goalId, goalId), eq(reminderLog.kind, kind), gte(reminderLog.sentAt, since)))
    .limit(1);
  return rows.length > 0;
}

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev: allow if not set
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export const GET = handle;
export const POST = handle;
