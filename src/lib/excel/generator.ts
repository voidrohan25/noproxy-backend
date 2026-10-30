// ==============================================================================
// NOPROXY EXCEL ATTENDANCE REGISTER GENERATOR
// Genuine .xlsx Generation using ExcelJS
// Strict 3-Status Matrix (PRESENT, ONLINE, ABSENT) - No Late/Grace Columns
// ==============================================================================

import ExcelJS from 'exceljs';
import { Session, AttendanceRecord, Profile } from '../db/types';

export interface BatchStudentRow {
  student: Profile;
  rollNumber: string;
}

export interface ExcelExportData {
  institutionName: string;
  batchName: string;
  batchCode: string;
  courseName: string;
  students: BatchStudentRow[];
  sessions: Session[];
  attendanceRecords: AttendanceRecord[];
}

export async function generateBatchAttendanceExcel(data: ExcelExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NoProxy Attendance SaaS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Attendance Register', {
    views: [
      {
        state: 'frozen',
        xSplit: 3, // Freeze Roll No, Name, Student ID
        ySplit: 5, // Freeze Title and Header rows
      },
    ],
  });

  // Sort sessions chronologically
  const sortedSessions = [...data.sessions].sort(
    (a, b) => new Date(`${a.sessionDate}T${a.startTime}`).getTime() - new Date(`${b.sessionDate}T${b.startTime}`).getTime()
  );

  // Map attendance by sessionId:studentId
  const attendanceMap = new Map<string, string>();
  for (const record of data.attendanceRecords) {
    attendanceMap.set(`${record.sessionId}:${record.studentId}`, record.status);
  }

  // 1. Institution & Batch Title Banner
  worksheet.mergeCells('A1', 'H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `${data.institutionName.toUpperCase()} — ATTENDANCE REGISTER`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E1B4B' }, // Brand indigo-950
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 36;

  // 2. Batch Metadata Row
  worksheet.mergeCells('A2', 'H2');
  const metaCell = worksheet.getCell('A2');
  metaCell.value = `Batch: ${data.batchName} (${data.batchCode})  |  Course: ${data.courseName}  |  Total Finalized Sessions: ${sortedSessions.length}  |  Generated: ${new Date().toLocaleDateString('en-GB')}`;
  metaCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF312E81' } };
  metaCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEEF2FF' }, // Brand indigo-50
  };
  metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  worksheet.getRow(2).height = 24;

  // Row 3: Blank separator
  worksheet.getRow(3).height = 10;

  // 3. Build Column Headers (Row 4 & 5)
  // Base fixed columns:
  // Col 1: Roll No.
  // Col 2: Student Name
  // Col 3: Student ID / Email
  // Dynamic Col 4 .. (3 + N): Session dates
  // Summary Cols: Present, Online, Absent, Total Finalized, Attendance %

  const headers = [
    'Roll No.',
    'Student Name',
    'Student ID',
  ];

  // Dynamic session columns
  sortedSessions.forEach((sess, idx) => {
    // Format: "12 Oct (Off)" or "14 Oct (On)"
    const dateObj = new Date(sess.sessionDate);
    const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const modeTag = sess.mode === 'ONLINE' ? 'Online' : 'Offline';
    headers.push(`${dateStr}\n#${idx + 1} (${modeTag})`);
  });

  // Summary headers (Strictly 3 statuses)
  headers.push('Present', 'Online', 'Absent', 'Total Finalized', 'Attendance %');

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 34;

  // Format header row
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF1E1B4B' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };

    if (colNumber <= 3) {
      // Identification columns
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3730A3' } }; // Indigo-800
    } else if (colNumber <= 3 + sortedSessions.length) {
      // Session columns
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600
    } else {
      // Summary columns
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate-800
    }
  });

  // Helper to sanitize formula injection characters (=, +, -, @, \t, \r)
  const sanitizeCell = (val: string | undefined | null): string => {
    if (!val) return '';
    const trimmed = String(val).trim();
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      return `'${trimmed}`; // Prepend single quote to force Excel to treat as plain string literal
    }
    return trimmed;
  };

  // 4. Populate Student Attendance Rows
  const totalSessionsCount = sortedSessions.length;

  if (data.students.length === 0) {
    const emptyRow = worksheet.addRow(['—', 'No students enrolled in this batch', '—', ...Array(sortedSessions.length + 5).fill('—')]);
    emptyRow.height = 24;
    emptyRow.getCell(2).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  } else {
    data.students.forEach((item, studentIndex) => {
      const rowValues: (string | number)[] = [
        sanitizeCell(item.rollNumber || (studentIndex + 1).toString()),
        sanitizeCell(item.student.displayName),
        sanitizeCell(item.student.email),
      ];

      let studentPresentCount = 0;
      let studentOnlineCount = 0;
      let studentAbsentCount = 0;

      // Fill attendance for each session
      sortedSessions.forEach((sess) => {
        const status = attendanceMap.get(`${sess.id}:${item.student.id}`);
        if (status === 'PRESENT') {
          rowValues.push('Present');
          studentPresentCount++;
        } else if (status === 'ONLINE') {
          rowValues.push('Online');
          studentOnlineCount++;
        } else {
          rowValues.push('Absent');
          studentAbsentCount++;
        }
      });

      // Summary calculations: Attendance % = (Present + Online) / Total eligible finalized sessions * 100
      const attendedSessions = studentPresentCount + studentOnlineCount;
      const percentageValue: string | number = totalSessionsCount > 0 
        ? (attendedSessions / totalSessionsCount) 
        : 'N/A';

      rowValues.push(studentPresentCount, studentOnlineCount, studentAbsentCount, totalSessionsCount, percentageValue);

      const dataRow = worksheet.addRow(rowValues);
      dataRow.height = 22;

      const isEven = studentIndex % 2 === 0;
      const baseBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      // Style data cells
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        } else if (colNumber === 2 || colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        } else if (colNumber <= 3 + sortedSessions.length) {
          // Attendance status column
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          const val = cell.value?.toString();
          if (val === 'Present') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } }; // Soft green
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF137333' } };
          } else if (val === 'Online') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } }; // Soft blue
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1A73E8' } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8E6' } }; // Soft red
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FFC5221F' } };
          }
        } else if (colNumber === headers.length) {
          // Attendance Percentage column
          if (typeof cell.value === 'number') {
            cell.numFmt = '0.00%';
          }
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.font = { name: 'Calibri', size: 10, bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        } else {
          // Summary count columns
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Calibri', size: 10, bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        }
      });
    });
  }

  // 5. Adjust Column Widths
  worksheet.getColumn(1).width = 12; // Roll No.
  worksheet.getColumn(2).width = 24; // Name
  worksheet.getColumn(3).width = 28; // ID / Email

  for (let i = 4; i <= 3 + sortedSessions.length; i++) {
    worksheet.getColumn(i).width = 15; // Dynamic sessions
  }

  // Summary column widths
  worksheet.getColumn(headers.length - 4).width = 12; // Present
  worksheet.getColumn(headers.length - 3).width = 12; // Online
  worksheet.getColumn(headers.length - 2).width = 12; // Absent
  worksheet.getColumn(headers.length - 1).width = 16; // Total Finalized
  worksheet.getColumn(headers.length).width = 16;     // Attendance %

  // Generate buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
