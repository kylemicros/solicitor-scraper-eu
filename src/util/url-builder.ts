import { env } from "@config/env.js";

import { WEB_URL } from "@constants/website.js";

/**
 * Builds a search URL for the Law Society website using the legal issue code directly
 *
 * @param legalIssueCode - The legal issue code (e.g., "LIUPIN")
 * @param location - The location to search in
 * @param isProfessional - Whether to search for professional services
 * @param searchRadius - Search radius in miles (1, 5, 10, or 25)
 * @param locationId - Optional URL-friendly location identifier for disambiguation (e.g., "kingston-upon-hull")
 * @returns Formatted search URL
 */
export function buildSearchUrl(
  legalIssueCode: string,
  location: string,
  isProfessional: boolean = false,
  searchRadius: number = env.SEARCH_RADIUS,
  locationId?: string
): string {
  const params: Record<string, string> = {
    Pro: isProfessional ? "True" : "False",
    UmbrellaLegalIssue: legalIssueCode,
    Location: location,
    SearchRadius: searchRadius.toString(),
  };

  // Add LocationId if provided for disambiguation
  if (locationId) {
    params.LocationId = locationId;
  }

  const searchParams = new URLSearchParams(params);
  return `${WEB_URL}/search/results?${searchParams.toString()}`;
}
