import { Router, Response } from 'express';
import { db } from '../lib/db/mock-db';
import { AuthenticatedRequest, requireAuth, requireStudent } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /api/student/batches (Returns all batches the authenticated student is actively enrolled in)
router.get('/batches', (req: AuthenticatedRequest, res: Response) => {
  const studentId = req.userId!;
  const enrolledBatches = db.getStudentEnrolledBatches(studentId);

  return res.json({
    success: true,
    batches: enrolledBatches,
    count: enrolledBatches.length,
  });
});

export default router;
