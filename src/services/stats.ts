import { db } from "@/lib/db";
import { toUtc, getTodayInAppTimezone } from "@/lib/time";
import type { UsagePeriod } from "@/lib/validation/admin-reservations";
import {
  getReservationDisplayStatus,
  type ReservationDisplayStatus,
} from "@/services/reservations";

export interface ScheduleItem {
  id: string;
  startTime: Date;
  endTime: Date;
  displayStatus: ReservationDisplayStatus;
  resource: {
    id: string;
    name: string;
  };
  user: {
    name: string;
  };
}

export interface DashboardSummaryResult {
  pendingUsers: number;
  activeResources: number;
  inactiveResources: number;
  reservationsToday: number;
  upcomingReservations: number;
  cancelledLast30Days: number;
  todaySchedule: ScheduleItem[];
  nextUp: ScheduleItem[];
}

export interface ResourceUsageItem {
  resourceId: string;
  name: string;
  category: string;
  isActive: boolean;
  reservationCount: number;
  bookedHours: number;
}

export interface UsageByResourceResult {
  resources: ResourceUsageItem[];
  totalReservations: number;
  totalBookedHours: number;
  from: Date;
  to: Date;
  period: UsagePeriod;
}

/**
 * Calculates high-level system metrics, counts, and today/next-up schedules for the admin dashboard.
 */
export async function getDashboardSummary(): Promise<DashboardSummaryResult> {
  const now = new Date();
  const todayStr = getTodayInAppTimezone(now);
  const todayStartUtc = toUtc(`${todayStr} 00:00:00`);
  const todayEndUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);
  const thirtyDaysAgoUtc = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    pendingUsers,
    activeResources,
    inactiveResources,
    reservationsToday,
    upcomingReservations,
    cancelledLast30Days,
    todayRaw,
    nextUpRaw,
  ] = await Promise.all([
    db.user.count({ where: { status: "PENDING" } }),
    db.resource.count({ where: { isActive: true } }),
    db.resource.count({ where: { isActive: false } }),
    db.reservation.count({
      where: {
        status: "CONFIRMED",
        startTime: {
          gte: todayStartUtc,
          lt: todayEndUtc,
        },
      },
    }),
    db.reservation.count({
      where: {
        status: "CONFIRMED",
        endTime: { gt: now },
      },
    }),
    db.reservation.count({
      where: {
        status: "CANCELLED",
        OR: [
          { cancelledAt: { gte: thirtyDaysAgoUtc } },
          { createdAt: { gte: thirtyDaysAgoUtc } },
        ],
      },
    }),
    // Today's schedule: CONFIRMED reservations that start today or are currently in progress
    db.reservation.findMany({
      where: {
        status: "CONFIRMED",
        OR: [
          { startTime: { gte: todayStartUtc, lt: todayEndUtc } },
          { startTime: { lte: now }, endTime: { gt: now } },
        ],
      },
      take: 8,
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        resource: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
    // Next 5 upcoming reservations (start > now)
    db.reservation.findMany({
      where: {
        status: "CONFIRMED",
        startTime: { gt: now },
      },
      take: 5,
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        resource: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const mapSchedule = (
    items: Array<{
      id: string;
      startTime: Date;
      endTime: Date;
      status: "CONFIRMED" | "CANCELLED";
      resource: { id: string; name: string };
      user: { name: string };
    }>
  ): ScheduleItem[] =>
    items.map((item) => ({
      id: item.id,
      startTime: item.startTime,
      endTime: item.endTime,
      displayStatus: getReservationDisplayStatus(item.status, item.startTime, item.endTime, now),
      resource: item.resource,
      user: item.user,
    }));

  return {
    pendingUsers,
    activeResources,
    inactiveResources,
    reservationsToday,
    upcomingReservations,
    cancelledLast30Days,
    todaySchedule: mapSchedule(todayRaw),
    nextUp: mapSchedule(nextUpRaw),
  };
}

/**
 * Computes the period range [from, to) in UTC based on a chosen preset.
 */
export function computePeriodBounds(period: UsagePeriod = "last30"): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const todayStr = getTodayInAppTimezone(now);
  const todayStartUtc = toUtc(`${todayStr} 00:00:00`);
  const tomorrowStartUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  if (period === "last7") {
    // 7 local days ending today inclusive
    return {
      from: new Date(todayStartUtc.getTime() - 6 * 24 * 60 * 60 * 1000),
      to: tomorrowStartUtc,
    };
  }

  if (period === "next7") {
    // Today through the next 6 days (7 local days total)
    return {
      from: todayStartUtc,
      to: new Date(todayStartUtc.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  // Default "last30": 30 local days ending today inclusive
  return {
    from: new Date(todayStartUtc.getTime() - 29 * 24 * 60 * 60 * 1000),
    to: tomorrowStartUtc,
  };
}

interface RawUsageRow {
  resourceId: string;
  name: string;
  category: string;
  isActive: boolean;
  reservationCount: number | bigint;
  bookedHours: number | string;
}

/**
 * Computes usage statistics per resource (active & inactive) over a selected time period.
 * Aggregation is handled in PostgreSQL using $queryRaw with parameterized template literals.
 */
export async function getUsageByResource(
  period: UsagePeriod = "last30"
): Promise<UsageByResourceResult> {
  const { from, to } = computePeriodBounds(period);

  const rawRows = await db.$queryRaw<RawUsageRow[]>`
    SELECT
      r.id AS "resourceId",
      r.name AS "name",
      c.name AS "category",
      r.is_active AS "isActive",
      COUNT(res.id)::int AS "reservationCount",
      COALESCE(
        SUM(
          CASE
            WHEN res.id IS NOT NULL THEN
              EXTRACT(EPOCH FROM (LEAST(res.end_time, ${to}) - GREATEST(res.start_time, ${from}))) / 3600.0
            ELSE 0
          END
        ),
        0
      )::float AS "bookedHours"
    FROM resources r
    JOIN resource_categories c ON r.category_id = c.id
    LEFT JOIN reservations res ON res.resource_id = r.id
      AND res.status = 'CONFIRMED'
      AND res.start_time < ${to}
      AND res.end_time > ${from}
    GROUP BY r.id, r.name, c.name, r.is_active
    ORDER BY "bookedHours" DESC, r.name ASC;
  `;

  const resources: ResourceUsageItem[] = rawRows.map((row) => {
    const rawHours = typeof row.bookedHours === "number" ? row.bookedHours : Number(row.bookedHours);
    const bookedHours = Number((rawHours || 0).toFixed(1));
    const reservationCount = Number(row.reservationCount || 0);

    return {
      resourceId: row.resourceId,
      name: row.name,
      category: row.category,
      isActive: Boolean(row.isActive),
      reservationCount,
      bookedHours,
    };
  });

  const totalReservations = resources.reduce((acc, r) => acc + r.reservationCount, 0);
  const totalBookedHours = Number(
    resources.reduce((acc, r) => acc + r.bookedHours, 0).toFixed(1)
  );

  return {
    resources,
    totalReservations,
    totalBookedHours,
    from,
    to,
    period,
  };
}
