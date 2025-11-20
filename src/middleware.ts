import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * NextAuth.js Middleware
 *
 * This middleware protects routes that require authentication.
 * Configure which routes to protect in the `config.matcher` below.
 */

export default auth((req) => {
  const { pathname } = req.nextUrl;
  // NextAuth v5: req.auth contains the session when authenticated
  // In production, this should be properly set by the auth() wrapper
  const isAuthenticated = !!req.auth?.user;

  // Security headers for production
  const response = NextResponse.next();

  // Only enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    // Strict-Transport-Security: Force HTTPS for 1 year
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // X-Frame-Options: Prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY');

    // X-Content-Type-Options: Prevent MIME sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');

    // Referrer-Policy: Control referrer information
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy: Restrict browser features
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  }

  // Define public routes (no authentication required)
  // Note: Root path "/" is handled by page.tsx which checks auth and redirects appropriately
  const publicRoutes = [
    '/auth/signin',
    '/auth/error',
    '/api/auth',
    '/api/system/status',          // System status endpoint (public operational info)
    '/api/workflows/import-test',  // Test endpoint for development
    '/api/workflows/execute-test', // Test endpoint for development
    '/api/workflows/build-from-plan', // Agent workflow builder (no auth for local agent)
    '/api/modules/search',         // Module search for agent (no auth for local agent)
  ];

  // Check if this is a webhook endpoint (pattern: /api/workflows/[id]/webhook)
  const isWebhookEndpoint = /^\/api\/workflows\/[^\/]+\/webhook$/.test(pathname);

  // Check if the current path is public or is the root path
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Root path is handled by page.tsx, so we allow it through middleware
  const isRootPath = pathname === '/';

  // If route is not public, not root, not webhook, and user is not authenticated, redirect to signin
  if (!isPublicRoute && !isRootPath && !isWebhookEndpoint && !isAuthenticated) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    const redirectResponse = NextResponse.redirect(signInUrl);

    // Apply security headers to redirect response too
    if (process.env.NODE_ENV === 'production') {
      redirectResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      redirectResponse.headers.set('X-Frame-Options', 'DENY');
      redirectResponse.headers.set('X-Content-Type-Options', 'nosniff');
      redirectResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      redirectResponse.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    }

    return redirectResponse;
  }

  // Return response with security headers
  return response;
});

/**
 * Configure which routes the middleware should run on
 *
 * Options:
 * 1. Match all routes except static files and API routes:
 *    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
 *
 * 2. Match specific routes:
 *    matcher: ['/dashboard/:path*', '/profile/:path*']
 *
 * 3. Match all routes (current configuration):
 *    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, cat-icon.svg (static files)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|cat-icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
