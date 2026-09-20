import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { ROUTE_ACCESS, ROLE_HOME, MODULE_ROUTE_PREFIX, type AppRole } from '@/lib/roles';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const role = token?.role as AppRole | undefined;

    if (!role) return NextResponse.next();

    const rule = ROUTE_ACCESS.find((r) => path.startsWith(r.prefix));
    if (rule && !rule.roles.includes(role)) {
      const home = ROLE_HOME[role] ?? '/login';
      return NextResponse.redirect(new URL(home, req.url));
    }

    // Explicit per-staff-member module denials (granular access rights),
    // layered on top of the role check above. Admins are never subject to
    // these. Populated into the JWT at sign-in — see lib/auth.ts.
    if (role !== 'ADMIN') {
      const deniedModules = (token?.deniedModules as string[] | undefined) ?? [];
      const deniedPrefixes = deniedModules.map((m) => MODULE_ROUTE_PREFIX[m]).filter(Boolean);
      if (deniedPrefixes.some((p) => path.startsWith(p!))) {
        const home = ROLE_HOME[role] ?? '/login';
        return NextResponse.redirect(new URL(home, req.url));
      }
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/billing/:path*',
    '/outreach/:path*',
    '/customers/:path*',
    '/customer-hub/:path*',
    '/work-orders/:path*',
    '/accounting/:path*',
    '/expenses/:path*',
    '/team/:path*',
    '/inventory/:path*',
    '/tax/:path*',
    '/marketing/:path*',
    '/technician/:path*',
  ],
};
