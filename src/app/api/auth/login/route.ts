import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkPassword, getSession } from '@/lib/auth';

const schema = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  if (!checkPassword(parsed.data.password)) {
    // Small delay to make brute force less ergonomic
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: 'wrong password' }, { status: 401 });
  }
  const session = await getSession();
  session.loggedIn = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
