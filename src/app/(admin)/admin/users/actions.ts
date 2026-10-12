"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import {
  approveUser,
  rejectUser,
  disableUser,
  enableUser,
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
