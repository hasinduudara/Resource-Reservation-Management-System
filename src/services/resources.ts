import type { Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { resourceSchema, type ResourceInput, type ResourceOutput } from "@/lib/validation/resources";

export interface ResourceDetails {
  id: string;
  name: string;
  categoryId: string;
  location: string | null;
  capacity: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
  };
}

export interface ListResourcesOptions {
  q?: string;
  categoryId?: string;
  includeInactive?: boolean;
  statusFilter?: "ALL" | "ACTIVE" | "INACTIVE";
  viewerRole: UserRole;
  page?: number;
  pageSize?: number;
}

export interface ListResourcesResult {
  items: ResourceDetails[];
  total: number;
}

/**
 * Lists resources with search, category filtering, pagination, and role-based active status gating.
 * When viewerRole is MEMBER, results are strictly limited to active resources only.
 */
export async function listResources(options: ListResourcesOptions): Promise<ListResourcesResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 10));
  const skip = (page - 1) * pageSize;

  const where: Prisma.ResourceWhereInput = {};

  // Strict role-based visibility enforcement
  if (options.viewerRole === "MEMBER") {
    where.isActive = true;
  } else {
    // Admin filtering
    if (options.statusFilter === "ACTIVE") {
      where.isActive = true;
    } else if (options.statusFilter === "INACTIVE") {
      where.isActive = false;
    } else if (options.statusFilter === "ALL") {
      // Do not filter by isActive
    } else if (options.includeInactive) {
      // Admin requested includeInactive
    } else {
      where.isActive = true;
    }
  }

  // Category filter
  if (options.categoryId && options.categoryId.trim().length > 0) {
    where.categoryId = options.categoryId.trim();
  }

  // Search filter (name, location, or description)
  if (options.q && options.q.trim().length > 0) {
    const term = options.q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { location: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    db.resource.count({ where }),
    db.resource.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        categoryId: true,
        location: true,
        capacity: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return { items, total };
}

/**
 * Retrieves a single resource by ID.
 * Throws NotFoundError if resource does not exist, or if an inactive resource is requested by a MEMBER.
 */
export async function getResourceById(id: string, viewerRole: UserRole): Promise<ResourceDetails> {
  const resource = await db.resource.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      categoryId: true,
      location: true,
      capacity: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!resource) {
    throw new NotFoundError("Resource not found");
  }

  // Members cannot view inactive resources
  if (viewerRole === "MEMBER" && !resource.isActive) {
    throw new NotFoundError("Resource not found");
  }

  return resource;
}

/**
 * Creates a new resource with isActive = true.
 * Enforces case-insensitive name uniqueness in the service layer.
 */
export async function createResource(
  input: ResourceInput | ResourceOutput
): Promise<ResourceDetails> {
  const validated = resourceSchema.safeParse(input);
  if (!validated.success) {
    throw new ValidationError("Invalid resource data", validated.error.flatten());
  }

  const { name, categoryId, location, capacity, description } = validated.data;

  // Case-insensitive name uniqueness check
  const duplicate = await db.resource.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictError("A resource with this name already exists");
  }

  // Ensure category exists
  const category = await db.resourceCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new NotFoundError("Selected category does not exist");
  }

  return db.resource.create({
    data: {
      name,
      categoryId,
      location,
      capacity,
      description,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      categoryId: true,
      location: true,
      capacity: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Updates an existing resource after verifying existence and name uniqueness.
 */
export async function updateResource(
  id: string,
  input: ResourceInput | ResourceOutput
): Promise<ResourceDetails> {
  const validated = resourceSchema.safeParse(input);
  if (!validated.success) {
    throw new ValidationError("Invalid resource data", validated.error.flatten());
  }

  const existing = await db.resource.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError("Resource not found");
  }

  const { name, categoryId, location, capacity, description } = validated.data;

  // Case-insensitive name uniqueness across other resources
  const duplicate = await db.resource.findFirst({
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
    throw new ConflictError("A resource with this name already exists");
  }

  const category = await db.resourceCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new NotFoundError("Selected category does not exist");
  }

  return db.resource.update({
    where: { id },
    data: {
      name,
      categoryId,
      location,
      capacity,
      description,
    },
    select: {
      id: true,
      name: true,
      categoryId: true,
      location: true,
      capacity: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Activates or deactivates a resource.
 * Deactivation preserves existing reservations for history.
 */
export async function setResourceActive(id: string, isActive: boolean): Promise<ResourceDetails> {
  const existing = await db.resource.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError("Resource not found");
  }

  return db.resource.update({
    where: { id },
    data: { isActive },
    select: {
      id: true,
      name: true,
      categoryId: true,
      location: true,
      capacity: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Counts all upcoming CONFIRMED reservations on a resource (endTime > now).
 */
export async function countUpcomingReservations(resourceId: string): Promise<number> {
  return db.reservation.count({
    where: {
      resourceId,
      status: "CONFIRMED",
      endTime: {
        gt: new Date(),
      },
    },
  });
}
