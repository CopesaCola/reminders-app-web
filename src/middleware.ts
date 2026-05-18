import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type Session } from '@/lib/auth';

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/manifest.json', '/sw.js']);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Cron + push subscribe endpoints are auth-checked by their own headers/secret.
  if (pathname.startsWith('/api/cron/')) return NextResponse.next();
  if (pathname.startsWith('/_next/')) return NextResponse.next();
  if (pathname.startsWith('/icons/')) return NextResponse.next();
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const res = NextResponse.next();
  const session = await getIronSession<Session>(req, res, sessionOptions);

  if (!session.loggedIn) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
