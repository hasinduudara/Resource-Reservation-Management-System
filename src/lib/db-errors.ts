/**
 * Database error detection utilities for Prisma & PostgreSQL.
 */

/**
 * Reliably detects whether a given error was caused by a PostgreSQL exclusion constraint
 * violation (SQLSTATE 23P01) from an overlapping reservation on the same resource.
 *
 * Empirically observed behavior:
 * Because PostgreSQL exclusion constraints (EXCLUDE USING gist) are custom database constraints,
 * Prisma wraps the driver error in a `PrismaClientUnknownRequestError` containing the underlying
 * `PostgresError { code: "23P01", message: "...violates exclusion constraint \"reservations_no_overlap\"" }`.
 *
 * @param error - The caught error object
 * @returns true if the error represents an exclusion constraint overlap violation
 */
export function isReservationOverlapError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorObj = error as Record<string, unknown>;
  const message = typeof errorObj.message === "string" ? errorObj.message : "";

  // Check for PostgreSQL SQLSTATE 23P01 (exclusion_violation) and the specific constraint or keywords
  const hasSqlState = message.includes('code: "23P01"') || message.includes("23P01");
  const hasConstraintReference =
    message.includes("reservations_no_overlap") ||
    message.includes("exclusion constraint");

  return hasSqlState && hasConstraintReference;
}
