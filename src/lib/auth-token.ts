import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole, UserStatus } from "@prisma/client";

export const SESSION_COOKIE_NAME = "rrsm_session";
const SESSION_EXPIRATION = "7d"; // 7 days session duration

export interface SessionPayload {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is missing.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Sign a JWT token containing the user session payload using HS256.
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({
    sub: payload.userId,
    name: payload.name,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRATION)
    .sign(secret);
}

/**
 * Verify and parse a JWT session token.
 * Returns null if the token is invalid or expired.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }

    return {
      userId: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      email: typeof payload.email === "string" ? payload.email : "",
      role: (payload.role as UserRole) || "MEMBER",
    };
  } catch {
    return null;
  }
}

/**
 * Store the JWT session token in an httpOnly, SameSite=lax cookie.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });
}

/**
 * Read the current session token from request cookies.
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  return cookie?.value ?? null;
}

/**
 * Remove the session cookie to log out.
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
