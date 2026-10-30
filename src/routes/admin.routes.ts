import { Router, Response } from 'express';
import { db } from '../lib/db/mock-db';
import { AuthenticatedRequest, requireAdmin } from '../middleware/auth';

const router = Router();

// Apply requireAdmin to all admin sub-routes
router.use(requireAdmin);

// ------------------------------------------------------------------------------
// Admin Dashboard
// ------------------------------------------------------------------------------
router.get('/dashboard', (req: AuthenticatedRequest, res: Response) => {
  const stats = db.getAdminDashboardStats();
  return res.json({ success: true, ...stats });
});

// ------------------------------------------------------------------------------
// Batches Management
// ------------------------------------------------------------------------------
router.get('/batches', (req: AuthenticatedRequest, res: Response) => {
  const instId = '11111111-1111-1111-1111-111111111111';
  const batches = Array.from(db.batches.values())
    .filter((b) => b.institutionId === instId)
    .map((b) => {
      const assignments = Array.from(db.trainerAssignments.values())
        .filter((a) => a.batchId === b.id && a.status === 'ACTIVE');
      const trainers = assignments.map((a) => {
        const p = db.profiles.get(a.trainerId);
        return { id: a.trainerId, name: p?.displayName || 'Unknown Trainer', email: p?.email || '' };
      });
      const students = db.getBatchEnrolledStudents(b.id);
      return {
        id: b.id,
        name: b.name,
        code: b.code,
        courseName: b.courseName,
        status: b.status,
        trainers,
        studentsCount: students.length,
        students,
      };
    });
  return res.json({ success: true, batches });
});

router.post('/batches', (req: AuthenticatedRequest, res: Response) => {
  const { name, courseName, startDate, endDate, trainerId } = req.body || {};
  if (!name || !courseName) {
    return res.status(400).json({ error: 'name and courseName are required.' });
  }

  const batch = db.createBatch({
    name,
    courseName,
    startDate,
    endDate,
    trainerId,
  });

  return res.json({ success: true, batch });
});

// ------------------------------------------------------------------------------
// Trainer Assignment
// ------------------------------------------------------------------------------
router.post('/trainers/assign', (req: AuthenticatedRequest, res: Response) => {
  const { trainerId, batchId } = req.body || {};
  if (!trainerId || !batchId) {
    return res.status(400).json({ error: 'trainerId and batchId are required.' });
  }

  const result = db.assignTrainerToBatch({
    trainerId,
    batchId,
    actorId: req.userId || 'admin',
  });

  return res.json(result);
});

// ------------------------------------------------------------------------------
// Students & Authoritative Roster
// ------------------------------------------------------------------------------
// GET /api/admin/students?batchId=...
router.get('/students', (req: AuthenticatedRequest, res: Response) => {
  const batchId = req.query.batchId as string;
  if (batchId) {
    const students = db.getBatchEnrolledStudents(batchId);
    return res.json({ success: true, students });
  }

  // Return all enrolled students across the institute
  const instId = '11111111-1111-1111-1111-111111111111';
  const allEnrollments = Array.from(db.studentEnrollments.values())
    .filter((e) => e.institutionId === instId && e.status === 'ACTIVE');

  const students = allEnrollments.map((e) => {
    const profile = db.profiles.get(e.studentId);
    const batch = db.batches.get(e.batchId);
    return {
      id: e.id,
      studentId: e.studentId,
      fullName: profile?.displayName || 'Unknown Student',
      email: profile?.email || '',
      batchId: e.batchId,
      batchName: batch?.name || 'Unknown Batch',
      enrolledAt: e.enrolledAt,
    };
  });

  return res.json({ success: true, students });
});

// POST /api/admin/students (Single student add / enroll)
router.post('/students', (req: AuthenticatedRequest, res: Response) => {
  const { batchId, fullName, email } = req.body || {};

  if (!batchId || !fullName || !email) {
    return res.status(400).json({ error: 'batchId, fullName, and email are required.' });
  }

  const result = db.enrollStudentByEmail({
    batchId,
    fullName: fullName.trim(),
    email: email.trim(),
    actorId: req.userId || 'admin',
    actorRole: 'ADMIN',
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, student: result.student });
});

// POST /api/admin/students/import (Bulk CSV import)
router.post('/students/import', (req: AuthenticatedRequest, res: Response) => {
  const { batchId, csvData } = req.body || {};

  if (!batchId || !csvData) {
    return res.status(400).json({ error: 'batchId and csvData are required.' });
  }

  const instId = '11111111-1111-1111-1111-111111111111';
  const lines = csvData.split('\n').filter((l: string) => l.trim().length > 0);
  const imported: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p: string) => p.trim());
    if (parts.length >= 2) {
      const studentIdNumber = parts[0];
      const fullName = parts[1];
      const email = parts[2] || undefined;

      const resAdd = db.addAuthoritativeStudent({
        institutionId: instId,
        batchId,
        studentIdNumber,
        fullName,
        email,
      });

      if (resAdd.success) {
        imported.push(resAdd.student);
      } else {
        errors.push(`Row ${i + 1} (${studentIdNumber}): ${resAdd.error}`);
      }
    }
  }

  return res.json({
    success: true,
    importedCount: imported.length,
    errorCount: errors.length,
    errors,
  });
});

// POST /api/admin/students/reset-claim
router.post('/students/reset-claim', (req: AuthenticatedRequest, res: Response) => {
  const { rosterId, reason } = req.body || {};

  if (!rosterId || !reason) {
    return res.status(400).json({ error: 'rosterId and mandatory audit reason are required.' });
  }

  const result = db.resetStudentClaim(rosterId, req.userId!, reason);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: 'Student claim successfully reset with audit record.' });
});

