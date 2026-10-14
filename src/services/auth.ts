import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth-token";

// Pre-computed bcrypt cost 10 hash used to equalize execution time when a user does not exist
const DUMMY_HASH = "$2b$10$Ub2nSjzbZcXxCJHouFc9qedMrC.goSNRWnC75I/LazaHgbqGvE7yO";

export interface AuthenticateResult {
  success: boolean;
  user?: CurrentUser;
  error?: string;
}

/**
 * Validates user credentials with constant-time comparison.
 * Prevents account enumeration by:
 * 1. Running bcrypt.compare against a dummy hash if the user is not found.
 * 2. Emitting "Invalid email or password" for both missing users and wrong passwords.
 * 3. Inspecting PENDING/DISABLED status strictly AFTER password verification succeeds.
 */
export async function authenticateCredentials(
  email: string,
  password: string
): Promise<AuthenticateResult> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
    },
  });

  const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
  const isMatch = await bcrypt.compare(password, hashToCompare);

  // If user does not exist or password is wrong, return identical generic message
  if (!user || !isMatch) {
    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  // Account status inspection happens strictly after password validity is confirmed
  if (user.status === "PENDING") {
    return {
      success: false,
      error: "Your account is awaiting administrator approval.",
    };
  }

  if (user.status === "DISABLED") {
    return {
      success: false,
      error: "Your account has been disabled. Please contact an administrator.",
    };
  }

  // User is ACTIVE - return safe user details (no passwordHash)
  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  };
}

/**
 * Checks whether a path is member-only (/resources, /availability, /my-reservations).
 * Note: /resources/[id] is NOT member-only (admins can view the read-only schedule).
 */
export function isMemberOnlyPath(pathname: string): boolean {
  const cleanPath = pathname.split("?")[0].split("#")[0];
  if (cleanPath === "/resources") return true;
  if (cleanPath === "/availability" || cleanPath.startsWith("/availability/")) return true;
  if (cleanPath === "/my-reservations" || cleanPath.startsWith("/my-reservations/")) return true;
  return false;
}

/**
 * Validates and sanitizes callback URLs to prevent Open Redirect attacks.
 * Only internal relative paths starting with / (and not // or /\) are allowed.
 */
export function getSafeCallbackUrl(url?: string | null, fallback = "/resources"): string {
  if (!url) return fallback;
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) {
    return url;
  }
  return fallback;
}

/**
 * Determines the post-login redirect path based on user role and callbackUrl.
 * ADMIN goes to /admin, MEMBER goes to /resources.
 * If a safe callbackUrl is provided, it is respected, but if an admin's callbackUrl points
 * to a member-only page, they are sent to /admin.
 */
export function getRoleBasedRedirect(
  role: "ADMIN" | "MEMBER",
  callbackUrl?: string | null
): string {
  const defaultTarget = role === "ADMIN" ? "/admin" : "/resources";
  if (!callbackUrl) {
    return defaultTarget;
  }

  const safeUrl = getSafeCallbackUrl(callbackUrl, defaultTarget);
  if (role === "ADMIN" && isMemberOnlyPath(safeUrl)) {
    return "/admin";
  }

  return safeUrl;
}

