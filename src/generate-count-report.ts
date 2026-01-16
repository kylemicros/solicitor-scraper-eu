import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";

import { env } from "@config/env.js";

const WEBSITE_REPORTED_TOTALS: Record<string, number> = {
  "Accidents and Injury": 6644,
  "Family and relationships": 10066,
  "Mental Capacity": 969,
  "Social welfare, health and benefits": 5150,
  "Wills, trusts and probate": 8064,
};

/**
 * Generate Excel report with Legal Issue and Total Count, including coverage analysis
 */
export async function generateCountReport(legalIssueCounts: Map<string, number>): Promise<string> {
  const outputDir = path.join(process.cwd(), "data", "output");
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, "Solicitor_Total_Count.xlsx");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = env.COMPANY_NAME;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Solicitor Counts");

  worksheet.columns = [
    { header: "Legal Issue", key: "legalIssue", width: 40 },
    { header: "Total Count", key: "totalCount", width: 15 },
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  for (const [legalIssue, count] of legalIssueCounts.entries()) {
    worksheet.addRow({
      legalIssue: legalIssue,
      totalCount: count,
    });
  }

  const totalSolicitors = Array.from(legalIssueCounts.values()).reduce((sum, count) => sum + count, 0);
  const totalRow = worksheet.addRow({
    legalIssue: "TOTAL",
    totalCount: totalSolicitors,
  });
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFEB9C" },
  };

  const coverageSheet = workbook.addWorksheet("Coverage Analysis");

  coverageSheet.columns = [
    { header: "Legal Issue", key: "legalIssue", width: 40 },
    { header: "Scraped Count", key: "scrapedCount", width: 15 },
    { header: "Website Total", key: "websiteTotal", width: 15 },
    { header: "Coverage %", key: "coverage", width: 15 },
    { header: "Missing", key: "missing", width: 15 },
  ];

  coverageSheet.getRow(1).font = { bold: true };
  coverageSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  coverageSheet.getRow(1).font.color = { argb: "FFFFFFFF" };

  let totalScraped = 0;
  let totalWebsite = 0;

  for (const [legalIssue, scrapedCount] of legalIssueCounts.entries()) {
    const websiteTotal = WEBSITE_REPORTED_TOTALS[legalIssue] || 0;
    const coverage = websiteTotal > 0 ? (scrapedCount / websiteTotal) * 100 : 0;
    const missing = websiteTotal - scrapedCount;

    totalScraped += scrapedCount;
    totalWebsite += websiteTotal;

    const row = coverageSheet.addRow({
      legalIssue: legalIssue,
      scrapedCount: scrapedCount,
      websiteTotal: websiteTotal,
      coverage: coverage,
      missing: missing > 0 ? missing : 0,
    });

    row.getCell(4).numFmt = '0.00"%"';

    if (coverage >= 80) {
      row.getCell(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF92D050" },
      };
    } else if (coverage >= 60) {
      row.getCell(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFC000" },
      };
    } else {
      row.getCell(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0000" },
      };
    }
  }

  const overallCoverage = totalWebsite > 0 ? (totalScraped / totalWebsite) * 100 : 0;
  const coverageTotalRow = coverageSheet.addRow({
    legalIssue: "OVERALL TOTAL",
    scrapedCount: totalScraped,
    websiteTotal: totalWebsite,
    coverage: overallCoverage,
    missing: totalWebsite - totalScraped,
  });

  coverageTotalRow.font = { bold: true, size: 12 };
  coverageTotalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFEB9C" },
  };
  coverageTotalRow.getCell(4).numFmt = '0.00"%"';

  coverageSheet.addRow([]);
  const noteRow = coverageSheet.addRow(["Note: Coverage % = (Scraped Count / Website Total)  100"]);
  noteRow.font = { italic: true, color: { argb: "FF808080" } };

  await workbook.xlsx.writeFile(filePath);

  return filePath;
}
