"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import {
  approveUser,
  rejectUser,
  disableUser,
  enableUser,
  setUserRole,
} from "@/services/users";
import { AppError } from "@/lib/errors";

const userIdSchema = z.string().uuid("Invalid user ID format");

export interface AdminActionResult {
  success: boolean;
  message?: string;
}

/**
 * Server action to approve a pending user.
 * Protected by assertRole("ADMIN").
 */
export async function approveUserAction(userId: string): Promise<AdminActionResult> {
  try {
    const admin = await assertRole("ADMIN");
    const validUserId = userIdSchema.parse(userId);

    await approveUser(admin.id, validUserId);

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    if (error instanceof z.ZodError) {
      return { success: false, message: error.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Server action to reject a pending user.
 * Protected by assertRole("ADMIN").
 */
export async function rejectUserAction(userId: string): Promise<AdminActionResult> {
  try {
    const admin = await assertRole("ADMIN");
    const validUserId = userIdSchema.parse(userId);

    await rejectUser(admin.id, validUserId);

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    if (error instanceof z.ZodError) {
      return { success: false, message: error.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Server action to disable an active user.
 * Protected by assertRole("ADMIN").
 */
export async function disableUserAction(userId: string): Promise<AdminActionResult> {
  try {
    const admin = await assertRole("ADMIN");
    const validUserId = userIdSchema.parse(userId);

    await disableUser(admin.id, validUserId);

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    if (error instanceof z.ZodError) {
      return { success: false, message: error.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Server action to re-enable a disabled user.
 * Protected by assertRole("ADMIN").
 */
export async function enableUserAction(userId: string): Promise<AdminActionResult> {
  try {
    const admin = await assertRole("ADMIN");
    const validUserId = userIdSchema.parse(userId);

    await enableUser(admin.id, validUserId);

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    if (error instanceof z.ZodError) {
      return { success: false, message: error.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

const setUserRoleSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  newRole: z.enum(["ADMIN", "MEMBER"], { message: "Invalid role specified" }),
});

/**
 * Server action to promote or demote an active user's role.
 * Protected by assertRole("ADMIN").
 */
export async function setUserRoleAction(
  userId: string,
  newRole: "ADMIN" | "MEMBER"
): Promise<AdminActionResult> {
  try {
    const admin = await assertRole("ADMIN");
    const parsed = setUserRoleSchema.parse({ userId, newRole });

    await setUserRole(admin.id, parsed.userId, parsed.newRole);

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return {
      success: true,
      message: `User role successfully updated to ${parsed.newRole}.`,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    if (error instanceof z.ZodError) {
      return { success: false, message: error.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

