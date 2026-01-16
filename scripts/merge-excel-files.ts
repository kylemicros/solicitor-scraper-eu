import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SolicitorData {
  firmName: string;
  address: string;
  website: string;
  email: string;
  legalIssue: string;
  scrapedAt: string;
}

interface MergeStats {
  totalFilesProcessed: number;
  totalRowsRead: number;
  duplicateLegalIssuesFixed: number;
  duplicateEntriesRemoved: number;
  addressBasedMerges: number;
  finalRowCount: number;
  emailSheetCount: number;
  invalidEmailsCleaned: number;
  filesProcessed: string[];
}

/**
 * Find all Excel files in the OneDrive folder
 */
async function findExcelFiles(baseDir: string): Promise<string[]> {
  const files: string[] = [];

  async function scanDirectory(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".xlsx") && !entry.name.startsWith("~$")) {
        files.push(fullPath);
      }
    }
  }

  await scanDirectory(baseDir);
  return files;
}

/**
 * Read all rows from an Excel file
 */
async function readExcelFile(filePath: string): Promise<SolicitorData[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  const data: SolicitorData[] = [];

  worksheet.eachRow((row, rowNumber) => {
    // Skip header row
    if (rowNumber === 1) return;

    const firmName = row.getCell(1).value?.toString().trim() || "";
    const address = row.getCell(2).value?.toString().trim() || "";
    const website = row.getCell(3).value?.toString().trim() || "";
    const email = row.getCell(4).value?.toString().trim() || "";
    const legalIssue = row.getCell(5).value?.toString().trim() || "";
    const scrapedAt = row.getCell(6).value?.toString().trim() || "";

    if (firmName) {
      data.push({
        firmName,
        address,
        website,
        email,
        legalIssue,
        scrapedAt,
      });
    }
  });

  return data;
}

/**
 * Remove duplicate legal issues from comma-separated string
 * Example: "Wills, trusts and probate, Wills, trusts and probate" -> "Wills, trusts and probate"
 */
function cleanDuplicateLegalIssues(legalIssue: string): string {
  if (!legalIssue) return "";

  const issues = legalIssue.split(",").map((s) => s.trim());
  const uniqueIssues = [...new Set(issues)];
  return uniqueIssues.join(", ");
}

/**
 * Normalize address for comparison
 */
