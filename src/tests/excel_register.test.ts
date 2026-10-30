// ==============================================================================
// TEST SUITE: GENUINE EXCEL ATTENDANCE REGISTER GENERATION
// ==============================================================================

import ExcelJS from 'exceljs';
import { db } from '../lib/db/mock-db';
import { generateBatchAttendanceExcel } from '../lib/excel/generator';

export async function runExcelRegisterTests() {
  console.log('\n--- 4. Testing Excel Attendance Register (.xlsx) Generation ---');

  const batchId = '77777777-7777-7777-7777-777777777771';
  const exportData = db.getBatchExportData(batchId);

  if (!exportData) {
    throw new Error('Export test failed: Batch data could not be retrieved.');
  }

  // 1. Generate Excel workbook buffer
  const buffer = await generateBatchAttendanceExcel(exportData);

  // Validate that buffer exists and has content
  if (!buffer || buffer.length === 0) {
    throw new Error('Export test failed: Generated buffer is empty.');
  }

  // Validate standard ZIP / OpenXML header (Magic bytes: PK\x03\x04)
  const isZipXlsx =
    buffer[0] === 0x50 && // P
    buffer[1] === 0x4b && // K
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (isZipXlsx) {
    console.log(`  [PASS] Genuine .xlsx binary workbook generated (${buffer.length} bytes, valid PK magic bytes).`);
  } else {
    throw new Error('Export test failed: Output is not a valid OpenXML .xlsx file.');
  }

  // 2. Programmatically parse the generated workbook to verify cell values
  const loadedWorkbook = new ExcelJS.Workbook();
  await loadedWorkbook.xlsx.load(buffer as unknown as Buffer);
  const worksheet = loadedWorkbook.getWorksheet('Attendance Register');
  if (!worksheet) {
    throw new Error('Export test failed: Worksheet "Attendance Register" missing.');
  }

  console.log(`  [PASS] Programmatically loaded and validated worksheet structure with ${worksheet.rowCount} rows.`);

  // 3. Test Formula Injection Sanitization (=cmd|' /C calc'!A0, @hack, +calc)
  const testDataWithFormulaInjection = {
    ...exportData,
    students: [
      {
        rollNumber: '=1+1',
        student: {
          id: 'test-injection-1',
          displayName: '=SUM(A1:A10)',
          email: '@malicious.edu',
          role: 'STUDENT' as const,
          institutionId: 'inst-1',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ],
  };

  const injectionBuffer = await generateBatchAttendanceExcel(testDataWithFormulaInjection);
  const injectionWorkbook = new ExcelJS.Workbook();
  await injectionWorkbook.xlsx.load(injectionBuffer as unknown as Buffer);
  const injectionSheet = injectionWorkbook.getWorksheet('Attendance Register');
  const dataRow = injectionSheet?.getRow(5); // first student data row
  const nameCell = dataRow?.getCell(2).value?.toString();
  const emailCell = dataRow?.getCell(3).value?.toString();

  if (nameCell?.startsWith("'=") && emailCell?.startsWith("'@")) {
    console.log('  [PASS] Spreadsheet formula injection successfully neutralized (escaped with single quote).');
  } else {
    throw new Error(`Formula injection check failed: nameCell was "${nameCell}"`);
  }

  // 4. Test Zero Sessions Handling (Ensure N/A instead of division by zero)
  const testDataZeroSessions = {
    ...exportData,
    sessions: [],
    attendanceRecords: [],
  };

  const zeroSessionBuffer = await generateBatchAttendanceExcel(testDataZeroSessions);
  const zeroSessionWorkbook = new ExcelJS.Workbook();
  await zeroSessionWorkbook.xlsx.load(zeroSessionBuffer as unknown as Buffer);
  const zeroSheet = zeroSessionWorkbook.getWorksheet('Attendance Register');
  const firstStudentRow = zeroSheet?.getRow(5);
  // Last column is Attendance %
  const pctCellVal = firstStudentRow?.getCell(firstStudentRow.cellCount).value;
  if (pctCellVal === 'N/A') {
    console.log('  [PASS] Zero sessions handled safely without division-by-zero (outputs N/A).');
  } else {
    throw new Error(`Zero session percentage expected "N/A", got: ${pctCellVal}`);
  }

  console.log(`  [PASS] Export verified for ${exportData.students.length} students across ${exportData.sessions.length} sessions.`);
  return true;
}

