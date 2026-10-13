import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const adminReservationsQuerySchema = z
  .object({
    resourceId: z
      .string()
      .trim()
      .uuid()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined))
      .catch(undefined),
    q: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val ? val : undefined))
      .catch(undefined),
    status: z
      .enum(["all", "upcoming", "in_progress", "completed", "cancelled"])
      .optional()
      .default("all")
      .catch("all"),
    from: z
      .string()
      .trim()
      .regex(DATE_REGEX)
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined))
      .catch(undefined),
    to: z
      .string()
      .trim()
      .regex(DATE_REGEX)
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined))
      .catch(undefined),
    page: z.coerce.number().int().min(1).default(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(15).catch(15),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "'From' date cannot be after 'To' date",
      });
    }
  });

export type AdminReservationsQueryInput = z.input<typeof adminReservationsQuerySchema>;
export type AdminReservationsQueryOutput = z.output<typeof adminReservationsQuerySchema>;

export const usagePeriodSchema = z.object({
  period: z.enum(["last7", "last30", "next7"]).default("last30").catch("last30"),
});

export type UsagePeriod = z.infer<typeof usagePeriodSchema>["period"];
