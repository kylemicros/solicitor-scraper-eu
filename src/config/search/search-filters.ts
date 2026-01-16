/*
  Sample URL (from the official website): https://solicitors.lawsociety.org.uk/search/results?Pro=False&UmbrellaLegalIssue=LIUIMM&Location=St+Albans

  Sample Selections
  Your legal issue: Immigration and changing countries
  Location: St Albans
 */

type LegalIssueCode = {
  [key: string]: string;
};

/**
 * Legal issues that the scraper processes.
 * Each container processes one legal issue at a time.
 */

// Do not edit directly here - sync with official codes from the website if they change
export const LEGAL_ISSUES: Record<string, LegalIssueCode> = {
  PERSONAL: {
    "Accidents and Injury": "LIUPIN",
    "Constitution": "LIUCNL",
    "Consumer and civil rights": "LIUCSU",
    "Crime": "LIUCRM",
    "Employment": "LIUEMP",
    "Family and relationships": "LIUFAM",
    "General counsel": "LIUGCO",
    "Houses, property and neighbours": "LIUPRE",
    "Immigration and changing countries": "LIUIMM",
    "Mental Capacity": "LIUMCP",
    "Money and debt": "LIUMAD",
    "Social welfare, health and benefits": "LIUSWB",
    "Wills, trusts and probate": "LIUPCW",
  },
  BUSINESS: {
    "Business premises": "LIUBUP",
    "Company and commercial": "LIUCOM",
    "Dispute resolution": "LIUDPR",
    "Energy, utilities and transport": "LIUEUT",
    "Media, IT and intellectual property": "LIUMED",
    "Regulation and compliance": "LIUREG",
  },
};

/**
 * Get legal issue name from code
 * @param code - Legal issue code (e.g., "LIUPIN")
 * @returns Legal issue name or the code if not found
 */
export function getLegalIssueName(code: string): string {
  for (const category in LEGAL_ISSUES) {
    for (const [name, issueCode] of Object.entries(LEGAL_ISSUES[category])) {
      if (issueCode === code) {
        return name;
      }
    }
  }

  return code;
}
