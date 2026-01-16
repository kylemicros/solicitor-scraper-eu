/**
 * List of preferred email patterns for solicitors
 * These patterns are used to identify and prioritize emails from trusted sources.
 * This indicates that emails matching these patterns are more likely to be relevant and reliable.
 */
export const WHITELISTED_EMAIL_PATTERNS: Record<string, RegExp> = {
  CONTACT: /contact@/i,
  INFO: /info@/i,
  OFFICE: /(office|reception)@/i,
  ENQUIRIES: /enquir(y|ies)@/i,
  ADMIN: /admin@/i,
  HELLO: /hello@/i,
  MAIL: /mail@/i,
  LEGAL: /(legal|law)@/i,
  TEAM: /(legal\.team|law\.team|team\.legal)@/i,
  HELP: /(help|support)@/i,

  // Solicitor/PDSA common TLDs
  GENERIC_TLDS: /@(?!gmail|yahoo|hotmail|outlook).*?\.(co\.uk|uk|com|org\.uk|law|legal)$/i, // e.g., contact@lawfirm.co.uk

  // Named solicitor emails (MOST COMMON for UK law firms)
  INDIVIDUAL: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.(co\.uk|uk|com|org\.uk|law|legal)$/i, // e.g., john.doe@lawfirm.co.uk
};
