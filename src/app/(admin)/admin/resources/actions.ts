"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import {
  createResource,
  updateResource,
  setResourceActive,
  countUpcomingReservations,
} from "@/services/resources";
import { resourceSchema } from "@/lib/validation/resources";
import { AppError } from "@/lib/errors";

export interface ResourceActionResult {
  success: boolean;
  message?: string;
  resourceId?: string;
  fieldErrors?: {
    name?: string[];
    categoryId?: string[];
    location?: string[];
    capacity?: string[];
    description?: string[];
  };
}

const idSchema = z.string().uuid("Invalid resource ID format");

export async function createResourceAction(
  _prevState: ResourceActionResult,
  formData: FormData
): Promise<ResourceActionResult> {
  try {
    await assertRole("ADMIN");

    const raw = {
      name: formData.get("name")?.toString() ?? "",
      categoryId: formData.get("categoryId")?.toString() ?? "",
      location: formData.get("location")?.toString() ?? "",
      capacity: formData.get("capacity")?.toString() ?? "",
      description: formData.get("description")?.toString() ?? "",
    };

    const parsed = resourceSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const created = await createResource(parsed.data);

    revalidatePath("/admin/resources");
    revalidatePath("/resources");
    return { success: true, resourceId: created.id };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

export async function updateResourceAction(
  id: string,
  _prevState: ResourceActionResult,
  formData: FormData
): Promise<ResourceActionResult> {
  try {
    await assertRole("ADMIN");
    const validId = idSchema.parse(id);

    const raw = {
      name: formData.get("name")?.toString() ?? "",
      categoryId: formData.get("categoryId")?.toString() ?? "",
      location: formData.get("location")?.toString() ?? "",
      capacity: formData.get("capacity")?.toString() ?? "",
      description: formData.get("description")?.toString() ?? "",
    };

    const parsed = resourceSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    await updateResource(validId, parsed.data);

    revalidatePath("/admin/resources");
    revalidatePath(`/admin/resources/${validId}/edit`);
    revalidatePath("/resources");
    revalidatePath(`/resources/${validId}`);
    return { success: true, resourceId: validId };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

export async function setResourceActiveAction(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; message?: string }> {
  try {
    await assertRole("ADMIN");
    const validId = idSchema.parse(id);

    await setResourceActive(validId, isActive);

    revalidatePath("/admin/resources");
    revalidatePath(`/admin/resources/${validId}/edit`);
    revalidatePath("/resources");
    revalidatePath(`/resources/${validId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

export async function getUpcomingReservationsCountAction(id: string): Promise<number> {
  await assertRole("ADMIN");
  const validId = idSchema.parse(id);
  return countUpcomingReservations(validId);
}
