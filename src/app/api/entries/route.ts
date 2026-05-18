import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { entries, goals } from '@/lib/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { localDateStr } from '@/lib/date';

const upsert = z.object({
  goalId: z.number().int(),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  value: z.number(),
  note: z.string().max(2000).optional().nullable(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const goalId = url.searchParams.get('goalId');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const conditions = [] as any[];
  if (goalId) conditions.push(eq(entries.goalId, Number(goalId)));
  if (from) conditions.push(gte(entries.entryDate, from));
  if (to) conditions.push(lte(entries.entryDate, to));
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db.select().from(entries).where(where);
  return NextResponse.json(rows);
}

// Upsert by (goalId, entryDate). 24h edit lock: if the row was created >24h ago
// AND today != entryDate, reject the update.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = upsert.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { goalId, value, note } = parsed.data;
  const entryDate = parsed.data.entryDate ?? localDateStr();

  // Ensure goal exists
  const g = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);
  if (!g[0]) return NextResponse.json({ error: 'goal not found' }, { status: 404 });

  // Find existing
  const existing = await db
    .select()
    .from(entries)
    .where(and(eq(entries.goalId, goalId), eq(entries.entryDate, entryDate)))
    .limit(1);

  if (existing[0]) {
    const createdAt = existing[0].createdAt as Date;
    const lockedOut =
      entryDate !== localDateStr() && Date.now() - createdAt.getTime() > 24 * 60 * 60 * 1000;
    if (lockedOut) {
      return NextResponse.json(
        { error: 'entry locked (24h edit window expired)' },
        { status: 409 }
      );
    }
    const [row] = await db
      .update(entries)
      .set({ value, note: note ?? null, updatedAt: new Date() })
      .where(eq(entries.id, existing[0].id))
      .returning();
    return NextResponse.json(row);
  }

  const [row] = await db
    .insert(entries)
    .values({ goalId, entryDate, value, note: note ?? null })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
