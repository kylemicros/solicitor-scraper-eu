import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { LEGAL_ISSUES } from "@config/search/search-filters.js";

import type { SearchParams } from "@scrapers/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ValidLocation {
  locationId: string;
  locationText: string;
}

/**
 * Loads validated locations from the JSON file
 */
function loadValidatedLocations(): ValidLocation[] {
  const locationsPath = join(__dirname, "../all-valid-locations.json");
  const content = readFileSync(locationsPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Generates all search parameter combinations using validated locations from JSON
 * Can be filtered by specific legal issue codes via LEGAL_ISSUE_FILTER environment variable
 * Can start from a specific location index via LOCATION_START_INDEX environment variable
 *
 * @returns Array of search parameters with locationId for precise searches
 */
export function generateSearchCombinations(): SearchParams[] {
  const validLocations = loadValidatedLocations();

  // Get checkpoint if provided
  const startIndex = parseInt(process.env.LOCATION_START_INDEX || "0", 10);
  const locationsToProcess = startIndex > 0 ? validLocations.slice(startIndex) : validLocations;

  if (startIndex > 0) {
    console.log(
      ` Checkpoint: Starting from location index ${startIndex} (${validLocations[startIndex]?.locationText || "unknown"})`
    );
    console.log(`   Skipping first ${startIndex} locations, processing ${locationsToProcess.length} remaining`);
  }

  // Check if we should filter by specific legal issues
  const legalIssueFilter = process.env.LEGAL_ISSUE_FILTER;
  const filterCodes = legalIssueFilter ? legalIssueFilter.split(",").map((code) => code.trim().toUpperCase()) : null;

  const allCombinations = Object.entries(LEGAL_ISSUES).flatMap(([category, issuesMap]) =>
    Object.entries(issuesMap).flatMap(([issueName, issueCode]) => {
      // If filter is active, skip issues not in the filter
      if (filterCodes && !filterCodes.includes(issueCode)) {
        return [];
      }

      return locationsToProcess.map((loc) => ({
        legalIssue: issueName,
        legalIssueCode: issueCode,
        location: loc.locationText,
        locationId: loc.locationId,
        category,
        region: "England",
      }));
    })
  );

  return allCombinations;
}
