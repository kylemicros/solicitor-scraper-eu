import { Solver } from "2captcha";
import { Actor } from "apify";
import { ProxyConfiguration, PuppeteerCrawler } from "crawlee";
import type ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";

import { env } from "@config/env.js";
import { getLegalIssueName } from "@config/search/search-filters.js";

import { addFirmToWorksheet, initializeStreamingWorkbook, writeWorkbookToFile } from "@services/excel/index.js";
import { getOneDriveClient, uploadFileToOneDrive } from "@services/onedrive/index.js";

import { createInitialStats, finalizeStats, logStats, updateStats } from "@scrapers/scraper-stats.js";
import type { SolicitorFirm } from "@scrapers/types.js";

import { getFormattedDateTime } from "@util/date.js";
import { log } from "@util/logger.js";
import { generateSearchCombinations } from "@util/search-generator.js";
import { buildSearchUrl } from "@util/url-builder.js";

import { generateCountReport } from "./generate-count-report.js";

async function main(): Promise<void> {
  try {
    log.info("Starting Solicitor Scraper");
    log.info(`Environment: ${env.APP_ENV}`);
    log.info(`Timezone: ${env.TIMEZONE}`);

    // Initialize statistics
    const stats = createInitialStats();
    const allFirms: SolicitorFirm[] = [];

    // Always create new file on initialization
    const tempDir = path.join(process.cwd(), "temp");
    await fs.mkdir(tempDir, { recursive: true });

    const fileName = `scraper_output_solicitors_${getFormattedDateTime(env.TIMEZONE, "yyyy-MM-dd_HH-mm-ss")}.xlsx`;
    const init = initializeStreamingWorkbook("Solicitors");
    const workbook: ExcelJS.Workbook = init.workbook;
    const worksheet: ExcelJS.Worksheet = init.worksheet;
    const filePath = path.join(tempDir, fileName);

    // Save file locally
    await writeWorkbookToFile(workbook, filePath);
    log.info(` Created new file: ${fileName}`);

    // Upload initial file to OneDrive in production mode
    if (env.APP_ENV === "production") {
      try {
        const fileBuffer = await fs.readFile(filePath);
        const client = getOneDriveClient();
        const result = await uploadFileToOneDrive(client, fileName, fileBuffer);

        if (result.success) {
          log.info(` Initial file uploaded to OneDrive - File ID: ${result.fileId}`);
        } else {
          log.error(`Initial OneDrive upload FAILED: ${result.error}`);
        }
      } catch (uploadError) {
        log.error({ err: uploadError }, "Initial OneDrive upload failed");
      }
    }

    log.info(`=================================\n`);
    // Graceful shutdown handler
    let isShuttingDown = false;
    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      log.info(`\n${signal} received - Saving current progress...`);
      log.info(`Total firms scraped before shutdown: ${allFirms.length}`);

      try {
        // Data is already saved incrementally, just finalize stats
        finalizeStats(stats);
        logStats(stats);

        log.info(` Existing file: ${filePath}`);
        log.info(` ${allFirms.length} firms saved successfully`);

        // Final OneDrive upload before shutdown (in production)
        if (env.APP_ENV === "production") {
          try {
            const { writeWorkbookToFileAndBuffer } = await import("./util/excel.js");
            const fileBuffer = await writeWorkbookToFileAndBuffer(workbook, filePath);
            const client = getOneDriveClient();
            const result = await uploadFileToOneDrive(client, fileName, fileBuffer);

            if (result.success) {
              log.info(` Final OneDrive upload completed - File ID: ${result.fileId}`);
            } else {
              log.error(`Final OneDrive upload FAILED: ${result.error}`);
            }
          } catch (uploadError) {
            log.error({ err: uploadError }, "Final OneDrive upload failed");
          }
        }

        // Generate count report
        const legalIssueCounts = new Map<string, number>();
        for (const firm of allFirms) {
          const legalIssues = firm.legalIssue.split(", ");
          for (const issue of legalIssues) {
            const trimmedIssue = issue.trim();
            if (trimmedIssue) {
              legalIssueCounts.set(trimmedIssue, (legalIssueCounts.get(trimmedIssue) || 0) + 1);
            }
          }
        }
        await generateCountReport(legalIssueCounts);

        log.info("=== SCRAPING COMPLETE ===");
        log.info(`File: ${fileName}`);
        log.info(`Total firms: ${allFirms.length}`);

        process.exit(0);
      } catch (error) {
        log.error({ err: error }, "Error during graceful shutdown");
        process.exit(1);
      }
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    // Generate search combinations from configuration
    const searches = generateSearchCombinations();
    log.info(`Generated ${searches.length} search combinations`);

    // Log which legal issues are being processed
    const uniqueLegalIssues = [...new Set(searches.map((s) => `${s.legalIssue} (${s.legalIssueCode})`))];
    log.info(`Legal issues to process: ${uniqueLegalIssues.join(", ")}`);
    if (process.env.LEGAL_ISSUE_FILTER) {
      log.info(` LEGAL_ISSUE_FILTER active: ${process.env.LEGAL_ISSUE_FILTER}`);
    }

    // Generate URLs for all search combinations
    const startUrls = searches.map((search) =>
      buildSearchUrl(search.legalIssueCode, search.location, false, env.SEARCH_RADIUS)
    );

    log.info(` Starting fresh with ${startUrls.length} URLs`);

    // Configure proxy if enabled
    let proxyConfiguration: ProxyConfiguration | undefined;
    if (env.USE_PROXY) {
      if (env.PROXY_URL) {
        // Custom proxy URL provided
        proxyConfiguration = new ProxyConfiguration({
          proxyUrls: [env.PROXY_URL],
        });
        log.info("Custom proxy enabled");
      } else {
        // Use Apify residential proxies (automatic when running on Apify platform)
        proxyConfiguration = await Actor.createProxyConfiguration({
          groups: ["RESIDENTIAL"],
          countryCode: "GB", // UK proxies to match target website location
        });
        log.info("Apify residential proxies enabled (UK)");
      }
    }

    // Track requests per session for rotation
    let requestsInCurrentSession = 0;

    // Create Puppeteer crawler
    const crawler = new PuppeteerCrawler({
      proxyConfiguration,
      maxRequestsPerCrawl: env.MAX_REQUESTS_PER_CRAWL,
      maxConcurrency: 1,
      requestHandlerTimeoutSecs: 300,

      browserPoolOptions: {
        useFingerprints: true,
        fingerprintOptions: {
          fingerprintGeneratorOptions: {
            browsers: [{ name: "chrome", minVersion: 120, maxVersion: 130 }],
            devices: ["desktop"],
            operatingSystems: ["windows", "macos"],
            locales: ["en-GB", "en-US"],
          },
        },
        retireBrowserAfterPageCount: env.REQUESTS_PER_SESSION,
      },

      launchContext: {
        launchOptions: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--window-size=1920,1080",
          ],
          ignoreDefaultArgs: ["--enable-automation"],
        },
      },

      preNavigationHooks: [
        async ({ page }) => {
          await page.setExtraHTTPHeaders({
            "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          });

          // PHASE 2: Human-like behavior simulation
          // Random delay before any action (1-3 seconds)
          const initialDelay = Math.random() * 2000 + 1000;
          await new Promise((r) => setTimeout(r, initialDelay));

          // Simulate random mouse movements (humans don't keep mouse still- duh)
          const moveCount = Math.floor(Math.random() * 3) + 2; // 2-4 movements
          for (let i = 0; i < moveCount; i++) {
            const x = Math.random() * 1920;
            const y = Math.random() * 1080;
            await page.mouse.move(x, y);
            await new Promise((r) => setTimeout(r, Math.random() * 200 + 100)); // 100-300ms between moves
          }
        },
      ],

      // POST-NAVIGATION HOOKS: Add human behavior after page loads
      postNavigationHooks: [
        async ({ page }) => {
          // Random delay after navigation (500ms-2s)
          await new Promise((r) => setTimeout(r, Math.random() * 1500 + 500));

          // Simulate reading behavior - random small scrolls
          const scrollCount = Math.floor(Math.random() * 3) + 1; // 1-3 scrolls
          for (let i = 0; i < scrollCount; i++) {
            const scrollAmount = Math.random() * 300 + 100; // 100-400px
            await page.evaluate((amount) => {
              window.scrollBy({
                top: amount,
                behavior: "smooth",
              });
            }, scrollAmount);
            await new Promise((r) => setTimeout(r, Math.random() * 1000 + 500)); // 500-1500ms pause
          }

          // Sometimes scroll back up a bit (mimics reading)
          if (Math.random() > 0.5) {
            await page.evaluate(() => {
              window.scrollBy({
                top: -(Math.random() * 150 + 50),
                behavior: "smooth",
              });
            });
            await new Promise((r) => setTimeout(r, Math.random() * 500 + 300));
          }

          // Random mouse movement on the page :D
          const x = Math.random() * 1920;
          const y = Math.random() * 1080;
          await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
        },
      ],

      async requestHandler({ request, page }) {
        const url = new URL(request.loadedUrl || request.url);
        const location = url.searchParams.get("Location") || "Unknown";
        const legalIssueCode = url.searchParams.get("UmbrellaLegalIssue") || "Unknown";

        log.info(`Processing: ${location} - ${legalIssueCode}`);
        log.info(`Current page URL: ${page.url()}`);

        try {
          // PHASE 2: Add small random delay before checking page content (human reading time)
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));

          // Check if we're on a bot detection/verification page
          const bodyText = await page.evaluate(() => document.body.textContent || "").catch(() => "");
          if (bodyText.includes("verify your browser") || bodyText.includes("Just a moment")) {
            log.warn(`Bot detection page detected for ${location}, attempting CAPTCHA solving...`);

            // PHASE 3: Use 2Captcha to solve reCAPTCHA Enterprise
            const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY;
            if (CAPTCHA_API_KEY) {
              try {
                const solver = new Solver(CAPTCHA_API_KEY);
                const captchaSiteKey = "6LcL6zkrAAAAABu2p8Hpe_zhwyCFxKng3hZcvj5S";
                const pageUrl = request.url;

                log.info(`Sending reCAPTCHA to 2Captcha for solving...`);
                // 2Captcha API expects separate arguments: recaptcha(googlekey, pageurl, extra)
                const result = await solver.recaptcha(captchaSiteKey, pageUrl, {
                  enterprise: 1, // This is a reCAPTCHA Enterprise
                });

                log.info(`CAPTCHA solved successfully, token: ${result.data.substring(0, 50)}...`);

                // Inject the solution token into the page
                await page.evaluate((token) => {
                  // Submit the token to the verification callback
                  if (typeof (window as any).verifyCaptcha === "function") {
                    (window as any).verifyCaptcha(token);
                  } else {
                    // If no callback found, try setting it in the reCAPTCHA response field
                    const responseField = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement;
                    if (responseField) {
                      responseField.innerHTML = token;
                    }
                    // Trigger any form submissions
                    const forms = document.querySelectorAll("form");
                    forms.forEach((form) => {
                      if (form.querySelector('[name="g-recaptcha-response"]')) {
                        form.submit();
                      }
                    });
                  }
                }, result.data);

                // Wait for navigation after CAPTCHA solution
                log.info(`Waiting for page to navigate after CAPTCHA solution...`);
                await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {
                  log.warn("Navigation timeout after CAPTCHA, continuing anyway");
                });
              } catch (captchaError) {
                log.error(
                  `Failed to solve CAPTCHA: ${captchaError instanceof Error ? captchaError.message : String(captchaError)}`
                );

                // Fallback: Wait and hope it clears
                log.warn(`Falling back to wait strategy...`);
                const waitTime = 30000;
                const moveInterval = 2000;
                const moves = Math.floor(waitTime / moveInterval);

                for (let i = 0; i < moves; i++) {
                  const x = Math.random() * 1920;
                  const y = Math.random() * 1080;
                  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
                  await new Promise((resolve) => setTimeout(resolve, moveInterval));
                }
              }
            } else {
              log.warn("CAPTCHA_API_KEY not set, falling back to wait strategy");
              // PHASE 2: Add random mouse movements while waiting
              const waitTime = 30000;
              const moveInterval = 2000; // Move mouse every 2 seconds
              const moves = Math.floor(waitTime / moveInterval);

              for (let i = 0; i < moves; i++) {
                const x = Math.random() * 1920;
                const y = Math.random() * 1080;
                await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
                await new Promise((resolve) => setTimeout(resolve, moveInterval));
              }
            }

            // After solving/waiting, navigate to the correct URL again
            const targetUrl = request.url;
            log.info(`Navigating to target URL: ${targetUrl}`);
            await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });
          }

          // Wait for page content to load with variable timing (humans have different reaction times)
          log.info(`Waiting for page content to fully load...`);
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 1500 + 1500)); // 1.5-3 seconds

          let pageNumber = 1;
          let hasMorePages = true;

          // Loop through all pages for this search
          while (hasMorePages) {
            log.info(`Processing page ${pageNumber} for ${location} - ${legalIssueCode}`);

            // PHASE 2: Random scroll before looking for content (humans scan the page)
            await page.evaluate(() => {
              window.scrollTo({
                top: Math.random() * 200,
                behavior: "smooth",
              });
            });
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 800 + 400)); // 400-1200ms

            // Wait for content or check for no results
            try {
              await page.waitForSelector("section.solicitor-outer", { timeout: 60000 });
            } catch (_timeoutError) {
              // Check if it's a no-results page
              const hasNoResults = await page
                .$(".no-results, .alert")
                .then((el) => !!el)
                .catch(() => false);
              if (hasNoResults) {
                log.info(`No results found for ${location} - ${legalIssueCode}`);
                hasMorePages = false;
                break;
              }

              // Log error and move on - Crawlee will handle retries if it's a network issue
              const currentBodyText = await page.evaluate(() => document.body.textContent || "").catch(() => "");
              const pageTitle = await page.title().catch(() => "");
              log.error(`Timeout waiting for results: ${location} - ${legalIssueCode}`);
              log.error(`Page title: ${pageTitle}`);
              log.error(`Page content preview: ${currentBodyText.substring(0, 300)}`);
              stats.errors++;
              hasMorePages = false;
              break;
            }

            // PHASE 2: Variable delay for dynamic content (humans have different processing speeds)
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 800)); // 800-1800ms

            // PHASE 2: Simulate reading by scrolling through results
            await page.evaluate(() => {
              const scrollAmount = Math.random() * 400 + 200; // 200-600px
              window.scrollBy({
                top: scrollAmount,
                behavior: "smooth",
              });
            });
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 600 + 400)); // 400-1000ms

            // Get all firm elements
            const firmElements = await page.$$("section.solicitor-outer");
            log.info(`Found ${firmElements.length} firms on page ${pageNumber}`);

            // Skip if no firms found (might be a transient error or no results)
            if (firmElements.length === 0) {
              log.warn(`No firms found on page ${pageNumber}, stopping pagination for ${location} - ${legalIssueCode}`);
              hasMorePages = false;
              break;
            }

            // Extract each firm
            for (const element of firmElements) {
              try {
                const firmData = await page.evaluate((el: Element) => {
                  const firmNameEl = el.querySelector("h2 a.token");
                  const firmName = firmNameEl?.textContent?.trim() || "";

                  // Extract address
                  let address = "";
                  const listItems = el.querySelectorAll("ul.details li");
                  for (const li of listItems) {
                    const span = li.querySelector("span");
                    if (span?.textContent?.includes("Address")) {
                      // Get text and remove all address-related prefixes
                      let text = li.textContent || "";
                      // Remove "Address/Head office" first
                      text = text.replace(/Address\/Head office/gi, "");
                      // Remove standalone "Address" (with any amount of whitespace around it)
                      text = text.replace(/^\s*Address\s*/gi, "");
                      text = text.replace(/\s*Address\s*/gi, " ");
                      // Clean up multiple spaces and trim
                      text = text.replace(/\s+/g, " ").trim();
                      address = text;
                      break;
                    }
                  }

                  // Extract website
                  let website: string | null = null;
                  for (const li of listItems) {
                    const span = li.querySelector("span");
                    if (span?.textContent?.includes("Website")) {
                      const link = li.querySelector("a");
                      website = link?.href || null;
                      break;
                    }
                  }

                  // Extract email
                  let email: string | null = null;
                  for (const li of listItems) {
                    const span = li.querySelector("span");
                    if (span?.textContent?.includes("Email")) {
                      const emailLink = li.querySelector("a.show-email");
                      email = emailLink?.getAttribute("data-email") || null;
                      break;
                    }
                  }

                  // Extract telephone
                  // let telephone: string | null = null;
                  // for (const li of listItems) {
                  //   const span = li.querySelector('span');
                  //   if (span?.textContent?.includes('Telephone')) {
                  //     telephone = li.textContent?.replace(/Telephone\s*/i, '').trim() || null;
                  //     break;
                  //   }
                  // }

                  return { firmName, address, website, email };
                }, element);

                if (firmData.firmName) {
                  // Create unique identifier for duplicate detection
                  const firmKey = `${firmData.firmName.toLowerCase()}|${firmData.address.toLowerCase()}`;

                  // Check if this exact firm has already been added
                  const existingFirm = allFirms.find((firm) => {
                    const existingKey = `${firm.firmName.toLowerCase()}|${firm.address.toLowerCase()}`;
                    return existingKey === firmKey;
                  });

                  const currentLegalIssue = getLegalIssueName(legalIssueCode);

                  if (existingFirm) {
                    let updated = false;

                    // Check if this legal issue is already in the list
                    const legalIssues = existingFirm.legalIssue.split(", ");
                    if (!legalIssues.includes(currentLegalIssue)) {
                      // Append the new legal issue
                      existingFirm.legalIssue = `${existingFirm.legalIssue}, ${currentLegalIssue}`;
                      updated = true;
                    }

                    // Check if this location is already in the list
                    const locations = existingFirm.location.split(", ");
                    if (!locations.includes(location)) {
                      // Append the new location
                      existingFirm.location = `${existingFirm.location}, ${location}`;
                      updated = true;
                    }

                    if (updated) {
                      log.info(
                        `Merged for ${firmData.firmName}: Legal Issue: ${existingFirm.legalIssue}, Location: ${existingFirm.location}`
                      );

                      // Update the existing row in the Excel file
                      try {
                        // Find the row number for this firm (rowNumber = index + 2 to account for header)
                        const rowNumber = allFirms.indexOf(existingFirm) + 2;
                        const row = worksheet.getRow(rowNumber);

                        // Update all cells with complete firm data
                        // Column mapping: FirmName=1, Address=2, Website=3, Email=4, LegalIssue=5, ScrapedAt=6
                        row.getCell(1).value = existingFirm.firmName;
                        row.getCell(2).value = existingFirm.address;
                        row.getCell(3).value = existingFirm.website || "N/A";
                        row.getCell(4).value = existingFirm.email || "N/A";
                        row.getCell(5).value = existingFirm.legalIssue;
                        row.getCell(6).value = existingFirm.scrapedAt;
                        // Note: Location is NOT in Excel - it's only tracked in memory
                        // But you can add it if you like- I just don't.
                        row.commit();

                        // Always save locally. Just to be safe.
                        const { writeWorkbookToFileAndBuffer } = await import("./util/excel.js");
                        await writeWorkbookToFileAndBuffer(workbook, filePath);
                        log.info(` Excel updated with merged data for ${firmData.firmName}`);

                        // Skip individual merge uploads - they'll be included in the next batch upload
                        // This prevents excessive API calls from merge operations
                      } catch (updateError) {
                        log.error({ err: updateError }, "Failed to update Excel after merge");
                      }
                    } else {
                      log.info(`Duplicate firm with same legal issue and location, skipping: ${firmData.firmName}`);
                    }
                    continue;
                  }

                  const firm: SolicitorFirm = {
                    firmName: firmData.firmName,
                    address: firmData.address || "N/A",
                    website: firmData.website,
                    email: firmData.email,
                    // telephone: firmData.telephone,
                    telephone: null,
                    legalIssue: currentLegalIssue, // Already converted from code to name
                    location: location,
                    // sourceUrl: page.url(),
                    sourceUrl: null,
                    scrapedAt: getFormattedDateTime(env.TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
                  };

                  allFirms.push(firm);
                  updateStats(stats, firm);

                  // Write to Excel immediately (real-time persistence)
                  try {
                    addFirmToWorksheet(worksheet, firm);

                    // Always save locally and get buffer
                    const { writeWorkbookToFileAndBuffer } = await import("./util/excel.js");
                    const fileBuffer = await writeWorkbookToFileAndBuffer(workbook, filePath);
                    log.info(` Saved firm ${allFirms.length}: ${firm.firmName}`);

                    // Batch upload to OneDrive every 5 firms to avoid rate limiting
                    const shouldUpload = env.APP_ENV === "production" && allFirms.length % 5 === 0;

                    if (shouldUpload) {
                      try {
                        const client = getOneDriveClient();
                        log.info(`Uploading batch to OneDrive... (${allFirms.length} firms)`);
                        const result = await uploadFileToOneDrive(client, fileName, fileBuffer);

                        if (result.success) {
                          log.info(
                            ` OneDrive upload confirmed - File ID: ${result.fileId} - Total: ${allFirms.length} firms`
                          );
                        } else {
                          log.error(`OneDrive upload FAILED: ${result.error}`);
                        }
                      } catch (uploadError) {
                        log.error({ err: uploadError }, "OneDrive batch upload failed");
                      }
                    }
                  } catch (saveError) {
                    log.error({ err: saveError }, `Failed to save firm to Excel: ${firm.firmName}`);
                  }
                }
              } catch (error) {
                log.error({ err: error }, "Failed to extract firm data");
                stats.errors++;
              }
            }

            log.info(`Total firms collected so far: ${allFirms.length}`);

            // Check if there's a next page - try multiple selectors
            let nextButton = await page.$("li.next:not(.disabled) a");
            if (!nextButton) {
              nextButton = await page.$("a.next:not(.disabled)");
            }
            if (!nextButton) {
              nextButton = await page.$('a[rel="next"]');
            }

            if (nextButton) {
              log.info(`Next page button found for page ${pageNumber}`);

              try {
                // Get the href attribute
                const nextHref = await page.evaluate((el) => el.getAttribute("href"), nextButton);
                log.info(`Next button href: ${nextHref}`);

                if (nextHref && nextHref !== "#" && !nextHref.startsWith("javascript:")) {
                  // It's a real link - navigate to it directly
                  const nextUrl = nextHref.startsWith("http") ? nextHref : new URL(nextHref, page.url()).href;
                  log.info(`Navigating to: ${nextUrl}`);

                  try {
                    await page.goto(nextUrl, { waitUntil: "networkidle2", timeout: 60000 });
                  } catch (_navError) {
                    log.warn(`Navigation timeout, trying domcontentloaded...`);
                    await page.goto(nextUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
                  }

                  pageNumber++;
                  log.info(`Successfully moved to page ${pageNumber}`);

                  // Add delay between page navigations
                  await new Promise((resolve) => setTimeout(resolve, env.REQUEST_DELAY_MS));
                } else {
                  log.warn(`Next button has no valid href (${nextHref}), stopping pagination`);
                  hasMorePages = false;
                }
              } catch (navError) {
                log.error({ err: navError }, "Failed to navigate to next page");
                hasMorePages = false;
              }
            } else {
              log.info(`No more pages for ${location} - ${legalIssueCode}`);
              hasMorePages = false;
            }
          }
        } catch (error) {
          log.error({ err: error }, `Failed to process page: ${request.url}`);
          stats.errors++;
        }

        // Increment session request counter
        requestsInCurrentSession++;

        // Add randomized delay between searches (base + jitter)
        const jitter = Math.random() * env.REQUEST_DELAY_JITTER_MS;
        const totalDelay = env.REQUEST_DELAY_MS + jitter;
        log.info(
          `Waiting ${Math.round(totalDelay / 1000)}s before next request (request ${requestsInCurrentSession} in session)`
        );
        await new Promise((resolve) => setTimeout(resolve, totalDelay));

        // Extra delay if we're rotating sessions
        if (requestsInCurrentSession >= env.REQUESTS_PER_SESSION) {
          log.info(`Session rotation: Waiting additional ${env.SESSION_ROTATION_DELAY_MS / 1000}s before new session`);
          await new Promise((resolve) => setTimeout(resolve, env.SESSION_ROTATION_DELAY_MS));
          requestsInCurrentSession = 0;
        }
      },

      failedRequestHandler({ request }, error) {
        log.error({ err: error }, `Request failed: ${request.url}`);
        stats.errors++;
      },
    });

    // Run the crawler
    log.info("Starting crawler...");
    await crawler.run(startUrls);

    // Finalize statistics
    finalizeStats(stats);
    logStats(stats);

    // Finalize export
    if (allFirms.length === 0) {
      log.warn("No firms were scraped. Nothing to export.");
      return;
    }

    log.info(`Scraping completed. Total unique firms: ${allFirms.length}`);
    log.info(`Excel file already contains all ${allFirms.length} firms (saved incrementally)`);

    // Generate count report by legal issue
    log.info("Generating legal issue count report...");
    const legalIssueCounts = new Map<string, number>();

    for (const firm of allFirms) {
      // Split legal issues if a firm has multiple
      const legalIssues = firm.legalIssue.split(", ");
      for (const issue of legalIssues) {
        const trimmedIssue = issue.trim();
        if (trimmedIssue) {
          legalIssueCounts.set(trimmedIssue, (legalIssueCounts.get(trimmedIssue) || 0) + 1);
        }
      }
    }

    const countReportPath = await generateCountReport(legalIssueCounts);
    log.info(`Count report generated: ${countReportPath}`);

    // In production mode, ensure final upload to OneDrive (file already uploaded incrementally)
    if (env.APP_ENV === "production") {
      log.info("Production mode: Performing final OneDrive upload");

      try {
        // Read the file we've been writing to incrementally
        const fileBuffer = await fs.readFile(filePath);
        const client = getOneDriveClient();
        const result = await uploadFileToOneDrive(client, fileName, fileBuffer);

        if (result.success) {
          log.info(` Final upload successful: ${result.webUrl}`);
          log.info(`File has been updated incrementally throughout scraping`);
          // Clean up temp file
          await fs.unlink(filePath).catch(() => {});
        } else {
          log.error(`Final upload failed: ${result.error}`);
        }
      } catch (error) {
        log.error({ err: error }, "Failed to perform final OneDrive upload");
      }
    } else {
      log.info(`Development mode: File saved at ${filePath}`);
    }

    log.info("Scraping completed successfully");
  } catch (error) {
    log.error({ err: error }, "Fatal error in main process");
    process.exit(1);
  }
}

// Run the scraper
main().catch((error) => {
  log.error({ err: error }, "Unhandled error");
  process.exit(1);
});
