"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/services/categories";
import { categorySchema } from "@/lib/validation/resources";
import { AppError } from "@/lib/errors";

export interface CategoryActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: {
    name?: string[];
    description?: string[];
  };
}

const idSchema = z.string().uuid("Invalid category ID format");

export async function createCategoryAction(
  _prevState: CategoryActionResult,
  formData: FormData
): Promise<CategoryActionResult> {
  try {
    await assertRole("ADMIN");

    const raw = {
      name: formData.get("name")?.toString() ?? "",
      description: formData.get("description")?.toString() ?? "",
    };

    const parsed = categorySchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    await createCategory(parsed.data);

    revalidatePath("/admin/categories");
    revalidatePath("/admin/resources");
    revalidatePath("/resources");
    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

export async function updateCategoryAction(
  id: string,
  _prevState: CategoryActionResult,
  formData: FormData
): Promise<CategoryActionResult> {
  try {
    await assertRole("ADMIN");
    const validId = idSchema.parse(id);

    const raw = {
      name: formData.get("name")?.toString() ?? "",
      description: formData.get("description")?.toString() ?? "",
    };

    const parsed = categorySchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    await updateCategory(validId, parsed.data);

    revalidatePath("/admin/categories");
    revalidatePath("/admin/resources");
    revalidatePath("/resources");
    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

export async function deleteCategoryAction(id: string): Promise<CategoryActionResult> {
  try {
    await assertRole("ADMIN");
    const validId = idSchema.parse(id);

    await deleteCategory(validId);

    revalidatePath("/admin/categories");
    revalidatePath("/admin/resources");
    revalidatePath("/resources");
    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}
