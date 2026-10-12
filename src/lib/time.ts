import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Colombo";

/**
 * Converts a local date-time string (or Date object) interpreted in APP_TIMEZONE to a UTC Date.
 * @param localDateTime - Local date-time string (e.g. "2026-10-12 10:00:00") or Date
 * @returns Date object in UTC
 */
export function toUtc(localDateTime: string | Date): Date {
  return fromZonedTime(localDateTime, APP_TIMEZONE);
}

/**
 * Formats a Date in APP_TIMEZONE.
 * @param date - Date, timestamp, or ISO string
 * @param formatStr - date-fns format string (defaults to "yyyy-MM-dd HH:mm:ss")
 * @returns Formatted date-time string in APP_TIMEZONE
 */
export function formatInAppTimezone(
  date: Date | string | number,
  formatStr: string = "yyyy-MM-dd HH:mm:ss"
): string {
  return formatInTimeZone(date, APP_TIMEZONE, formatStr);
}
