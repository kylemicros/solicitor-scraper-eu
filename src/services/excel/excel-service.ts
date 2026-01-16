import type { Workbook } from "exceljs";

import { env } from "@config/env.js";

import type { SolicitorFirm } from "@scrapers/types.js";

import { createWorkbook, createWorksheet } from "@util/excel.js";
import { log } from "@util/logger.js";

import type { SolicitorExcelRow } from "./types.js";

/**
 * Excel column headers for solicitor data
 */
const SOLICITOR_COLUMNS: Partial<{ header: string; key: string; width: number }>[] = [
  { header: "Firm Name", key: "firmName", width: 40 },
  { header: "Address", key: "address", width: 50 },
  { header: "Website", key: "website", width: 40 },
  { header: "Email", key: "email", width: 35 },
  // { header: "Telephone", key: "telephone", width: 20 },
  { header: "Legal Issue", key: "legalIssue", width: 30 },
  // { header: "Location", key: "location", width: 25 },
  // { header: "Source URL", key: "sourceUrl", width: 50 },
  { header: "Scraped At", key: "scrapedAt", width: 25 },
];

/**
 * Pastel red fill for missing data cells
 */
const MISSING_DATA_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFFFCCCC" },
};

/**
 * Converts a SolicitorFirm to an Excel row format
 *
 * @param firm - The solicitor firm data
 * @returns Excel row data
 */
function firmToExcelRow(firm: SolicitorFirm): SolicitorExcelRow {
  return {
    firmName: firm.firmName,
    address: firm.address,
    website: firm.website || "N/A",
    email: firm.email || "N/A",
    // telephone: firm.telephone || "N/A",
    legalIssue: firm.legalIssue,
    // location: firm.location,
    // sourceUrl: firm.sourceUrl,
    scrapedAt: firm.scrapedAt,
  };
}

/**
 * Applies pastel red fill to cells with missing data (N/A)
 *
 * @param worksheet - The worksheet to style
 * @param rowNumber - The row number to check and style
 */
function applyCellStyling(worksheet: any, rowNumber: number): void {
  const row = worksheet.getRow(rowNumber);
  const missingColumns = ["address", "website", "email", "telephone"];

  missingColumns.forEach((colKey) => {
    const column = SOLICITOR_COLUMNS.find((col) => col.key === colKey);
    if (column) {
      const colIndex = SOLICITOR_COLUMNS.indexOf(column) + 1;
      const cell = row.getCell(colIndex);

      if (cell.value === "N/A") {
        cell.fill = MISSING_DATA_FILL;
      }
    }
  });
}

/**
 * Creates an Excel workbook with solicitor data
 *
 * @param firms - Array of solicitor firms
 * @param sheetName - Name of the worksheet
 * @returns ExcelJS Workbook instance
 */
export function createSolicitorWorkbook(firms: SolicitorFirm[], sheetName: string = "Solicitors"): Workbook {
  const workbook = createWorkbook(env.COMPANY_NAME);
  const worksheet = createWorksheet(workbook, sheetName, SOLICITOR_COLUMNS);

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  const rows = firms.map(firmToExcelRow);
  rows.forEach((rowData, index) => {
    worksheet.addRow(rowData);
    applyCellStyling(worksheet, index + 2);
  });

  log.info(`Created Excel workbook with ${firms.length} solicitor records`);

  return workbook;
}

/**
 * Initializes an Excel workbook for streaming (live updates)
 *
 * @param sheetName - Name of the worksheet
 * @returns Initialized workbook and worksheet
 */
export function initializeStreamingWorkbook(sheetName: string = "Solicitors"): { workbook: Workbook; worksheet: any } {
  const workbook = createWorkbook(env.COMPANY_NAME);
  const worksheet = createWorksheet(workbook, sheetName, SOLICITOR_COLUMNS);

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  log.info("Initialized streaming Excel workbook");

  return { workbook, worksheet };
}

/**
 * Adds a single firm to the worksheet (for streaming)
 *
 * @param worksheet - The worksheet to add to
 * @param firm - The firm data to add
 */
export function addFirmToWorksheet(worksheet: any, firm: SolicitorFirm): void {
  const rowData = firmToExcelRow(firm);
  const row = worksheet.addRow(rowData);
  applyCellStyling(worksheet, row.number);
}
