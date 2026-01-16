import { getFormattedDateTime } from "./date.js";

/**
 * Creates a file name by combining a base name, prefix, and extension.
 *
 * @param baseName - The base name of the file.
 * @param prefix - The prefix to add to the base name.
 * @param extension - The file extension (e.g., 'txt', 'xlsx').
 * @returns The constructed file name in the format: `${prefix}_${baseName}_${timestamp}.${extension}`.
 * @example createFileName("report", "sales", "xlsx"); // "sales_report_20240627T153000.xlsx"
 */
export function createFileName(baseName: string, prefix: string, extension: string): string {
  const timestamp = getFormattedDateTime();
  return `${prefix}_${baseName}_${timestamp}.${extension}`;
}
