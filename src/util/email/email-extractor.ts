import { BLACKLISTED_EMAIL_PATTERNS } from "@config/email/email-blacklist.js";
import { WHITELISTED_EMAIL_PATTERNS } from "@config/email/email-whitelist.js";

import { EmailStatus } from "@util/email/types.js";

/**
 * Classifies an email address as "blacklisted", "whitelisted", or "neutral".
 * @param email - The email address to classify.
 * @return {EmailStatus} - The classification of the email address.
 */
export function classifyEmail(email: string): EmailStatus {
  if (!email || typeof email !== "string") return "blacklisted";

  const normalizedEmail = email.trim().toLowerCase();

  for (const pattern of Object.values(BLACKLISTED_EMAIL_PATTERNS)) {
    if (pattern.test(normalizedEmail)) return "blacklisted";
  }

  for (const pattern of Object.values(WHITELISTED_EMAIL_PATTERNS)) {
    if (pattern.test(normalizedEmail)) return "whitelisted";
  }

  return "neutral";
}
