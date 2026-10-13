/**
 * Core business rules and constraints for the Resource Reservation Management System.
 */

/** Duration of a single reservation scheduling slot in minutes. */
export const SLOT_MINUTES = 15;

/** Minimum allowed duration for a reservation in minutes. */
export const MIN_DURATION_MINUTES = 15;

/** Maximum allowed duration for a reservation in hours. */
export const MAX_DURATION_HOURS = 8;

/** Maximum number of days in advance a reservation can be booked. */
export const MAX_ADVANCE_DAYS = 180;

/** Minimum character length for reservation purpose. */
export const PURPOSE_MIN_LENGTH = 3;

/** Maximum character length for reservation purpose. */
export const PURPOSE_MAX_LENGTH = 200;

/**
 * Checks whether a Date object aligns exactly with the configured slot boundary.
 * Verifies that seconds and milliseconds are zero, and minutes are a multiple of SLOT_MINUTES.
 */
export function isSlotAligned(date: Date): boolean {
  if (isNaN(date.getTime())) return false;
  return (
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0 &&
    date.getUTCMinutes() % SLOT_MINUTES === 0
  );
}

/**
 * Checks whether a local date-time string in "YYYY-MM-DDTHH:mm" format is on a 15-minute boundary.
 */
export function isLocalStringSlotAligned(localStr: string): boolean {
  const parts = localStr.split("T");
  if (parts.length !== 2) return false;
  const timeParts = parts[1].split(":");
  if (timeParts.length < 2) return false;
  const minutes = parseInt(timeParts[1], 10);
  if (isNaN(minutes)) return false;
  return minutes % SLOT_MINUTES === 0;
}
