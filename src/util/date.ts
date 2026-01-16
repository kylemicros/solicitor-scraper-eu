import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/**
 * Get formatted date-time string based on the specified timezone and date format.
 *
 * @param timezone - The timezone to use for formatting. If not provided, it will use the TIMEZONE environment variable or default to 'UTC'.
 * @param dateFormat - The date format string. Defaults to 'yyyy-MM-dd_HH-mm-ss'.
 * @returns Formatted date-time string.
 */
export function getFormattedDateTime(timezone?: string, dateFormat: string = "yyyy-MM-dd_HH-mm-ss"): string {
  const zone = timezone || process.env.TIMEZONE || "UTC";
  const zonedDate = toZonedTime(new Date(), zone);
  return format(zonedDate, dateFormat);
}
