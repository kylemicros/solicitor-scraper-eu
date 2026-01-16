import ExcelJS, { Column as ExcelColumn, type Workbook, Worksheet } from "exceljs";
import { promises as fs } from "fs";

export function createWorkbook(creator?: string): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  if (creator) {
    workbook.creator = creator;
  }

  workbook.created = new Date();
  return workbook;
}

export function createColumnHeaders(worksheet: Worksheet, headers: Partial<ExcelColumn>[]): void {
  worksheet.columns = headers.map((header) => ({
    header: header.header,
    key: header.key,
    width: header.width || 20,
  }));
}

export function createWorksheet(workbook: Workbook, sheetName: string, headers: Partial<ExcelColumn>[]): Worksheet {
  const worksheet = workbook.addWorksheet(sheetName);
  createColumnHeaders(worksheet, headers);
  return worksheet;
}

export async function writeWorkbookToBuffer(workbook: Workbook): Promise<Buffer> {
  const result = await workbook.xlsx.writeBuffer();

  if (Buffer.isBuffer(result)) {
    return result;
  }

  // Convert ArrayBuffer / Uint8Array to Node Buffer safely.
  return Buffer.from(result as ArrayBuffer);
}

export async function writeWorkbookToFile(workbook: Workbook, filePath: string): Promise<void> {
  await workbook.xlsx.writeFile(filePath);
}

/**
 * Writes workbook to file AND returns the buffer for upload
 * This prevents race conditions between write and read
 */
export async function writeWorkbookToFileAndBuffer(workbook: Workbook, filePath: string): Promise<Buffer> {
  // First write to buffer
  const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);

  // Then write that buffer to file
  await fs.writeFile(filePath, buffer);

  // Return the same buffer for upload
  return buffer;
}
