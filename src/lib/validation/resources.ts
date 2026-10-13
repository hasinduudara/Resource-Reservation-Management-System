import { z } from "zod";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .or(z.literal(""))
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
});

export type CategoryInput = z.input<typeof categorySchema>;
export type CategoryOutput = z.output<typeof categorySchema>;

export const resourceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Resource name must be at least 2 characters")
    .max(100, "Resource name cannot exceed 100 characters"),
  categoryId: z.string().uuid("Please select a valid category"),
  location: z
    .string()
    .trim()
    .max(100, "Location cannot exceed 100 characters")
    .optional()
    .or(z.literal(""))
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  capacity: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val, ctx) => {
      if (val === undefined || val === null || val === "") return null;
      const num = typeof val === "number" ? val : Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Capacity must be a positive integer",
        });
        return z.NEVER;
      }
      if (num > 10000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Capacity cannot exceed 10,000",
        });
        return z.NEVER;
      }
      return num;
    }),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional()
    .or(z.literal(""))
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
});

export type ResourceInput = z.input<typeof resourceSchema>;
export type ResourceOutput = z.output<typeof resourceSchema>;

export const listResourcesQuerySchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? val : undefined)),
  includeInactive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type ListResourcesQuery = z.infer<typeof listResourcesQuerySchema>;
