import type { Page } from "puppeteer";

import { env } from "@config/env.js";

import { getFormattedDateTime } from "@util/date.js";
import { isValidEmail } from "@util/email/email-validator.js";
import { log } from "@util/logger.js";

import type { SolicitorFirm } from "./types.js";

/**
 * Extracts solicitor firm details from a listing element
 *
 * @param page - Puppeteer page instance
 * @param elementHandle - The section element containing firm data
 * @param legalIssue - The legal issue being searched
 * @param location - The location being searched
 * @param sourceUrl - The URL of the page
 * @returns Extracted solicitor firm data or null if extraction fails
 */
export async function extractSolicitorData(
  page: Page,
  elementHandle: Element,
  legalIssue: string,
  location: string,
  sourceUrl: string
): Promise<SolicitorFirm | null> {
  try {
    const data = await page.evaluate((element: Element) => {
      // Extract firm name
      const firmNameElement = element.querySelector("h2 a.token");
      const firmName = firmNameElement?.textContent?.trim() || "";

      // Extract address
      const addressElement = element.querySelector("li span:first-child");
      const addressText = addressElement?.parentElement?.textContent?.trim() || "";
      const address = addressText.replace(/Address\/Head office\s*/i, "").trim();

      // Extract website
      const websiteElement = element.querySelector("li span:first-child");
      let website: string | null = null;
      if (websiteElement?.textContent?.includes("Website")) {
        const websiteLink = websiteElement.parentElement?.querySelector("a");
        website = websiteLink?.href || null;
      }

      // Check for email in all list items
      let email: string | null = null;
      const listItems = element.querySelectorAll("li");
      for (const item of listItems) {
        const span = item.querySelector("span");
        if (span?.textContent?.includes("Email")) {
          const emailLink = item.querySelector("a.show-email");
          email = emailLink?.getAttribute("data-email") || null;
          break;
        }
      }

      // Extract telephone
      let telephone: string | null = null;
      for (const item of listItems) {
        const span = item.querySelector("span");
        if (span?.textContent?.includes("Telephone")) {
          const phoneText = item.textContent?.trim() || "";
          telephone = phoneText.replace(/Telephone\s*/i, "").trim();
          break;
        }
      }

      return {
        firmName,
        address,
        website,
        email,
        telephone,
      };
    }, elementHandle);

    if (!data.firmName) {
      log.warn("Firm name is missing, skipping entry");
      return null;
    }

    if (data.email && !isValidEmail(data.email)) {
      log.warn(`Email blacklisted for ${data.firmName}: ${data.email}`);
      data.email = null;
    }

    return {
      firmName: data.firmName,
      address: data.address || "N/A",
      website: data.website,
      email: data.email,
      telephone: data.telephone,
      legalIssue,
      location,
      sourceUrl,
      scrapedAt: getFormattedDateTime(env.TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
    };
  } catch (error) {
    log.error({ err: error }, "Failed to extract solicitor data");
    return null;
  }
}

/**
 * Extracts all solicitor firms from the current page
 *
 * @param page - Puppeteer page instance
 * @param legalIssue - The legal issue being searched
 * @param location - The location being searched
 * @returns Array of extracted solicitor firms
 */
export async function extractAllFirmsFromPage(
  page: Page,
  legalIssue: string,
  location: string
): Promise<SolicitorFirm[]> {
  try {
    const sourceUrl = page.url();

    log.info(`Extracting firms from: ${sourceUrl}`);

    await page.waitForSelector("section.solicitor-outer", { timeout: 10000 });

    const elements = await page.$$("section.solicitor-outer");

    log.info(`Found ${elements.length} solicitor listings on page`);

    const firms: SolicitorFirm[] = [];

    for (const element of elements) {
      const firm = await extractSolicitorData(page, element as unknown as Element, legalIssue, location, sourceUrl);

      if (firm) {
        firms.push(firm);
      }
    }

    log.info(`Successfully extracted ${firms.length} firms from page`);

    return firms;
  } catch (error) {
    log.error({ err: error }, "Failed to extract firms from page");
    return [];
  }
}

/**
 * Checks if there is a next page available
 *
 * @param page - Puppeteer page instance
 * @returns True if next page exists
 */
export async function hasNextPage(page: Page): Promise<boolean> {
  try {
    const nextButton = await page.$("a.next:not(.disabled)");
    return nextButton !== null;
  } catch (error) {
    log.error({ err: error }, "Failed to check for next page");
    return false;
  }
}

/**
 * Navigates to the next page
 *
 * @param page - Puppeteer page instance
 * @returns True if navigation was successful
 */
export async function goToNextPage(page: Page): Promise<boolean> {
  try {
    const nextButton = await page.$("a.next:not(.disabled)");

    if (!nextButton) {
      return false;
    }

    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), nextButton.click()]);

    log.info("Navigated to next page");

    return true;
  } catch (error) {
    log.error({ err: error }, "Failed to navigate to next page");
    return false;
  }
}
