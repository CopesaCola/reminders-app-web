import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { goals } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

const update = z.object({
  title: z.string().min(1).max(120).optional(),
  why: z.string().max(2000).nullable().optional(),
  cadence: z.enum(['daily', 'weekly', 'monthly']).optional(),
  targetValue: z.number().nullable().optional(),
  targetUnit: z.string().max(40).nullable().optional(),
  remindAtMinutes: z.number().int().min(0).max(1439).nullable().optional(),
  remindDaysMask: z.number().int().min(0).max(0b1111111).nullable().optional(),
  // ISO date string YYYY-MM-DD or null
  pausedUntil: isoDate,
  dueDate: isoDate,
  // Mark a one-time todo done / not-done.
  completed: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.select().from(goals).where(eq(goals.id, Number(id))).limit(1);
  if (!row[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(row[0]);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = update.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { archived, completed, ...rest } = parsed.data;
  const patch: Record<string, unknown> = { ...rest };
  if (archived === true) patch.archivedAt = new Date();
  if (archived === false) patch.archivedAt = null;
  if (completed === true) patch.completedAt = new Date();
  if (completed === false) patch.completedAt = null;

  const [row] = await db
    .update(goals)
    .set(patch)
    .where(eq(goals.id, Number(id)))
    .returning();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(goals).where(eq(goals.id, Number(id)));
  return NextResponse.json({ ok: true });
}
