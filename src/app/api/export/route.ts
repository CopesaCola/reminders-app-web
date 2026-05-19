import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { goals, entries } from '@/lib/schema';

export async function GET(req: Request) {
  const fmt = new URL(req.url).searchParams.get('format') ?? 'json';
  const allGoals = await db.select().from(goals);
  const allEntries = await db.select().from(entries);

  if (fmt === 'csv') {
    const rows: string[] = ['goal_id,goal_title,entry_date,value,note'];
    const titleById = new Map(allGoals.map((g) => [g.id, g.title]));
    for (const e of allEntries) {
      const t = (titleById.get(e.goalId) ?? '').replace(/"/g, '""');
      const n = (e.note ?? '').replace(/"/g, '""').replace(/\n/g, ' ');
      rows.push(`${e.goalId},"${t}",${e.entryDate},${e.value},"${n}"`);
    }
    return new NextResponse(rows.join('\n'), {
      headers: {
        'content-type': 'text/csv',
        'content-disposition': `attachment; filename="goal-tracking-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const body = JSON.stringify({ goals: allGoals, entries: allEntries }, null, 2);
  return new NextResponse(body, {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="goal-tracking-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
