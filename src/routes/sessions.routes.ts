import { Router, Response } from 'express';
import { db } from '../lib/db/mock-db';
import { AuthenticatedRequest, requireAuth, requireTrainer } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// POST /api/sessions/start
router.post('/start', requireTrainer, (req: AuthenticatedRequest, res: Response) => {
  const { batchId, title } = req.body;
  if (!batchId) {
    return res.status(400).json({ error: 'batchId is required.' });
  }

  // Verify trainer assignment
  if (req.userRole === 'TRAINER') {
    const isAssigned = Array.from(db.trainerAssignments.values()).some(
      (a) => a.trainerId === req.userId && a.batchId === batchId && a.status === 'ACTIVE'
    );
    if (!isAssigned) {
      return res.status(403).json({ error: 'You are not assigned to this batch.' });
    }
  }

  const result = db.startBatchAttendanceSession({
    batchId,
    trainerId: req.userId!,
    title,
  });

  if (!result.success || !result.session) {
    return res.status(400).json({ error: result.error || 'Failed to start session' });
  }

  return res.json({
    success: true,
    session: result.session,
    message: 'Active attendance session started. Dynamic QR code is ready for scanning.',
  });
});

// POST /api/sessions/stop
router.post('/stop', requireTrainer, (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required.' });
  }

  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  const result = db.finalizeSession(sessionId, req.userId!);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({
    success: true,
    message: `Attendance stopped. ${result.finalizedCount} students processed (${result.absentCount} marked ABSENT). Session is now finalized and locked.`,
    finalizedCount: result.finalizedCount,
    absentCount: result.absentCount,
  });
});

// GET /api/sessions/:id/status
router.get('/:id/status', (req: AuthenticatedRequest, res: Response) => {
  const sessionId = String(req.params.id);
  const liveStatus = db.getSessionLiveStatus(sessionId);
  if (!liveStatus) {
    return res.status(404).json({ error: 'Session not found.' });
  }
  return res.json({ success: true, ...liveStatus });
});

// POST /api/sessions/:id/finalize
router.post('/:id/finalize', requireTrainer, (req: AuthenticatedRequest, res: Response) => {
  const sessionId = String(req.params.id);

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  const result = db.finalizeSession(sessionId, req.userId!);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({
    success: true,
    message: `Session finalized. ${result.absentCount} unrecorded students automatically marked ABSENT.`,
    finalizedCount: result.finalizedCount,
    absentCount: result.absentCount,
  });
});

export default router;
