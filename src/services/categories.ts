import { db } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { categorySchema, type CategoryInput, type CategoryOutput } from "@/lib/validation/resources";

export interface CategoryWithCount {
  id: string;
  name: string;
  description: string | null;
  _count: {
    resources: number;
  };
}

/**
 * Returns all categories with their associated resource counts, ordered alphabetically.
 */
export async function listCategories(): Promise<CategoryWithCount[]> {
  return db.resourceCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          resources: true,
        },
      },
    },
  });
}

/**
 * Creates a new category after verifying case-insensitive name uniqueness.
 */
export async function createCategory(
  input: CategoryInput | CategoryOutput
): Promise<{ id: string; name: string; description: string | null }> {
  const validated = categorySchema.safeParse(input);
  if (!validated.success) {
    throw new ValidationError("Invalid category data", validated.error.flatten());
  }

  const { name, description } = validated.data;

  // Case-insensitive duplicate name check
  const existing = await db.resourceCategory.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError("A category with this name already exists");
  }

  return db.resourceCategory.create({
    data: {
      name,
      description,
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });
}

/**
 * Updates an existing category after verifying existence and name uniqueness.
 */
export async function updateCategory(
  id: string,
  input: CategoryInput | CategoryOutput
): Promise<{ id: string; name: string; description: string | null }> {
  const validated = categorySchema.safeParse(input);
  if (!validated.success) {
    throw new ValidationError("Invalid category data", validated.error.flatten());
  }

  const existing = await db.resourceCategory.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  const { name, description } = validated.data;

  // Check if another category already has this name
  const duplicate = await db.resourceCategory.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
      id: { not: id },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictError("A category with this name already exists");
  }

  return db.resourceCategory.update({
    where: { id },
    data: {
      name,
      description,
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });
}

/**
 * Deletes a category only if it has zero associated resources.
 */
export async function deleteCategory(id: string): Promise<void> {
  const category = await db.resourceCategory.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          resources: true,
        },
      },
    },
  });

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  if (category._count.resources > 0) {
    throw new ConflictError("Cannot delete category because it contains resources");
  }

  await db.resourceCategory.delete({
    where: { id },
  });
}
