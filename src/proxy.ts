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

async function getCoarseAuth(request: NextRequest): Promise<{ authenticated: boolean; role?: string }> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { authenticated: false };

  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return {
      authenticated: Boolean(payload?.sub),
      role: typeof payload?.role === "string" ? payload.role : undefined,
    };
  } catch {
    return { authenticated: false };
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const auth = await getCoarseAuth(request);

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

    // Authenticated users visiting /login or /register directly are redirected by role
    if (auth.authenticated) {
      const target = auth.role === "ADMIN" ? "/admin" : "/resources";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  // Protected paths: (app) and (admin) routes
  const isProtectedPath =
    pathname.startsWith("/resources") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/availability") ||
    pathname.startsWith("/my-reservations") ||
    pathname.startsWith("/reservations");

  if (!auth.authenticated && isProtectedPath) {
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
