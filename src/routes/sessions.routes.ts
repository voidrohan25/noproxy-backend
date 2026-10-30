import { Router, Response } from 'express';
import { db } from '../lib/db/mock-db';
import { AuthenticatedRequest, requireAuth, requireTrainer } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

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
