import type { Page } from "puppeteer";

import { env } from "@config/env.js";

import { log } from "@util/logger.js";
import { buildSearchUrl } from "@util/url-builder.js";

import { extractAllFirmsFromPage, goToNextPage, hasNextPage } from "./solicitor-extractor.js";
import type { SearchParams, SolicitorFirm } from "./types.js";

/**
 * Scrapes solicitors for a specific legal issue and location
 *
 * @param page - Puppeteer page instance
 * @param searchParams - Search parameters (legal issue and location)
 * @returns Array of scraped solicitor firms
 */
export async function scrapeSolicitorsForSearch(page: Page, searchParams: SearchParams): Promise<SolicitorFirm[]> {
  const { legalIssue, legalIssueCode, location, locationId } = searchParams;
  const allFirms: SolicitorFirm[] = [];

  try {
    // Set to 10, but this can be customized as needed
    const searchUrl = buildSearchUrl(legalIssueCode, location, false, 10, locationId);

    log.info(`Starting scrape for: ${legalIssue} in ${location}`);
    log.info(`URL: ${searchUrl}`);

    // Navigate to the search results page
    await page.goto(searchUrl, {
      waitUntil: "networkidle2",
      timeout: env.REQUEST_TIMEOUT_MS,
    });

    let pageNumber = 1;
    let hasMore = true;

    // Scrape all pages
    while (hasMore) {
      log.info(`Scraping page ${pageNumber}...`);

      // Extract firms from current page
      const firms = await extractAllFirmsFromPage(page, legalIssue, location);
      allFirms.push(...firms);

      // Check for next page
      const nextPageExists = await hasNextPage(page);

      if (nextPageExists) {
        const navigated = await goToNextPage(page);

        if (!navigated) {
          log.warn("Failed to navigate to next page, stopping");
          hasMore = false;
        } else {
          pageNumber++;

          // Add delay between pages
          await new Promise((resolve) => setTimeout(resolve, env.REQUEST_DELAY_MS));
        }
      } else {
        log.info("No more pages to scrape");
        hasMore = false;
      }
    }

    log.info(`Completed scrape for ${legalIssue} in ${location}: ${allFirms.length} firms found`);

    return allFirms;
  } catch (error) {
    log.error({ err: error }, `Failed to scrape for ${legalIssue} in ${location}`);
    return allFirms;
  }
}

/**
 * Scrapes solicitors for multiple searches (multiple legal issues and locations)
 *
 * @param page - Puppeteer page instance
 * @param searches - Array of search parameters
 * @returns Array of all scraped solicitor firms
 */
export async function scrapeSolicitorsForMultipleSearches(
  page: Page,
  searches: SearchParams[]
): Promise<SolicitorFirm[]> {
  const allFirms: SolicitorFirm[] = [];

  log.info(`Starting scrape for ${searches.length} searches`);

  for (let i = 0; i < searches.length; i++) {
    const search = searches[i];

    log.info(`Progress: ${i + 1}/${searches.length}`);

    const firms = await scrapeSolicitorsForSearch(page, search);
    allFirms.push(...firms);

    // Add delay between searches
    if (i < searches.length - 1) {
      log.info(`Waiting ${env.REQUEST_DELAY_MS}ms before next search...`);
      await new Promise((resolve) => setTimeout(resolve, env.REQUEST_DELAY_MS));
    }
  }

  log.info(`Completed all scrapes: ${allFirms.length} total firms found`);

  return allFirms;
}
