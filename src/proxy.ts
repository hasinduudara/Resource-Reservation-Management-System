import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "rrsm_session";

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is missing.");
  }
  return new TextEncoder().encode(secret);
}

async function isCoarselyAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return Boolean(payload?.sub);
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const authenticated = await isCoarselyAuthenticated(request);

  // If visiting /login or /register
  if (pathname === "/login" || pathname === "/register") {
    // If arriving with callbackUrl, the server-side guard already rejected the session
    // (e.g. user was deleted, modified in DB, or is no longer ACTIVE).
    // Clear the stale cookie and allow the login/register page to render without looping.
    if (request.nextUrl.searchParams.has("callbackUrl")) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    // Authenticated users visiting /login or /register directly are redirected to /resources
    if (authenticated) {
      return NextResponse.redirect(new URL("/resources", request.url));
    }
  }

  // Protected paths: (app) and (admin) routes
  const isProtectedPath =
    pathname.startsWith("/resources") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/reservations");

  if (!authenticated && isProtectedPath) {
    const callback = `${pathname}${search}`;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", callback);
    return NextResponse.redirect(loginUrl);
  }

  // Pass current pathname to downstream server components via header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (metadata file)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
