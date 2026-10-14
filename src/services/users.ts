import bcrypt from "bcryptjs";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
}

export interface SafeUserDetails {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  approvedAt: Date | null;
  createdAt: Date;
  approvedBy: {
    id: string;
    name: string;
  } | null;
}

export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  approvedAt: true,
  createdAt: true,
  approvedBy: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export interface ListUsersOptions {
  status?: UserStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ListUsersResult {
  users: SafeUserDetails[];
  total: number;
}

/**
 * Register a new user in the system.
 * Enforces role MEMBER and status PENDING regardless of client input.
 * Hashes password with bcryptjs (cost 10).
 */
export async function registerUser(input: RegisterInput): Promise<SafeUser> {
  const validated = registerSchema.safeParse(input);
  if (!validated.success) {
    throw new ValidationError("Invalid registration data", validated.error.flatten());
  }

  const { name, email, password } = validated.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new ConflictError("An account with this email already exists");
  }

  // Cost 10 bcrypt hash
  const passwordHash = await bcrypt.hash(password, 10);

  // Strictly enforce MEMBER role and PENDING status on the server
  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "MEMBER",
      status: "PENDING",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return user;
}

/**
 * Counts all users currently awaiting administrator approval.
 */
export async function countPendingUsers(): Promise<number> {
  return db.user.count({
    where: { status: "PENDING" },
  });
}

/**
 * Lists users with optional status filter, case-insensitive search (name/email),
 * and pagination. Orders PENDING first, then newest first.
 * Never selects or returns passwordHash.
 */
export async function listUsers(options: ListUsersOptions = {}): Promise<ListUsersResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 10));
  const skip = (page - 1) * pageSize;

  const where: Prisma.UserWhereInput = {};

  if (options.status) {
    where.status = options.status;
  }

  if (options.search && options.search.trim().length > 0) {
    const term = options.search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [
        { status: "asc" }, // PENDING is 1st in PostgreSQL enum order
        { createdAt: "desc" },
      ],
      select: safeUserSelect,
    }),
  ]);

  return { users, total };
}

/**
 * Approves a PENDING user, setting their status to ACTIVE and recording the acting admin.
 * Uses atomic updateMany with status: "PENDING" to prevent concurrent double-approvals.
 */
export async function approveUser(adminId: string, userId: string): Promise<SafeUserDetails> {
  const result = await db.user.updateMany({
    where: {
      id: userId,
      status: "PENDING",
    },
    data: {
      status: "ACTIVE",
      approvedById: adminId,
      approvedAt: new Date(),
    },
  });

  if (result.count === 0) {
    const existing = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundError("User not found");
    }
    throw new ConflictError("This user is no longer pending");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });

  return user!;
}

/**
 * Rejects a PENDING user, setting their status to DISABLED.
 * Uses atomic updateMany with status: "PENDING" to prevent race conditions.
 */
export async function rejectUser(adminId: string, userId: string): Promise<SafeUserDetails> {
  const result = await db.user.updateMany({
    where: {
      id: userId,
      status: "PENDING",
    },
    data: {
      status: "DISABLED",
    },
  });

  if (result.count === 0) {
    const existing = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundError("User not found");
    }
    throw new ConflictError("This user is no longer pending");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });

  return user!;
}

/**
 * Disables an ACTIVE user.
 * - An admin cannot disable their own account.
 * - The last ACTIVE admin cannot be disabled.
 * - Checks and update run atomically inside a single transaction.
 * - Reservations remain untouched.
 */
export async function disableUser(adminId: string, userId: string): Promise<SafeUserDetails> {
  if (userId === adminId) {
    throw new ForbiddenError("You cannot disable your own account");
  }

  return db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!target) {
      throw new NotFoundError("User not found");
    }

    if (target.status !== "ACTIVE") {
      throw new ConflictError("Only active users can be disabled");
    }

    // Safety rule: Last active admin check
    if (target.role === "ADMIN") {
      const activeAdminCount = await tx.user.count({
        where: {
          role: "ADMIN",
          status: "ACTIVE",
        },
      });

      if (activeAdminCount <= 1) {
        throw new ConflictError("Cannot disable the last active administrator");
      }
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        status: "DISABLED",
      },
      select: safeUserSelect,
    });

    return updated;
  });
}

/**
 * Re-enables a DISABLED user, setting status to ACTIVE and updating approval metadata.
 * Only DISABLED users can be re-enabled.
 */
export async function enableUser(adminId: string, userId: string): Promise<SafeUserDetails> {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new NotFoundError("User not found");
  }

  if (existing.status !== "DISABLED") {
    throw new ConflictError("Only disabled users can be re-enabled");
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      status: "ACTIVE",
      approvedById: adminId,
      approvedAt: new Date(),
    },
    select: safeUserSelect,
  });

  return updated;
}

/**
 * Promotes an ACTIVE MEMBER to ADMIN, or demotes an ACTIVE ADMIN to MEMBER.
 * - Only administrators can perform this action.
 * - Only ACTIVE users can change role (PENDING/DISABLED: ConflictError("Only active users can change role")).
 * - An admin cannot change their own role (ForbiddenError("You cannot change your own role")).
 * - The last ACTIVE admin can never be demoted (check and update inside one transaction).
 * - If the user already has the requested role, returns ConflictError(`User is already a ${newRole}`).
 * - Selects only safe fields; never returns passwordHash.
 * - Existing reservations stay untouched.
 */
export async function setUserRole(
  adminId: string,
  userId: string,
  newRole: "ADMIN" | "MEMBER"
): Promise<SafeUserDetails> {
  if (userId === adminId) {
    throw new ForbiddenError("You cannot change your own role");
  }

  const adminActor = await db.user.findUnique({
    where: { id: adminId },
    select: { id: true, role: true, status: true },
  });
  if (!adminActor || adminActor.role !== "ADMIN") {
    throw new ForbiddenError("Only administrators can change user roles");
  }

  return db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!target) {
      throw new NotFoundError("User not found");
    }

    if (target.status !== "ACTIVE") {
      throw new ConflictError("Only active users can change role");
    }

    if (target.role === newRole) {
      throw new ConflictError(`User is already a ${newRole}`);
    }

    if (target.role === "ADMIN" && newRole === "MEMBER") {
      const activeAdminCount = await tx.user.count({
        where: {
          role: "ADMIN",
          status: "ACTIVE",
        },
      });

      if (activeAdminCount <= 1) {
        throw new ConflictError("Cannot demote the last active administrator");
      }
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        role: newRole,
      },
      select: safeUserSelect,
    });

    return updated;
  });
}

