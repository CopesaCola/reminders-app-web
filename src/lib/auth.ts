import 'server-only';
import { cookies } from 'next/headers';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';

export type Session = {
  loggedIn?: boolean;
};

const password = process.env.SESSION_SECRET ?? '';

export const sessionOptions: SessionOptions = {
  password,
  cookieName: 'reminders_session',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession(): Promise<IronSession<Session>> {
  if (!password || password.length < 32) {
    throw new Error('SESSION_SECRET must be set to a 32+ character string');
  }
  const cookieStore = await cookies();
  return await getIronSession<Session>(cookieStore, sessionOptions);
}

export async function requireLogin(): Promise<void> {
  const session = await getSession();
  if (!session.loggedIn) {
    // Throwing here is caught by Next; route handlers should redirect instead.
    throw new Error('UNAUTHORIZED');
  }
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? '';
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ input.charCodeAt(i);
  }
  return mismatch === 0;
}
