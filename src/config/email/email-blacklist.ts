/**
 * This module defines a set of regular expressions to identify blacklisted email patterns.
 * These patterns help filter out unwanted or irrelevant emails, such as those from disposable
 * email providers, auto-senders, or common spammy domains.
 */
export const BLACKLISTED_EMAIL_PATTERNS: Record<string, RegExp> = {
  // Disposable / temporary email providers
  TEMP_EMAIL: /@(tempmail|10minutemail|mailinator|yopmail|guerrillamail)\./i,

  // Auto-sender / unreachable emails
  NO_REPLY: /(no-?reply|do[- ]?not[- ]?reply|automated|mailer|notification)@/i,

  // Test or fake emails
  TEST_EMAIL: /(test|testing|example|dummy|sample|fake)@/i,

  // Common spammy free domains (solicitors use business domains)
  FREE_EMAIL_PROVIDERS: /@(gmail|yahoo|hotmail|outlook)\.(com|co\.uk)$/i,
};
