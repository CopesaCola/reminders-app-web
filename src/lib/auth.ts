import 'server-only';
import { cookies } from 'next/headers';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';

export type Session = {
  loggedIn?: boolean;
};

const password = process.env.SESSION_SECRET ?? '';

// Browsers refuse to set cookies with the Secure flag on plain HTTP. Default to
// off so LAN/HTTP testing works out of the box; flip SECURE_COOKIES=true once
// you're serving over HTTPS (e.g. via Cloudflare Tunnel).
const secureCookies = process.env.SECURE_COOKIES === 'true';

export const sessionOptions: SessionOptions = {
  password,
  cookieName: 'reminders_session',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies,
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
  // Trim both sides — handles stray whitespace from copy-paste into env vars.
  const expected = (process.env.APP_PASSWORD ?? '').trim();
  const candidate = (input ?? '').trim();
  if (!expected) {
    console.warn('[auth] APP_PASSWORD is not set — every login attempt will fail');
    return false;
  }
  if (candidate.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return mismatch === 0;
}