function normalizeAddress(address: string): string {
  return address.toLowerCase().replace(/[,\.]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Normalize firm name for comparison
 */
function normalizeFirmName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bltd\b|\blimited\b|\bllp\b|\bllc\b|\bplc\b/gi, "")
    .replace(/[,\.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate and clean email address
 */
function cleanEmail(email: string): string {
  if (!email || email === "N/A" || email === "n/a") return "";

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "";

  return email.toLowerCase().trim();
}

/**
 * Clean website URL
 */
function cleanWebsite(website: string): string {
  if (!website || website === "N/A" || website === "n/a") return "";
  return website.trim();
}

/**
 * Merge legal issues from multiple entries
 */
function mergeLegalIssues(issues: string[]): string {
  const allIssues = issues
    .flatMap((issue) => issue.split(",").map((s) => s.trim()))
    .filter((issue) => issue && issue.length > 0);

  const uniqueIssues = [...new Set(allIssues)];
  return uniqueIssues.join(", ");
}

/**
 * Choose the best value from multiple options (non-empty, not N/A)
 */
function chooseBestValue(...values: string[]): string {
  for (const value of values) {
    if (value && value !== "N/A" && value !== "n/a" && value.trim().length > 0) {
      return value;
    }
  }
  return values[0] || "";
}

/**
 * Merge duplicate entries based on address
 */
function mergeByAddress(data: SolicitorData[], stats: MergeStats): SolicitorData[] {
  const addressMap = new Map<string, SolicitorData[]>();

  for (const entry of data) {
    if (!entry.address) continue;

    const normalizedAddr = normalizeAddress(entry.address);
    if (!addressMap.has(normalizedAddr)) {
      addressMap.set(normalizedAddr, []);
    }
    addressMap.get(normalizedAddr)!.push(entry);
  }

  const merged: SolicitorData[] = [];

  for (const [_, entries] of addressMap) {
    if (entries.length === 1) {
      merged.push(entries[0]);
    } else {
      stats.addressBasedMerges += entries.length - 1;

      const mergedEntry: SolicitorData = {
        firmName: chooseBestValue(...entries.map((e) => e.firmName)),
        address: chooseBestValue(...entries.map((e) => e.address)),
        website: chooseBestValue(...entries.map((e) => cleanWebsite(e.website))),
        email: chooseBestValue(...entries.map((e) => cleanEmail(e.email))),
        legalIssue: mergeLegalIssues(entries.map((e) => e.legalIssue)),
        scrapedAt: entries[entries.length - 1].scrapedAt, // Use most recent
      };

      merged.push(mergedEntry);
    }
  }

  return merged;
}

/**
 * Remove exact duplicates based on firm name + address
 */
function removeDuplicates(data: SolicitorData[], stats: MergeStats): SolicitorData[] {
  const seen = new Map<string, SolicitorData>();

  for (const entry of data) {
    const key = `${normalizeFirmName(entry.firmName)}|${normalizeAddress(entry.address)}`;

    if (!seen.has(key)) {
      seen.set(key, entry);
    } else {
      // Duplicate found. Merge goddamnit!
      stats.duplicateEntriesRemoved++;
      const existing = seen.get(key)!;
      existing.legalIssue = mergeLegalIssues([existing.legalIssue, entry.legalIssue]);

      existing.website = chooseBestValue(existing.website, cleanWebsite(entry.website));
      existing.email = chooseBestValue(existing.email, cleanEmail(entry.email));
    }
  }

  return Array.from(seen.values());
}

/**
 * Deduplicate by firm name + email (for email-only sheet)
 */
function deduplicateByEmail(data: SolicitorData[]): SolicitorData[] {
  const emailMap = new Map<string, SolicitorData>();

  for (const entry of data) {
    if (!entry.email || entry.email === "") continue;

    const key = `${normalizeFirmName(entry.firmName)}|${entry.email.toLowerCase()}`;

    if (!emailMap.has(key)) {
      emailMap.set(key, { ...entry });
    } else {
      const existing = emailMap.get(key)!;
      existing.legalIssue = mergeLegalIssues([existing.legalIssue, entry.legalIssue]);
      existing.website = chooseBestValue(existing.website, entry.website);
    }
  }

  return Array.from(emailMap.values());
}

/**
 * Write merged data to Excel file with two sheets
 */
async function writeExcelFile(data: SolicitorData[], outputPath: string): Promise<number> {
  const workbook = new ExcelJS.Workbook();

  // ==================== SHEET 1: Full Masterlist ====================
  const worksheet = workbook.addWorksheet("Solicitors Masterlist");

  worksheet.columns = [
    { header: "Firm Name", key: "firmName", width: 40 },
    { header: "Address", key: "address", width: 60 },
    { header: "Website", key: "website", width: 40 },
    { header: "Email", key: "email", width: 35 },
    { header: "Legal Issue", key: "legalIssue", width: 50 },
    { header: "Scraped At", key: "scrapedAt", width: 20 },
  ];

  // Style
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 12 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.font = { ...headerRow.font, color: { argb: "FFFFFFFF" } };

  for (const entry of data) {
    worksheet.addRow({
      firmName: entry.firmName,
      address: entry.address,
      website: entry.website || "",
      email: entry.email || "",
      legalIssue: entry.legalIssue,
      scrapedAt: entry.scrapedAt,
    });
  }

  // Filters
  worksheet.autoFilter = {
    from: "A1",
    to: `F${worksheet.rowCount}`,
  };

  // Freeze header row
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // ==================== SHEET 2: Email Only ====================
  const emailSheet = workbook.addWorksheet("With Email Addresses");

  // Get firms with emails and deduplicate by firm name + email
  const firmsWithEmail = data.filter((entry) => entry.email && entry.email !== "");
  const emailDeduped = deduplicateByEmail(firmsWithEmail);

  // Sort by firm name
  emailDeduped.sort((a, b) => a.firmName.localeCompare(b.firmName));

  emailSheet.columns = [
    { header: "Firm Name", key: "firmName", width: 40 },
    { header: "Website", key: "website", width: 40 },
    { header: "Email", key: "email", width: 35 },
    { header: "Legal Issue", key: "legalIssue", width: 50 },
  ];

  const emailHeaderRow = emailSheet.getRow(1);
  emailHeaderRow.font = { bold: true, size: 12 };
  emailHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF28A745" },
  };
  emailHeaderRow.font = { ...emailHeaderRow.font, color: { argb: "FFFFFFFF" } };

  for (const entry of emailDeduped) {
    emailSheet.addRow({
      firmName: entry.firmName,
      website: entry.website || "",
      email: entry.email,
      legalIssue: entry.legalIssue,
    });
  }

  // Filters
  emailSheet.autoFilter = {
    from: "A1",
    to: `D${emailSheet.rowCount}`,
  };

  // Freeze header row
  emailSheet.views = [{ state: "frozen", ySplit: 1 }];

  await workbook.xlsx.writeFile(outputPath);

  return emailDeduped.length;
}

/**
 * Generate statistics report
 */
function generateReport(stats: MergeStats): string {
  const emailPercentage = ((stats.emailSheetCount / stats.finalRowCount) * 100).toFixed(2);
  const report = `

              EXCEL MERGE & DEDUPLICATION REPORT


 PROCESSING SUMMARY:
   Files Processed: ${stats.totalFilesProcessed}
   Total Rows Read: ${stats.totalRowsRead.toLocaleString()}

 DATA CLEANING:
   Duplicate Legal Issues Fixed: ${stats.duplicateLegalIssuesFixed.toLocaleString()}
   Invalid Emails Cleaned: ${stats.invalidEmailsCleaned.toLocaleString()}

 DEDUPLICATION:
   Address-Based Merges: ${stats.addressBasedMerges.toLocaleString()}
   Duplicate Entries Removed: ${stats.duplicateEntriesRemoved.toLocaleString()}
   Total Duplicates Handled: ${(stats.addressBasedMerges + stats.duplicateEntriesRemoved).toLocaleString()}

 FINAL RESULTS:
   Sheet 1 - Full Masterlist: ${stats.finalRowCount.toLocaleString()} firms
   Sheet 2 - With Email Addresses: ${stats.emailSheetCount.toLocaleString()} firms (${emailPercentage}%)
   Overall Reduction: ${((1 - stats.finalRowCount / stats.totalRowsRead) * 100).toFixed(2)}%

 FILES PROCESSED:
${stats.filesProcessed.map((f, i) => `   ${i + 1}. ${path.basename(f)}`).join("\n")}


`;

  return report;
}

/**
 * Main merge function
 */
async function mergeExcelFiles() {
  console.log(" Starting Excel Merge & Deduplication Process...\n");

  const projectRoot = path.resolve(__dirname, "..");
  const sourceDir = path.join(projectRoot, "OneDrive_1_1-6-2026");
  const outputDir = path.join(projectRoot, "Masterlist Excel");

  await fs.mkdir(outputDir, { recursive: true });
  console.log(` Created output directory: ${outputDir}\n`);

  const stats: MergeStats = {
    totalFilesProcessed: 0,
    totalRowsRead: 0,
    duplicateLegalIssuesFixed: 0,
    duplicateEntriesRemoved: 0,
    addressBasedMerges: 0,
    finalRowCount: 0,
    emailSheetCount: 0,
    invalidEmailsCleaned: 0,
    filesProcessed: [],
  };

  console.log(" Scanning for Excel files...");
  const excelFiles = await findExcelFiles(sourceDir);
  console.log(`   Found ${excelFiles.length} Excel files\n`);

  console.log(" Reading Excel files...");
  let allData: SolicitorData[] = [];

  for (const filePath of excelFiles) {
    console.log(`   Reading: ${path.basename(filePath)}`);
    const data = await readExcelFile(filePath);
    allData.push(...data);
    stats.totalFilesProcessed++;
    stats.totalRowsRead += data.length;
    stats.filesProcessed.push(filePath);
  }

  console.log(`    Read ${stats.totalRowsRead.toLocaleString()} total rows\n`);

  // Clean duplicate legal issues
  console.log(" Cleaning duplicate legal issues...");
  for (const entry of allData) {
    const original = entry.legalIssue;
    entry.legalIssue = cleanDuplicateLegalIssues(entry.legalIssue);
    if (original !== entry.legalIssue) {
      stats.duplicateLegalIssuesFixed++;
    }
  }
  console.log(`    Fixed ${stats.duplicateLegalIssuesFixed.toLocaleString()} duplicate legal issues\n`);

  console.log(" Cleaning emails and websites...");
  for (const entry of allData) {
    const originalEmail = entry.email;
    entry.email = cleanEmail(entry.email);
    if (originalEmail && !entry.email) {
      stats.invalidEmailsCleaned++;
    }
    entry.website = cleanWebsite(entry.website);
  }
  console.log(`    Cleaned ${stats.invalidEmailsCleaned.toLocaleString()} invalid emails\n`);

  console.log(" Merging entries with same address...");
  allData = mergeByAddress(allData, stats);
  console.log(`    Merged ${stats.addressBasedMerges.toLocaleString()} entries\n`);

  console.log(" Removing duplicate entries...");
  allData = removeDuplicates(allData, stats);
  console.log(`    Removed ${stats.duplicateEntriesRemoved.toLocaleString()} duplicates\n`);

  allData.sort((a, b) => a.firmName.localeCompare(b.firmName));

  stats.finalRowCount = allData.length;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  const outputFileName = `Solicitors_Masterlist_${timestamp}.xlsx`;
  const outputPath = path.join(outputDir, outputFileName);

  console.log(" Writing master Excel file with 2 sheets...");
  console.log("   Sheet 1: Full masterlist");
  console.log("   Sheet 2: Firms with email addresses");
  stats.emailSheetCount = await writeExcelFile(allData, outputPath);
  console.log(`    Sheet 1: ${allData.length.toLocaleString()} firms`);
  console.log(`    Sheet 2: ${stats.emailSheetCount.toLocaleString()} firms with emails`);
  console.log(`    Saved: ${outputFileName}\n`);

  const report = generateReport(stats);
  console.log(report);

  const reportPath = path.join(outputDir, `Merge_Report_${timestamp}.txt`);
  await fs.writeFile(reportPath, report);
  console.log(` Report saved to: Merge_Report_${timestamp}.txt`);

  console.log("\n Process completed successfully!");
}

mergeExcelFiles().catch((error) => {
  console.error(" Error during merge process:", error);
  process.exit(1);
});
