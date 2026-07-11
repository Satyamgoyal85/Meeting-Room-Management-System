import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthSession } from '@/actions/auth';

const SESSION_COOKIE_NAME = 'dhanuka_session';
const PENDING_RESET_COOKIE_NAME = 'dhanuka_pending_reset';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for full authenticated session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  let session: AuthSession | null = null;
  if (sessionCookie?.value) {
    try {
      session = JSON.parse(sessionCookie.value) as AuthSession;
    } catch {
      session = null;
    }
  }

  // Check for pending password reset cookie (user authenticated but must reset before accessing app)
  const hasPendingReset = !!request.cookies.get(PENDING_RESET_COOKIE_NAME)?.value;

  // 1. If a user has a PENDING RESET cookie and tries to access the app, send them to the reset page
  if (hasPendingReset && !pathname.startsWith('/reset-password') && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/reset-password', request.url));
  }

  // 2. Protect Dashboard and Admin routes from unauthenticated users
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 3. Prevent normal employees from accessing Admin-only routes
    if (pathname.startsWith('/admin') && session.role !== 'admin') {
      const dashboardUrl = new URL('/dashboard', request.url);
      dashboardUrl.searchParams.set('error', 'unauthorized_admin');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // 4. Redirect fully authenticated users away from /login, /reset-password, or /
  if (session && (pathname.startsWith('/login') || pathname.startsWith('/reset-password') || pathname === '/')) {
    if (session.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    } else {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 5. Redirect unauthenticated visitors from root / directly to /login
  if (pathname === '/' && !session && !hasPendingReset) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
