import { Router, Response } from 'express';
import { db } from '../lib/db/mock-db';
import { AuthenticatedRequest, requireAuth, requireTrainer } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.use(requireTrainer);

// GET /api/trainer/batches
router.get('/batches', (req: AuthenticatedRequest, res: Response) => {
  const institutionId = req.sessionData?.institution?.id || '11111111-1111-1111-1111-111111111111';

  let assignedBatchIds: string[] = [];
  if (req.userRole === 'ADMIN') {
    assignedBatchIds = Array.from(db.batches.keys());
  } else {
    assignedBatchIds = Array.from(db.trainerAssignments.values())
      .filter((a) => a.trainerId === req.userId && a.status === 'ACTIVE')
      .map((a) => a.batchId);
  }

  const allBatches = db.listBatches(institutionId);
  const batches = allBatches
    .filter((b) => assignedBatchIds.includes(b.id))
    .map((batch) => {
      const students = db.getBatchEnrolledStudents(batch.id);

      const assignment = Array.from(db.trainerAssignments.values()).find(
        (a) => a.batchId === batch.id && a.status === 'ACTIVE'
      );
      const subject = assignment?.subjectId ? db.subjects.get(assignment.subjectId) : undefined;

      const activeSession = Array.from(db.sessions.values()).find(
        (s) => s.batchId === batch.id && s.sessionStatus === 'ACTIVE'
      );

      let liveStatus = null;
      if (activeSession) {
        liveStatus = db.getSessionLiveStatus(activeSession.id);
      }

      return {
        batch,
        subject,
        enrolledCount: students.length,
        activeSession,
        liveStatus,
      };
    });

  const trainerProfile = db.getProfile(req.userId!);

  return res.json({
    success: true,
    trainer: trainerProfile,
    batches,
  });
});

export default router;
