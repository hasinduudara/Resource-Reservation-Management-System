import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { getSessionToken, verifySessionToken } from "@/lib/auth-token";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

/**
 * Reads the session token, verifies it, and fetches the fresh user state from the database.
 * Wrapped with React cache() to guarantee it runs at most once per incoming request.
 * Returns null if unauthenticated, user is deleted, or user status is not ACTIVE.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return null;
  }

  // Load fresh user data from database
  // Immediately reflects any status or role change made by an administrator
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  return user;
});

/**
 * Helper to determine current path for callback redirection.
 */
async function resolveCallbackUrl(override?: string): Promise<string> {
  if (override) return override;
  try {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname");
    if (pathname && pathname.startsWith("/") && !pathname.startsWith("//")) {
      return pathname;
    }
  } catch {
    // If headers cannot be inspected, fallback to default
  }
  return "/resources";
}

/**
 * For React Server Components, Pages, and Layouts.
 * Redirects to /login (with callbackUrl) if the user is unauthenticated or not ACTIVE.
 */
export async function requireUser(callbackUrl?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = await resolveCallbackUrl(callbackUrl);
    redirect(`/login?callbackUrl=${encodeURIComponent(target)}`);
  }
  return user;
}

/**
 * For React Server Components, Pages, and Layouts.
 * Redirects to /login if unauthenticated, or to /forbidden if the role does not match.
 */
export async function requireRole(
  role: UserRole,
  callbackUrl?: string
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = await resolveCallbackUrl(callbackUrl);
    redirect(`/login?callbackUrl=${encodeURIComponent(target)}`);
  }

  if (user.role !== role) {
    redirect("/forbidden");
  }

  return user;
}

/**
 * For Server Actions and Services.
 * Throws UnauthorizedError if the user is not authenticated or not ACTIVE.
 */
export async function assertUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError("You must be logged in to perform this action.");
  }
  return user;
}

/**
 * For Server Actions and Services.
 * Throws UnauthorizedError if not authenticated, or ForbiddenError if role does not match.
 */
export async function assertRole(role: UserRole): Promise<CurrentUser> {
  const user = await assertUser();
  if (user.role !== role) {
    throw new ForbiddenError("You do not have permission to perform this action.");
  }
  return user;
}