// ------------------------------------------------------------------------------
// Trainers Management
// ------------------------------------------------------------------------------
// GET /api/admin/trainers
router.get('/trainers', (req: AuthenticatedRequest, res: Response) => {
  const instId = '11111111-1111-1111-1111-111111111111';
  const trainers = Array.from(db.memberships.values())
    .filter((m) => m.institutionId === instId && m.role === 'TRAINER')
    .map((m) => {
      const profile = db.profiles.get(m.userId);
      const assignments = Array.from(db.trainerAssignments.values()).filter((a) => a.trainerId === m.userId);
      return {
        id: m.userId,
        displayName: profile?.displayName || 'Unknown Trainer',
        email: profile?.email || '',
        status: m.status,
        assignedBatchCount: assignments.length,
      };
    });

  return res.json({ success: true, trainers });
});

// POST /api/admin/trainers (Add/assign trainer)
router.post('/trainers', (req: AuthenticatedRequest, res: Response) => {
  const { displayName, email, password = 'Trainer@2026!' } = req.body || {};

  if (!displayName || !email) {
    return res.status(400).json({ error: 'displayName and email are required.' });
  }

  const existing = db.credentials.get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const trainerId = `tr-${Date.now()}`;
  const instId = '11111111-1111-1111-1111-111111111111';

  db.profiles.set(trainerId, {
    id: trainerId,
    displayName,
    email: email.toLowerCase(),
    accountStatus: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  db.memberships.set(`mem-${trainerId}`, {
    id: `mem-${trainerId}`,
    institutionId: instId,
    userId: trainerId,
    role: 'TRAINER',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  });

  db.credentials.set(email.toLowerCase(), {
    email: email.toLowerCase(),
    passwordHash: password,
    role: 'TRAINER',
    userId: trainerId,
    institutionId: instId,
  });

  return res.json({ success: true, trainerId, message: 'Trainer provisioned successfully.' });
});

// ------------------------------------------------------------------------------
// Multi-Batch Enrollments
// ------------------------------------------------------------------------------
// GET /api/admin/enrollments
router.get('/enrollments', (req: AuthenticatedRequest, res: Response) => {
  const instId = '11111111-1111-1111-1111-111111111111';
  const enrollments = Array.from(db.studentEnrollments.values())
    .filter((e) => e.institutionId === instId)
    .map((e) => {
      const student = db.profiles.get(e.studentId);
      const batch = db.batches.get(e.batchId);
      return {
        ...e,
        studentName: student?.displayName || 'Unknown Student',
        studentEmail: student?.email || '',
        batchName: batch?.name || 'Unknown Batch',
        batchCode: batch?.code || '',
      };
    });

  return res.json({ success: true, enrollments });
});

// POST /api/admin/enrollments
router.post('/enrollments', (req: AuthenticatedRequest, res: Response) => {
  const { studentId, batchId, rollNumber } = req.body || {};

  if (!studentId || !batchId) {
    return res.status(400).json({ error: 'studentId and batchId are required.' });
  }

  const instId = '11111111-1111-1111-1111-111111111111';
  const result = db.enrollStudentInBatch({
    institutionId: instId,
    studentId,
    batchId,
    rollNumber,
    actorId: req.userId,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, enrollment: result.enrollment });
});

// DELETE /api/admin/enrollments
router.delete('/enrollments', (req: AuthenticatedRequest, res: Response) => {
  const { studentId, batchId, reason } = req.body || {};

  if (!studentId || !batchId) {
    return res.status(400).json({ error: 'studentId and batchId are required.' });
  }

  const result = db.removeStudentFromBatch({
    studentId,
    batchId,
    actorId: req.userId!,
    reason,
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: 'Student enrollment updated to DROPPED with audit trail.' });
});

// ------------------------------------------------------------------------------
// Sensitive Location & Network Verification Settings (ADMIN-ONLY)
// ------------------------------------------------------------------------------
// GET /api/admin/settings/location-network
router.get('/settings/location-network', (req: AuthenticatedRequest, res: Response) => {
  const instId = '11111111-1111-1111-1111-111111111111';
  const classrooms = db.listClassroomsAdmin(instId, req.userRole!);
  return res.json({ success: true, classrooms });
});

// POST /api/admin/settings/location-network
router.post('/settings/location-network', (req: AuthenticatedRequest, res: Response) => {
  const {
    classroomId,
    name,
    building,
    roomNumber,
    latitude,
    longitude,
    geofenceRadiusMeters,
    requiredGpsAccuracyMeters,
    allowedNetworkCidrs,
    gpsVerificationEnabled,
    gpsMandatory,
    networkVerificationEnabled,
    networkMandatory,
    reason,
  } = req.body || {};

  if (!classroomId || latitude === undefined || longitude === undefined || !reason) {
    return res.status(400).json({ error: 'classroomId, latitude, longitude, and audit reason are required.' });
  }

  const result = db.updateClassroomSettings({
    classroomId,
    userRole: req.userRole!,
    actorId: req.userId!,
    name,
    building,
    roomNumber,
    latitude: Number(latitude),
    longitude: Number(longitude),
    geofenceRadiusMeters: Number(geofenceRadiusMeters),
    requiredGpsAccuracyMeters: Number(requiredGpsAccuracyMeters),
    allowedNetworkCidrs: Array.isArray(allowedNetworkCidrs) ? allowedNetworkCidrs : [],
    gpsVerificationEnabled: !!gpsVerificationEnabled,
    gpsMandatory: !!gpsMandatory,
    networkVerificationEnabled: !!networkVerificationEnabled,
    networkMandatory: !!networkMandatory,
    reason,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, classroom: result.classroom });
});

export default router;
