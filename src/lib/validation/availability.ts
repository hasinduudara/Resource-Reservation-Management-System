import { z } from "zod";
import {
  SLOT_MINUTES,
  MIN_DURATION_MINUTES,
  MAX_DURATION_HOURS,
  MAX_ADVANCE_DAYS,
  MAX_HISTORY_DAYS,
  isLocalStringSlotAligned,
} from "@/lib/reservation-rules";
import { toUtc, getTodayInAppTimezone } from "@/lib/time";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;
const DATETIME_LOCAL_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * Validates a day query (YYYY-MM-DD) for timeline availability.
 * Defaults to today in Asia/Colombo.
 * Allows viewing history up to 30 days in the past, and up to 180 days in the future.
 */
export const dayQuerySchema = z.object({
  date: z
    .string()
    .trim()
    .optional()
    .transform((val) => val || getTodayInAppTimezone())
    .pipe(
      z
        .string()
        .regex(DATE_REGEX, "Date must be in YYYY-MM-DD format")
        .superRefine((val, ctx) => {
          const targetUtc = toUtc(`${val} 00:00:00`);
          if (isNaN(targetUtc.getTime())) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Invalid calendar date",
            });
            return;
          }

          const todayStr = getTodayInAppTimezone();
          const todayUtc = toUtc(`${todayStr} 00:00:00`);

          const minDateUtc = new Date(
            todayUtc.getTime() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000
          );
          const maxDateUtc = new Date(
            todayUtc.getTime() + MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000
          );

          if (targetUtc.getTime() < minDateUtc.getTime()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Date cannot be more than ${MAX_HISTORY_DAYS} days in the past`,
            });
          }

          if (targetUtc.getTime() > maxDateUtc.getTime()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Date cannot be more than ${MAX_ADVANCE_DAYS} days in advance`,
            });
          }
        })
    ),
});

export type DayQuery = z.infer<typeof dayQuerySchema>;

/**
 * Schema for finding free resources across a given date and time range.
 * Applies the same temporal and slot constraints as reservation creation.
 */
export const findFreeQuerySchema = z
  .object({
    date: z.string().trim().regex(DATE_REGEX, "Date must be in YYYY-MM-DD format"),
    startTime: z.string().trim().regex(TIME_REGEX, "Start time must be in HH:mm format"),
    endTime: z.string().trim().regex(TIME_REGEX, "End time must be in HH:mm format"),
    categoryId: z
      .string()
      .trim()
      .uuid("Invalid category ID")
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined)),
    minCapacity: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val, ctx) => {
        if (val === undefined || val === null || val === "") return undefined;
        const num = typeof val === "number" ? val : Number(val);
        if (!Number.isInteger(num) || num <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Minimum capacity must be a positive integer",
          });
          return z.NEVER;
        }
        return num;
      }),
  })
  .superRefine((data, ctx) => {
    // 1. Slot alignment (15-minute boundary)
    if (!isLocalStringSlotAligned(`T${data.startTime}`)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: `Start time must be on a ${SLOT_MINUTES}-minute boundary (:00, :15, :30, :45)`,
      });
    }

    if (!isLocalStringSlotAligned(`T${data.endTime}`)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: `End time must be on a ${SLOT_MINUTES}-minute boundary (:00, :15, :30, :45)`,
      });
    }

    const startUtc = toUtc(`${data.date} ${data.startTime}:00`);
    const endUtc = toUtc(`${data.date} ${data.endTime}:00`);

    if (isNaN(startUtc.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: "Invalid start date or time",
      });
      return;
    }

    if (isNaN(endUtc.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: "Invalid end date or time",
      });
      return;
    }

    const now = new Date();

    // 2. Start must be in future
    if (startUtc.getTime() <= now.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: "Start time must be in the future",
      });
    }

    // 3. Advance booking limit
    const maxAdvanceMs = MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000;
    if (startUtc.getTime() > now.getTime() + maxAdvanceMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: `Date cannot be more than ${MAX_ADVANCE_DAYS} days in advance`,
      });
    }

    // 4. End must be after start
    if (endUtc.getTime() <= startUtc.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be after start time",
      });
      return;
    }

    // 5. Min and max duration
    const durationMinutes = (endUtc.getTime() - startUtc.getTime()) / (60 * 1000);
    if (durationMinutes < MIN_DURATION_MINUTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: `Minimum duration is ${MIN_DURATION_MINUTES} minutes`,
      });
    }

    if (durationMinutes > MAX_DURATION_HOURS * 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: `Maximum duration is ${MAX_DURATION_HOURS} hours`,
      });
    }
  });

export type FindFreeQueryInput = z.input<typeof findFreeQuerySchema>;
export type FindFreeQueryOutput = z.output<typeof findFreeQuerySchema>;

/**
 * Validates optional prefill query parameters for the booking form.
 * Returns null if any parameter is missing or invalid.
 */
export function parseBookingPrefill(start?: string | null, end?: string | null): {
  startLocal: string;
  endLocal: string;
} | null {
  if (!start || !end) return null;
  if (!DATETIME_LOCAL_REGEX.test(start) || !DATETIME_LOCAL_REGEX.test(end)) {
    return null;
  }
  const startUtc = toUtc(start);
  const endUtc = toUtc(end);
  if (isNaN(startUtc.getTime()) || isNaN(endUtc.getTime())) return null;
  if (endUtc.getTime() <= startUtc.getTime()) return null;

  return {
    startLocal: start,
    endLocal: end,
  };
}
