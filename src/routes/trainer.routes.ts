import { Router, Response } from 'express';
import { db } from '../lib/db/mock-db';
import { AuthenticatedRequest, requireAuth, requireTrainer } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.use(requireTrainer);

// GET /api/trainer/students/search
router.get('/students/search', (req: AuthenticatedRequest, res: Response) => {
  const query = (req.query.q as string) || '';
  const batchId = (req.query.batchId as string) || undefined;
  const students = db.searchStudents(query, batchId);
  return res.json({ success: true, students });
});

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
        students: students.map((s) => ({
          id: s.student.id,
          displayName: s.student.displayName,
          email: s.student.email,
        })),
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

// POST /api/trainer/batches/:id/students (Trainer adds student to assigned batch by Full Name & Email)
router.post('/batches/:id/students', (req: AuthenticatedRequest, res: Response) => {
  const batchId = req.params.id;
  const { fullName, email } = req.body || {};

  if (!fullName || !email) {
    return res.status(400).json({ error: 'Both student full name and email are required.' });
  }

  const result = db.enrollStudentByEmail({
    batchId,
    fullName: fullName.trim(),
    email: email.trim(),
    actorId: req.userId!,
    actorRole: req.userRole!,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({
    success: true,
    student: result.student,
    enrollment: result.enrollment,
    isNewStudent: result.isNewStudent,
    message: result.message,
  });
});

// DELETE /api/trainer/batches/:id/students (Trainer removes student from assigned batch)
router.delete('/batches/:id/students', (req: AuthenticatedRequest, res: Response) => {
  const batchId = req.params.id;
  const studentId = req.query.studentId as string;

  if (!studentId) {
    return res.status(400).json({ error: 'studentId query parameter is required.' });
  }

  // Check trainer authorization
  if (req.userRole === 'TRAINER') {
    const isAssigned = Array.from(db.trainerAssignments.values()).some(
      (a) => a.trainerId === req.userId && a.batchId === batchId && a.status === 'ACTIVE'
    );
    if (!isAssigned) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to manage this batch.' });
    }
  }

  const result = db.removeStudentFromBatch({
    batchId,
    studentId,
    actorId: req.userId!,
    reason: 'Removed by trainer',
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({
    success: true,
    message: 'Student removed from batch successfully.',
  });
});

export default router;
