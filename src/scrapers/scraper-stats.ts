import { log } from "@util/logger.js";

import type { ScrapingStats, SolicitorFirm } from "./types.js";

/**
 * Creates initial scraping statistics
 *
 * @returns Initial stats object
 */
export function createInitialStats(): ScrapingStats {
  return {
    totalFirmsFound: 0,
    firmsWithEmail: 0,
    firmsWithoutEmail: 0,
    blacklistedEmails: 0,
    validEmails: 0,
    errors: 0,
    startTime: new Date(),
  };
}

/**
 * Updates scraping statistics with a new firm
 *
 * @param stats - Current statistics
 * @param firm - Firm to add to statistics
 */
export function updateStats(stats: ScrapingStats, firm: SolicitorFirm): void {
  stats.totalFirmsFound++;

  if (firm.email) {
    stats.firmsWithEmail++;
    stats.validEmails++;
  } else {
    stats.firmsWithoutEmail++;
  }
}

/**
 * Finalizes scraping statistics
 *
 * @param stats - Statistics to finalize
 * @returns Finalized statistics
 */
export function finalizeStats(stats: ScrapingStats): ScrapingStats {
  stats.endTime = new Date();

  const durationMs = stats.endTime.getTime() - stats.startTime.getTime();
  const durationSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  stats.duration = `${minutes}m ${seconds}s`;

  return stats;
}

/**
 * Logs scraping statistics
 *
 * @param stats - Statistics to log
 */
export function logStats(stats: ScrapingStats): void {
  log.info("\n" + "=".repeat(50));
  log.info("Scraping Statistics");
  log.info("=".repeat(50));
  log.info(`Total Firms Found: ${stats.totalFirmsFound}`);
  log.info(`Firms with Email: ${stats.firmsWithEmail}`);
  log.info(`Firms without Email: ${stats.firmsWithoutEmail}`);
  log.info(`Valid Emails: ${stats.validEmails}`);
  log.info(`Errors: ${stats.errors}`);
  log.info(`Duration: ${stats.duration}`);
  log.info("=".repeat(50) + "\n");
}
