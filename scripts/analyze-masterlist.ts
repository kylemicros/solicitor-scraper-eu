import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analyzes the latest masterlist and outputs statistics to the console.
 */
async function analyzeMasterlist() {
  console.log(" Analyzing Masterlist Excel File...\n");

  const projectRoot = path.resolve(__dirname, "..");
  const masterlistDir = path.join(projectRoot, "Masterlist Excel");

  const files = await fs.readdir(masterlistDir);
  const masterlistFiles = files.filter((f) => f.startsWith("Solicitors_Masterlist_") && f.endsWith(".xlsx"));

  if (masterlistFiles.length === 0) {
    console.error(" No masterlist file found!");
    process.exit(1);
  }

  const latestFile = masterlistFiles.sort().reverse()[0];
  const filePath = path.join(masterlistDir, latestFile);

  console.log(` Analyzing: ${latestFile}\n`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];

  const stats = {
    totalFirms: worksheet.rowCount - 1,
    withEmail: 0,
    withWebsite: 0,
    withMultipleLegalIssues: 0,
    byLegalIssue: new Map<string, number>(),
    byRegion: new Map<string, number>(),
    topFirms: [] as Array<{ name: string; issueCount: number; issues: string[] }>,
  };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const email = row.getCell(4).value?.toString().trim();
    const website = row.getCell(3).value?.toString().trim();
    const legalIssues = row.getCell(5).value?.toString().trim() || "";
    const address = row.getCell(2).value?.toString().trim() || "";
    const firmName = row.getCell(1).value?.toString().trim() || "";

    if (email && email !== "" && email !== "N/A") {
      stats.withEmail++;
    }

    if (website && website !== "" && website !== "N/A") {
      stats.withWebsite++;
    }

    const issues = legalIssues
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);

    if (issues.length > 1) {
      stats.withMultipleLegalIssues++;
      stats.topFirms.push({
        name: firmName,
        issueCount: issues.length,
        issues,
      });
    }

    for (const issue of issues) {
      stats.byLegalIssue.set(issue, (stats.byLegalIssue.get(issue) || 0) + 1);
    }

    const addressLower = address.toLowerCase();
    let region = "Other";

    if (addressLower.includes("london")) region = "London";
    else if (addressLower.includes("manchester")) region = "Manchester";
    else if (addressLower.includes("birmingham")) region = "Birmingham";
    else if (addressLower.includes("leeds")) region = "Leeds";
    else if (addressLower.includes("liverpool")) region = "Liverpool";
    else if (addressLower.includes("bristol")) region = "Bristol";
    else if (addressLower.includes("sheffield")) region = "Sheffield";

    stats.byRegion.set(region, (stats.byRegion.get(region) || 0) + 1);
  });

  stats.topFirms.sort((a, b) => b.issueCount - a.issueCount);

  console.log("");
  console.log("                    MASTERLIST ANALYSIS");
  console.log("\n");

  console.log(" OVERVIEW:");
  console.log(`   Total Firms: ${stats.totalFirms.toLocaleString()}`);
  console.log(
    `   Firms with Email: ${stats.withEmail.toLocaleString()} (${((stats.withEmail / stats.totalFirms) * 100).toFixed(2)}%)`
  );
  console.log(
    `   Firms with Website: ${stats.withWebsite.toLocaleString()} (${((stats.withWebsite / stats.totalFirms) * 100).toFixed(2)}%)`
  );
  console.log(
    `   Firms with Multiple Legal Issues: ${stats.withMultipleLegalIssues.toLocaleString()} (${((stats.withMultipleLegalIssues / stats.totalFirms) * 100).toFixed(2)}%)\n`
  );

  console.log("  LEGAL ISSUES BREAKDOWN:");
  const sortedIssues = Array.from(stats.byLegalIssue.entries()).sort((a, b) => b[1] - a[1]);

  for (const [issue, count] of sortedIssues) {
    const percentage = ((count / stats.totalFirms) * 100).toFixed(2);
    console.log(`   ${issue.padEnd(40)} ${count.toString().padStart(5)} (${percentage}%)`);
  }

  console.log("\n REGIONAL DISTRIBUTION:");
  const sortedRegions = Array.from(stats.byRegion.entries()).sort((a, b) => b[1] - a[1]);

  for (const [region, count] of sortedRegions) {
    const percentage = ((count / stats.totalFirms) * 100).toFixed(2);
    console.log(`   ${region.padEnd(20)} ${count.toString().padStart(5)} (${percentage}%)`);
  }

  console.log("\n TOP 10 FIRMS WITH MOST LEGAL ISSUES:");
  for (let i = 0; i < Math.min(10, stats.topFirms.length); i++) {
    const firm = stats.topFirms[i];
    console.log(`\n   ${i + 1}. ${firm.name}`);
    console.log(`      Issues (${firm.issueCount}): ${firm.issues.join(", ")}`);
  }

  console.log("\n");
  console.log(" Analysis complete!");
  console.log("\n");
}

analyzeMasterlist().catch((error) => {
  console.error(" Error during analysis:", error);
  process.exit(1);
});
