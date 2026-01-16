import { classifyEmail } from "./email-extractor.js";

/**
 * Validates an email address against the blacklist.
 * @param email - The email address to validate.
 * @return {boolean} - Returns true if the email is not blacklisted, false otherwise.
 */
export function isValidEmail(email: string): boolean {
  return classifyEmail(email) !== "blacklisted";
}
