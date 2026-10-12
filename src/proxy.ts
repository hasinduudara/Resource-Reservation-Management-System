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

  // Authenticated users visiting /login or /register are redirected to /resources
  if (authenticated && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/resources", request.url));
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
