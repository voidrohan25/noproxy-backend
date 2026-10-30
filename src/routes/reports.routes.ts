import { Router, Response } from 'express';
import { db } from '../lib/db/mock-db';
import { generateBatchAttendanceExcel } from '../lib/excel/generator';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /api/reports/excel?batchId=...
router.get('/excel', async (req: AuthenticatedRequest, res: Response) => {
  const batchId = req.query.batchId as string;

  if (!batchId) {
    return res.status(400).json({ error: 'batchId query parameter is required.' });
  }

  const exportData = db.getBatchExportData(batchId);
  if (!exportData) {
    return res.status(404).json({ error: 'Batch not found or no attendance data available.' });
  }

  try {
    const buffer = await generateBatchAttendanceExcel(exportData);
    const filename = `NoProxy_Attendance_${exportData.batchCode}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());

    return res.send(buffer);
  } catch (err: any) {
    console.error('Excel generation error:', err);
    return res.status(500).json({ error: 'Failed to generate Excel register workbook.' });
  }
});

export default router;
