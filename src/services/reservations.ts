import type { Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { isReservationOverlapError } from "@/lib/db-errors";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { formatInAppTimezone, toUtc } from "@/lib/time";
import {
  createReservationSchema,
  type CreateReservationInput,
  type CreateReservationOutput,
} from "@/lib/validation/reservations";

export type ReservationDisplayStatus = "Upcoming" | "In progress" | "Completed" | "Cancelled";

export interface MyReservationItem {
  id: string;
  purpose: string | null;
  startTime: Date;
  endTime: Date;
  status: "CONFIRMED" | "CANCELLED";
  displayStatus: ReservationDisplayStatus;
  canCancel: boolean;
  cancelledAt: Date | null;
  createdAt: Date;
  resource: {
    id: string;
    name: string;
    category: {
      id: string;
      name: string;
    };
  };
}

export interface ListMyReservationsOptions {
  userId: string;
  tab?: "upcoming" | "past";
  page?: number;
  pageSize?: number;
}

export interface ListMyReservationsResult {
  items: MyReservationItem[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export interface ResourceUpcomingSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  isMine: boolean;
}

export interface CreateReservationActor {
  id: string;
  role?: UserRole;
}

/**
 * Creates a new reservation for the given user.
 * Overlap prevention is strictly enforced by the PostgreSQL exclusion constraint (reservations_no_overlap).
 * Any exclusion constraint error is caught via isReservationOverlapError and converted into a helpful ConflictError.
 * Administrators are managers only and are prohibited from making reservations.
 */
export async function createReservation(
  actor: CreateReservationActor | string,
  input: CreateReservationInput | CreateReservationOutput
) {
  let userId: string;
  if (typeof actor === "string") {
    userId = actor;
    const userRecord = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (userRecord?.role === "ADMIN") {
      throw new ForbiddenError("Administrators manage the system and cannot make reservations.");
    }
  } else {
    if (actor.role === "ADMIN") {
      throw new ForbiddenError("Administrators manage the system and cannot make reservations.");
    }
    userId = actor.id;
  }

  const validated = createReservationSchema.safeParse(input);
  if (!validated.success) {
    throw new ValidationError("Invalid reservation details", validated.error.flatten());
  }

  const { resourceId, purpose, startLocal, endLocal } = validated.data;

  // Check that the resource exists and is active
  const resource = await db.resource.findUnique({
    where: { id: resourceId },
    select: { id: true, name: true, isActive: true },
  });

  if (!resource) {
    throw new NotFoundError("Resource not found");
  }

  if (!resource.isActive) {
    throw new ValidationError("This resource is inactive and cannot be reserved");
  }

  const startTime = toUtc(startLocal);
  const endTime = toUtc(endLocal);

  try {
    const reservation = await db.reservation.create({
      data: {
        resourceId: resource.id,
        userId,
        purpose,
        startTime,
        endTime,
        status: "CONFIRMED",
      },
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return reservation;
  } catch (error) {
    if (isReservationOverlapError(error)) {
      // Find the conflicting confirmed reservation on the same resource
      const blocking = await db.reservation.findFirst({
        where: {
          resourceId: resource.id,
          status: "CONFIRMED",
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        orderBy: { startTime: "asc" },
        select: { startTime: true, endTime: true },
      });

      let message = "This resource is already reserved for the selected time range. Please choose another time.";
      if (blocking) {
        const blockingStart = formatInAppTimezone(blocking.startTime, "HH:mm");
        const blockingEnd = formatInAppTimezone(blocking.endTime, "HH:mm");
        const blockingDate = formatInAppTimezone(blocking.startTime, "d MMM yyyy");
        message = `This resource is already reserved from ${blockingStart} to ${blockingEnd} on ${blockingDate}. Please choose another time.`;
      }

      throw new ConflictError(message);
    }

    throw error;
  }
}

/**
 * Cancels a reservation atomically.
 * Members can only cancel their own reservations before start time.
 * Admins can cancel any reservation before end time.
 */
export async function cancelReservation(
  actor: { id: string; role: UserRole },
  reservationId: string
) {
  const now = new Date();
  const whereCondition: Prisma.ReservationWhereInput = {
    id: reservationId,
    status: "CONFIRMED",
  };

  if (actor.role === "MEMBER") {
    whereCondition.userId = actor.id;
    whereCondition.startTime = { gt: now };
  } else {
    // Admin can cancel any reservation that hasn't ended yet
    whereCondition.endTime = { gt: now };
  }

  const result = await db.reservation.updateMany({
    where: whereCondition,
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledById: actor.id,
    },
  });

  if (result.count === 0) {
    // Determine specific reason for failure to provide clear friendly message
    const existing = await db.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        userId: true,
        status: true,
        startTime: true,
        endTime: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("Reservation not found");
    }

    if (existing.status === "CANCELLED") {
      throw new ConflictError("This reservation has already been cancelled");
    }

    if (actor.role === "MEMBER" && existing.userId !== actor.id) {
      throw new ForbiddenError("You can only cancel your own reservations");
    }

    if (actor.role === "MEMBER" && existing.startTime <= now) {
      throw new ConflictError("Cannot cancel a reservation that has already started");
    }

    if (actor.role === "ADMIN" && existing.endTime <= now) {
      throw new ConflictError("Cannot cancel a reservation that has already ended");
    }

    throw new ConflictError("Unable to cancel this reservation");
  }

  return { success: true };
}

/**
 * Helper to compute the display status of a reservation.
 */
export function getReservationDisplayStatus(
  status: "CONFIRMED" | "CANCELLED",
  startTime: Date,
  endTime: Date,
  now: Date = new Date()
): ReservationDisplayStatus {
  if (status === "CANCELLED") {
    return "Cancelled";
  }
  if (endTime <= now) {
    return "Completed";
  }
  if (startTime <= now && endTime > now) {
    return "In progress";
  }
  return "Upcoming";
}

/**
 * Lists the authenticated user's reservations partitioned into "upcoming" or "past".
 */
export async function listMyReservations(
  options: ListMyReservationsOptions
): Promise<ListMyReservationsResult> {
  const { userId, tab = "upcoming" } = options;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(50, options.pageSize ?? 10));
  const skip = (page - 1) * pageSize;
  const now = new Date();

  const where: Prisma.ReservationWhereInput = {
    userId,
  };

  if (tab === "upcoming") {
    where.status = "CONFIRMED";
    where.endTime = { gt: now };
  } else {
    // Past reservations: cancelled or ended
    where.OR = [
      { status: "CANCELLED" },
      { endTime: { lte: now } },
    ];
  }

  const orderBy: Prisma.ReservationOrderByWithRelationInput =
    tab === "upcoming" ? { startTime: "asc" } : { startTime: "desc" };

  const [total, records] = await Promise.all([
    db.reservation.count({ where }),
    db.reservation.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      select: {
        id: true,
        purpose: true,
        startTime: true,
        endTime: true,
        status: true,
        cancelledAt: true,
        createdAt: true,
        resource: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const items: MyReservationItem[] = records.map((r) => {
    const displayStatus = getReservationDisplayStatus(r.status, r.startTime, r.endTime, now);
    const canCancel = r.status === "CONFIRMED" && r.startTime > now;

    return {
      id: r.id,
      purpose: r.purpose,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      displayStatus,
      canCancel,
      cancelledAt: r.cancelledAt,
      createdAt: r.createdAt,
      resource: r.resource,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    total,
    totalPages,
    page,
    pageSize,
  };
}

/**
 * Lists upcoming confirmed reservations for a resource within the next N days.
 * Returns only startTime, endTime, and an isMine boolean (no user names, no purposes)
 * to safely present to members.
 */
export async function listUpcomingForResource(
  resourceId: string,
  options?: { days?: number; viewerId?: string }
): Promise<ResourceUpcomingSlot[]> {
  const days = options?.days ?? 14;
  const now = new Date();
  const maxDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const reservations = await db.reservation.findMany({
    where: {
      resourceId,
      status: "CONFIRMED",
      endTime: { gt: now },
      startTime: { lte: maxDate },
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      userId: true,
      startTime: true,
      endTime: true,
    },
  });

  return reservations.map((r) => ({
    id: r.id,
    startTime: r.startTime,
    endTime: r.endTime,
    isMine: Boolean(options?.viewerId && r.userId === options.viewerId),
  }));
}

export interface AdminReservationItem {
  id: string;
  purpose: string | null;
  startTime: Date;
  endTime: Date;
  status: "CONFIRMED" | "CANCELLED";
  displayStatus: ReservationDisplayStatus;
  canCancel: boolean;
  cancelledAt: Date | null;
  createdAt: Date;
  resource: {
    id: string;
    name: string;
    category: {
      name: string;
    };
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  cancelledBy: {
    name: string;
  } | null;
}

export interface ListAllReservationsFilters {
  resourceId?: string;
  q?: string;
  status?: "all" | "upcoming" | "in_progress" | "completed" | "cancelled";
  from?: string;
  to?: string;
}

export interface ListAllReservationsOptions {
  page?: number;
  pageSize?: number;
  actor?: {
    role: UserRole;
  };
}

export interface ListAllReservationsResult {
  items: AdminReservationItem[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

/**
 * Lists all reservations across the system with administrative filtering and pagination.
 * Restricted to administrators.
 */
export async function listAllReservations(
  filters?: ListAllReservationsFilters,
  options?: ListAllReservationsOptions
): Promise<ListAllReservationsResult> {
  if (options?.actor && options.actor.role !== "ADMIN") {
    throw new ForbiddenError("Only administrators can access this service.");
  }

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 15));
  const skip = (page - 1) * pageSize;
  const now = new Date();

  const where: Prisma.ReservationWhereInput = {};

  // Resource filter
  if (filters?.resourceId && filters.resourceId.trim().length > 0) {
    where.resourceId = filters.resourceId.trim();
  }

  // User search (matches name or email, case-insensitive)
  if (filters?.q && filters.q.trim().length > 0) {
    const term = filters.q.trim();
    where.user = {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    };
  }

  // Date range filter: START time falls within [from 00:00, to+1 day 00:00) Asia/Colombo
  if (filters?.from || filters?.to) {
    const timeFilter: Prisma.DateTimeFilter = {};
    if (filters.from && filters.from.trim().length > 0) {
      timeFilter.gte = toUtc(`${filters.from.trim()} 00:00:00`);
    }
    if (filters.to && filters.to.trim().length > 0) {
      const toDayStartUtc = toUtc(`${filters.to.trim()} 00:00:00`);
      timeFilter.lt = new Date(toDayStartUtc.getTime() + 24 * 60 * 60 * 1000);
    }
    where.startTime = timeFilter;
  }

  // Status filter (mapped from computed display statuses)
  if (filters?.status && filters.status !== "all") {
    switch (filters.status) {
      case "upcoming":
        where.status = "CONFIRMED";
        where.startTime = {
          ...((where.startTime as Prisma.DateTimeFilter) || {}),
          gt: now,
        };
        break;
      case "in_progress":
        where.status = "CONFIRMED";
        where.startTime = {
          ...((where.startTime as Prisma.DateTimeFilter) || {}),
          lte: now,
        };
        where.endTime = { gt: now };
        break;
      case "completed":
        where.status = "CONFIRMED";
        where.endTime = { lte: now };
        break;
      case "cancelled":
        where.status = "CANCELLED";
        break;
    }
  }

  const [total, records] = await Promise.all([
    db.reservation.count({ where }),
    db.reservation.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startTime: "desc" },
      select: {
        id: true,
        purpose: true,
        startTime: true,
        endTime: true,
        status: true,
        cancelledAt: true,
        createdAt: true,
        resource: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        cancelledBy: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const items: AdminReservationItem[] = records.map((r) => {
    const displayStatus = getReservationDisplayStatus(r.status, r.startTime, r.endTime, now);
    const canCancel = r.status === "CONFIRMED" && r.endTime > now;

    return {
      id: r.id,
      purpose: r.purpose,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      displayStatus,
      canCancel,
      cancelledAt: r.cancelledAt,
      createdAt: r.createdAt,
      resource: r.resource,
      user: r.user,
      cancelledBy: r.cancelledBy,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    total,
    totalPages,
    page,
    pageSize,
  };
}

/**
 * Admin-specific cancellation wrapper. Reuses the core atomic cancelReservation service,
 * strictly verifying that the caller is an administrator.
 */
export async function cancelReservationAsAdmin(
  actor: { id: string; role: UserRole },
  reservationId: string
) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Only administrators can perform this action.");
  }
  return cancelReservation(actor, reservationId);
}
