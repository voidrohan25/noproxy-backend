import { Router, Response } from 'express';
import { db } from '../lib/db/mock-db';
import { AuthenticatedRequest, requireAuth, requireTrainer } from '../middleware/auth';

const router = Router();

// Apply requireAuth
router.use(requireAuth);

// POST /api/attendance/submit (Student dynamic QR submission)
router.post('/submit', (req: AuthenticatedRequest, res: Response) => {
  const { sessionId, rawToken, studentCoords, deviceCredentialId, localAuthConfirmed } = req.body || {};

  if (!sessionId || !rawToken) {
    return res.status(400).json({ error: 'sessionId and rawToken are required.' });
  }

  // Derive authenticated user ID strictly from server session, NOT client body
  const authenticatedUserId = req.userId!;

  const result = db.submitOfflineAttendance({
    authenticatedUserId,
    sessionId,
    rawToken,
    studentCoords,
    deviceCredentialId,
    localAuthConfirmed: !!localAuthConfirmed,
    ipAddress: req.ip,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error, checks: result.checks });
  }

  return res.json({
    success: true,
    message: 'Attendance verified and recorded as PRESENT.',
    record: result.record,
    checks: result.checks,
  });
});

// POST /api/attendance/mark-online (Trainer marks virtual attendee)
router.post('/mark-online', requireTrainer, (req: AuthenticatedRequest, res: Response) => {
  const { sessionId, studentId, notes } = req.body || {};

  if (!sessionId || !studentId) {
    return res.status(400).json({ error: 'sessionId and studentId are required.' });
  }

  const result = db.markParticipantOnline(sessionId, studentId, req.userId!);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({
    success: true,
    message: 'Attendance recorded as ONLINE.',
    record: result.record,
  });
});

// POST /api/attendance/correct (Audited correction by Admin or Trainer)
router.post('/correct', (req: AuthenticatedRequest, res: Response) => {
  const { sessionId, studentId, newStatus, reason } = req.body || {};

  if (!sessionId || !studentId || !newStatus || !reason) {
    return res.status(400).json({ error: 'sessionId, studentId, newStatus, and mandatory audit reason are required.' });
  }

  // Strictly enforce 3 statuses
  if (newStatus !== 'PRESENT' && newStatus !== 'ONLINE' && newStatus !== 'ABSENT') {
    return res.status(400).json({ error: `Invalid attendance status "${newStatus}". Strictly permitted statuses: PRESENT, ONLINE, ABSENT.` });
  }

  const result = db.correctAttendance({
    sessionId,
    studentId,
    newStatus,
    reason,
    actorId: req.userId!,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({
    success: true,
    message: `Attendance corrected to ${newStatus} with audit record.`,
    record: result.record,
  });
});

export default router;
