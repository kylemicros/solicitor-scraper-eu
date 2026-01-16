/**
 * Column definition for Excel export
 */
export interface SolicitorExcelRow {
  firmName: string;
  address: string;
  website: string;
  email: string;
  telephone?: string; // Optional
  legalIssue: string;
  location?: string; // Optional
  sourceUrl?: string; // Optional
  scrapedAt: string;
}
