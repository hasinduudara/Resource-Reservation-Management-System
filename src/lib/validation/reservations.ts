import { z } from "zod";
import {
  SLOT_MINUTES,
  MIN_DURATION_MINUTES,
  MAX_DURATION_HOURS,
  MAX_ADVANCE_DAYS,
  PURPOSE_MIN_LENGTH,
  PURPOSE_MAX_LENGTH,
  isLocalStringSlotAligned,
} from "@/lib/reservation-rules";
import { toUtc } from "@/lib/time";

const DATETIME_LOCAL_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const createReservationSchema = z
  .object({
    resourceId: z.string().uuid("Please select a valid resource"),
    purpose: z
      .string()
      .trim()
      .min(PURPOSE_MIN_LENGTH, `Purpose must be at least ${PURPOSE_MIN_LENGTH} characters`)
      .max(PURPOSE_MAX_LENGTH, `Purpose cannot exceed ${PURPOSE_MAX_LENGTH} characters`),
    startLocal: z
      .string()
      .trim()
      .regex(DATETIME_LOCAL_REGEX, "Start time must be in YYYY-MM-DDTHH:mm format"),
    endLocal: z
      .string()
      .trim()
      .regex(DATETIME_LOCAL_REGEX, "End time must be in YYYY-MM-DDTHH:mm format"),
  })
  .superRefine((data, ctx) => {
    // 1. Slot alignment (15-minute boundary)
    if (!isLocalStringSlotAligned(data.startLocal)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startLocal"],
        message: `Start time must be on a ${SLOT_MINUTES}-minute boundary (:00, :15, :30, :45)`,
      });
    }

    if (!isLocalStringSlotAligned(data.endLocal)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endLocal"],
        message: `End time must be on a ${SLOT_MINUTES}-minute boundary (:00, :15, :30, :45)`,
      });
    }

    // Convert to UTC dates for temporal comparisons
    const startUtc = toUtc(data.startLocal);
    const endUtc = toUtc(data.endLocal);

    if (isNaN(startUtc.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startLocal"],
        message: "Start time is an invalid date",
      });
      return;
    }

    if (isNaN(endUtc.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endLocal"],
        message: "End time is an invalid date",
      });
      return;
    }

    const now = new Date();

    // 2. Start must be in the future
    if (startUtc.getTime() <= now.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startLocal"],
        message: "Start time must be in the future",
      });
    }

    // 3. Advance booking limit
    const maxAdvanceMs = MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000;
    if (startUtc.getTime() > now.getTime() + maxAdvanceMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startLocal"],
        message: `Reservations cannot be booked more than ${MAX_ADVANCE_DAYS} days in advance`,
      });
    }

    // 4. End must be strictly after start
    if (endUtc.getTime() <= startUtc.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endLocal"],
        message: "End time must be after start time",
      });
      return;
    }

    // 5. Minimum and maximum duration
    const durationMinutes = (endUtc.getTime() - startUtc.getTime()) / (60 * 1000);

    if (durationMinutes < MIN_DURATION_MINUTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endLocal"],
        message: `Minimum reservation duration is ${MIN_DURATION_MINUTES} minutes`,
      });
    }

    if (durationMinutes > MAX_DURATION_HOURS * 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endLocal"],
        message: `Maximum reservation duration is ${MAX_DURATION_HOURS} hours`,
      });
    }
  });

export type CreateReservationInput = z.input<typeof createReservationSchema>;
export type CreateReservationOutput = z.output<typeof createReservationSchema>;

export const cancelReservationSchema = z.object({
  reservationId: z.string().uuid("Invalid reservation ID"),
});

export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;

export const listMyReservationsQuerySchema = z.object({
  tab: z.enum(["upcoming", "past"]).default("upcoming").catch("upcoming"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10).catch(10),
});

export type ListMyReservationsQuery = z.infer<typeof listMyReservationsQuerySchema>;
