/**
 * Capitalizes the first letter of a string and makes the rest lowercase.
 *
 * @param str - The input string to capitalize.
 * @returns The capitalized string.
 * @example capitalize("hello world") // "Hello world"
 */
export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Converts a string to Title Case.
 *
 * @param str - The input string to convert.
 * @returns The Title Case string.
 * @example titleCase("hello world") // "Hello World"
 */
export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Converts a string to camelCase.
 *
 * @param str - The input string to convert.
 * @returns The camelCase string.
 */
export function camelCase(str: string): string {
  const words = str.split(" ");
  return words
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

/**
 * Converts a string to PascalCase.
 *
 * @param str - The input string to convert.
 * @returns The PascalCase string.
 */
export function pascalCase(str: string): string {
  return str
    .replace(/(\w)(\w*)/g, (_, firstChar, rest) => firstChar.toUpperCase() + rest.toLowerCase())
    .replace(/\s+/g, "");
}

/**
 * Checks if a string is null, undefined, or empty after trimming whitespace.
 *
 * @param str - The input string to check.
 * @returns True if the string is empty, false otherwise.
 */
export function isEmptyString(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Truncates a string to a specified maximum length, adding "..." if it was truncated.
 *
 * @param str - The input string to truncate.
 * @param maxLength - The maximum allowed length of the string.
 * @returns The truncated string.
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Normalizes whitespace in a string by replacing multiple spaces, tabs, and newlines with a single space.
 *
 * @param str - The input string to normalize.
 * @returns The normalized string.
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, " ").trim();
}

/**
 * Converts a string into a URL-friendly "slug" format.
 *
 * @param str - The input string to slugify.
 * @returns The slugified string.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric characters with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing hyphens
}

/**
 * Extracts the domain from a given URL.
 *
 * @param url - The input URL string.
 * @returns The domain of the URL, or null if the URL is invalid.
 */
export function extractDomain(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (error) {
    return null; // Invalid URL
  }
}

/**
 * Sanitizes a filename by removing or replacing invalid characters.
 *
 * @param filename - The input filename to sanitize.
 * @returns The sanitized filename.
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[\/\\?%*:|"<>]/g, "-");
}
