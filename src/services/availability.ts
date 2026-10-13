import type { Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { getResourceById } from "@/services/resources";
import { toUtc, getTodayInAppTimezone } from "@/lib/time";
import { SLOT_MINUTES } from "@/lib/reservation-rules";
import {
  dayQuerySchema,
  findFreeQuerySchema,
  type FindFreeQueryInput,
} from "@/lib/validation/availability";
import { ValidationError } from "@/lib/errors";

export interface MemberBookedSlot {
  id: string;
  start: Date;
  end: Date;
  isMine: boolean;
}

export interface AdminBookedSlot {
  id: string;
  start: Date;
  end: Date;
  isMine: boolean;
  userName: string;
  purpose: string | null;
}

export type BookedSlot = MemberBookedSlot | AdminBookedSlot;

export interface FreeWindow {
  start: Date;
  end: Date;
}

export interface DayAvailabilityResult {
  date: string;
  resourceId: string;
  booked: BookedSlot[];
  freeWindows: FreeWindow[];
}

export interface GetDayAvailabilityOptions {
  resourceId: string;
  date?: string;
  viewer: {
    id: string;
    role: UserRole;
  };
}

export interface FreeResourceItem {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  description: string | null;
  category: {
    id: string;
    name: string;
  };
}

export interface BusyResourceItem {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  category: {
    id: string;
    name: string;
  };
}

export interface FindFreeResourcesResult {
  freeResources: FreeResourceItem[];
  busyResources: BusyResourceItem[];
  busyCount: number;
  totalMatching: number;
  startUtc: Date;
  endUtc: Date;
  localDate: string;
  localStart: string;
  localEnd: string;
}

/**
 * Retrieves the schedule and computes free windows for a resource across a calendar day in Asia/Colombo.
 * Enforces role-based visibility:
 * - Members see only start, end, and isMine.
 * - Admins additionally see userName and purpose.
 */
export async function getDayAvailability(
  options: GetDayAvailabilityOptions
): Promise<DayAvailabilityResult> {
  const { resourceId, viewer } = options;

  // 1. Verify resource exists and viewer has permission (throws 404 for member if inactive)
  await getResourceById(resourceId, viewer.role);

  // 2. Validate calendar date (defaults to today in Asia/Colombo)
  const parsedDate = dayQuerySchema.safeParse({ date: options.date });
  if (!parsedDate.success) {
    throw new ValidationError(
      parsedDate.error.issues[0]?.message || "Invalid date query",
      parsedDate.error.flatten()
    );
  }

  const dateStr = parsedDate.data.date;

  // 3. Compute day boundaries in UTC (00:00:00 to next day 00:00:00 Asia/Colombo)
  const dayStartUtc = toUtc(`${dateStr} 00:00:00`);
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  // 4. Fetch CONFIRMED reservations overlapping that day
  const reservations = await db.reservation.findMany({
    where: {
      resourceId,
      status: "CONFIRMED",
      startTime: { lt: dayEndUtc },
      endTime: { gt: dayStartUtc },
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      userId: true,
      purpose: true,
      startTime: true,
      endTime: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // 5. Map booked slots with strict role-based property projection
  const booked: BookedSlot[] = reservations.map((r) => {
    const isMine = r.userId === viewer.id;
    if (viewer.role === "ADMIN") {
      return {
        id: r.id,
        start: r.startTime,
        end: r.endTime,
        isMine,
        userName: r.user.name,
        purpose: r.purpose,
      };
    }

    // Members see strictly start, end, isMine (userName and purpose omitted)
    return {
      id: r.id,
      start: r.startTime,
      end: r.endTime,
      isMine,
    };
  });

  // 6. Compute free windows inside the day
  const slotMs = SLOT_MINUTES * 60 * 1000;
  const now = new Date();

  // If the queried day is completely in the past, no future free windows exist
  if (dayEndUtc.getTime() <= now.getTime()) {
    return {
      date: dateStr,
      resourceId,
      booked,
      freeWindows: [],
    };
  }

  // Determine effective search start for free windows
  // If date is today, only the part after "now" rounded UP to next slot is free
  let effectiveStart = dayStartUtc.getTime();
  const todayStr = getTodayInAppTimezone(now);

  if (dateStr === todayStr) {
    const nowSnapped = Math.ceil(now.getTime() / slotMs) * slotMs;
    effectiveStart = Math.max(dayStartUtc.getTime(), nowSnapped);
  }

  if (effectiveStart >= dayEndUtc.getTime()) {
    return {
      date: dateStr,
      resourceId,
      booked,
      freeWindows: [],
    };
  }

  // Clip all reservations overlapping [effectiveStart, dayEndUtc]
  const intervals: Array<{ start: number; end: number }> = [];
  for (const r of reservations) {
    const clippedStart = Math.max(r.startTime.getTime(), effectiveStart);
    const clippedEnd = Math.min(r.endTime.getTime(), dayEndUtc.getTime());
    if (clippedStart < clippedEnd) {
      intervals.push({ start: clippedStart, end: clippedEnd });
    }
  }

  // Merge adjacent or overlapping booked intervals
  intervals.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const iv of intervals) {
    if (merged.length === 0) {
      merged.push({ ...iv });
    } else {
      const last = merged[merged.length - 1];
      if (iv.start <= last.end) {
        last.end = Math.max(last.end, iv.end);
      } else {
        merged.push({ ...iv });
      }
    }
  }

  // Identify gaps between effectiveStart and dayEndUtc
  const freeWindows: FreeWindow[] = [];
  let cursor = effectiveStart;

  for (const block of merged) {
    if (block.start > cursor) {
      const gapStart = cursor;
      const gapEnd = block.start;
      if (gapEnd - gapStart >= slotMs) {
        freeWindows.push({
          start: new Date(gapStart),
          end: new Date(gapEnd),
        });
      }
    }
    cursor = Math.max(cursor, block.end);
  }

  if (dayEndUtc.getTime() - cursor >= slotMs) {
    freeWindows.push({
      start: new Date(cursor),
      end: new Date(dayEndUtc.getTime()),
    });
  }

  return {
    date: dateStr,
    resourceId,
    booked,
    freeWindows,
  };
}

/**
 * Searches for active resources with NO conflicting CONFIRMED reservations for a given time window.
 * The overlap test is performed directly in PostgreSQL via Prisma's `none` relation filter.
 */
export async function findFreeResources(
  input: FindFreeQueryInput & { viewerRole?: UserRole }
): Promise<FindFreeResourcesResult> {
  const validated = findFreeQuerySchema.safeParse(input);
  if (!validated.success) {
    throw new ValidationError(
      validated.error.issues[0]?.message || "Invalid search parameters",
      validated.error.flatten()
    );
  }

  const { date, startTime, endTime, categoryId, minCapacity } = validated.data;

  const startUtc = toUtc(`${date} ${startTime}:00`);
  const endUtc = toUtc(`${date} ${endTime}:00`);

  const whereBase: Prisma.ResourceWhereInput = {
    isActive: true,
    ...(categoryId ? { categoryId } : {}),
    ...(minCapacity ? { capacity: { gte: minCapacity } } : {}),
  };

  const [freeResources, busyResources] = await Promise.all([
    // Active resources with NO overlapping confirmed reservations
    db.resource.findMany({
      where: {
        ...whereBase,
        reservations: {
          none: {
            status: "CONFIRMED",
            startTime: { lt: endUtc },
            endTime: { gt: startUtc },
          },
        },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        location: true,
        capacity: true,
        description: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

    // Active resources with at least one overlapping confirmed reservation
    db.resource.findMany({
      where: {
        ...whereBase,
        reservations: {
          some: {
            status: "CONFIRMED",
            startTime: { lt: endUtc },
            endTime: { gt: startUtc },
          },
        },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        location: true,
        capacity: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    freeResources,
    busyResources,
    busyCount: busyResources.length,
    totalMatching: freeResources.length + busyResources.length,
    startUtc,
    endUtc,
    localDate: date,
    localStart: startTime,
    localEnd: endTime,
  };
}
