/**
 * Represents a solicitor firm with all extracted data
 */
export interface SolicitorFirm {
  firmName: string;
  address: string;
  website: string | null;
  email: string | null;
  telephone: string | null;
  legalIssue: string;
  location: string;
  sourceUrl: string | null;
  scrapedAt: string;
}

/**
 * Search parameters for building URLs
 */
export interface SearchParams {
  legalIssue: string;
  legalIssueCode: string;
  location: string;
  locationId?: string; // Optional
  category: string;
  region: string;
}

/**
 * Statistics for scraping session
 */
export interface ScrapingStats {
  totalFirmsFound: number;
  firmsWithEmail: number;
  firmsWithoutEmail: number;
  blacklistedEmails: number;
  validEmails: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  duration?: string;
}

/**
 * Result of a scraping session
 */
export interface ScrapingResult {
  firms: SolicitorFirm[];
  stats: ScrapingStats;
}
