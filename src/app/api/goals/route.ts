import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { goals } from '@/lib/schema';
import { isNull, asc, desc } from 'drizzle-orm';

const dayMaskMax = 0b1111111; // 7 days

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const create = z.object({
  title: z.string().min(1).max(120),
  why: z.string().max(2000).optional().nullable(),
  type: z.enum(['binary', 'quantitative', 'milestone', 'todo']),
  // Cadence is irrelevant for one-time todos; default to daily so the column stays non-null.
  cadence: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  targetValue: z.number().nonnegative().optional().nullable(),
  targetUnit: z.string().max(40).optional().nullable(),
  remindAtMinutes: z.number().int().min(0).max(1439).optional().nullable(),
  remindDaysMask: z.number().int().min(0).max(dayMaskMax).optional().nullable(),
  dueDate: isoDate.optional().nullable(),
});

export async function GET() {
  const rows = await db
    .select()
    .from(goals)
    .where(isNull(goals.archivedAt))
    .orderBy(asc(goals.sortOrder), desc(goals.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = create.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [row] = await db.insert(goals).values(parsed.data).returning();
  return NextResponse.json(row, { status: 201 });
}
