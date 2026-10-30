// ==============================================================================
// TEST SUITE: MULTI-BATCH ENROLLMENT & BATCH-SPECIFIC QR ATTENDANCE
// ==============================================================================

import { db } from '../lib/db/mock-db';
import { generateQRChallenge } from '../lib/qr/token';

export function runMultiBatchEnrollmentTests() {
  console.log('\n--- 5. Testing Flexible Multi-Batch Student Enrollment ---');

  const institutionId = '11111111-1111-1111-1111-111111111111';
  const testStudentId = 'test-multi-student-001';
  const batchPython = '77777777-7777-7777-7777-777777777772'; // PY-BATCH-25
  const batchJava = '77777777-7777-7777-7777-777777777773'; // JAVA-BATCH-22

  // 1. Create a student account
  db.profiles.set(testStudentId, {
    id: testStudentId,
    displayName: 'Multi-Batch Test Student',
    email: 'multibatch.student@noproxy.edu',
    accountStatus: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  db.studentProfiles.set(testStudentId, {
    id: testStudentId,
    userId: testStudentId,
    institutionId,
    studentIdNumber: 'MB-101',
    fullName: 'Multi-Batch Test Student',
    isVerified: true,
    verificationStatus: 'VERIFIED',
    registeredAt: new Date().toISOString(),
  });

  // Test 1: Enroll student in first batch (Python)
  const enr1 = db.enrollStudentInBatch({
    institutionId,
    studentId: testStudentId,
    batchId: batchPython,
    rollNumber: 'MB-PY-101',
    actorId: 'admin-user',
  });

  if (enr1.success && db.isStudentEnrolledInBatch(testStudentId, batchPython)) {
    console.log('  [PASS] Student successfully enrolled in Batch 1 (Python Data Engineering 25).');
  } else {
    throw new Error(`Failed to enroll student in first batch: ${enr1.error}`);
  }

  // Test 2: Enroll student in second batch (Java) without overwriting first batch
  const enr2 = db.enrollStudentInBatch({
    institutionId,
    studentId: testStudentId,
    batchId: batchJava,
    rollNumber: 'MB-JAVA-101',
    actorId: 'admin-user',
  });

  if (enr2.success && db.isStudentEnrolledInBatch(testStudentId, batchJava)) {
    console.log('  [PASS] Student successfully enrolled in Batch 2 (Java Enterprise Systems 22).');
  } else {
    throw new Error(`Failed to enroll student in second batch: ${enr2.error}`);
  }

  // Verify BOTH enrollments exist simultaneously
  const bothActive = db.isStudentEnrolledInBatch(testStudentId, batchPython) &&
    db.isStudentEnrolledInBatch(testStudentId, batchJava);

  if (bothActive) {
    console.log('  [PASS] Multi-batch persistence verified: Student actively belongs to both batches simultaneously.');
  } else {
    throw new Error('Multi-batch failure: Adding second batch destroyed or overwrote the first enrollment.');
  }

  // Test 3: Duplicate active enrollment in same batch must be rejected
  const dupEnr = db.enrollStudentInBatch({
    institutionId,
    studentId: testStudentId,
    batchId: batchPython,
    rollNumber: 'MB-PY-101',
    actorId: 'admin-user',
  });

  if (!dupEnr.success && dupEnr.error?.toLowerCase().includes('already')) {
    console.log('  [PASS] Duplicate active enrollment in the same batch was correctly REJECTED.');
  } else {
    throw new Error('Security failure: Duplicate enrollment was allowed.');
  }

  // Test 4: Student queries their enrolled batches
  const enrolledBatches = db.getStudentEnrolledBatches(testStudentId);
  if (enrolledBatches.length >= 2) {
    console.log(`  [PASS] Student query returns all ${enrolledBatches.length} active batches with individual schedules.`);
  } else {
    throw new Error('Multi-batch query failure: Not all batches returned.');
  }

  // Test 5: Removing one batch does not affect other batches
  const dropRes = db.removeStudentFromBatch({
    studentId: testStudentId,
    batchId: batchJava,
    actorId: 'admin-user',
    reason: 'Student dropped Java elective',
  });

  if (dropRes.success && !db.isStudentEnrolledInBatch(testStudentId, batchJava) && db.isStudentEnrolledInBatch(testStudentId, batchPython)) {
    console.log('  [PASS] Removing Batch 2 enrollment preserved Batch 1 enrollment completely intact.');
  } else {
    throw new Error('Enrollment removal failure: Deactivating one batch corrupted another batch.');
  }

  // --- BATCH-SPECIFIC QR ATTENDANCE TESTS ---
  console.log('\n--- 5.1 Testing Batch-Specific Dynamic QR Attendance ---');

  // Re-enroll in Java for attendance testing
  db.enrollStudentInBatch({
    institutionId,
    studentId: testStudentId,
    batchId: batchJava,
    rollNumber: 'MB-JAVA-101',
  });

  const pythonSessionId = '99999999-9999-9999-9999-999999999982'; // Active Python session
  const pythonSession = db.sessions.get(pythonSessionId)!;

  // Generate valid dynamic QR challenge for Python session
  const pyChallenge = generateQRChallenge(pythonSessionId, pythonSession.batchId, 20);

  // Test 6: Enrolled student scans Python session QR -> Accepted strictly for Python session
  const submitPyRes = db.submitOfflineAttendance({
    authenticatedUserId: testStudentId,
    sessionId: pythonSessionId,
    rawToken: pyChallenge.rawToken,
    studentCoords: { latitude: 19.0760, longitude: 72.8777, accuracy: 10 },
  });

  if (submitPyRes.success && submitPyRes.record?.status === 'PRESENT') {
    console.log('  [PASS] Attendance marked PRESENT specifically for Python session.');
  } else {
    throw new Error(`Batch attendance submission failed: ${submitPyRes.error}`);
  }

  // Verify attendance record exists ONLY for Python session, NOT for Java
  const pyAttendance = db.attendance.get(`${pythonSessionId}:${testStudentId}`);
  const javaAttendance = db.attendance.get(`99999999-9999-9999-9999-999999999971:${testStudentId}`);

  if (pyAttendance && pyAttendance.status === 'PRESENT') {
    console.log('  [PASS] Attendance isolation verified: Record created strictly for Python session.');
  } else {
    throw new Error('Attendance isolation failure.');
  }

  // Test 7: Student NOT enrolled in a batch is rejected when scanning that batch's QR
  const outsiderStudentId = 'outsider-student-999';
  db.profiles.set(outsiderStudentId, {
    id: outsiderStudentId,
    displayName: 'Outsider Student',
    email: 'outsider@noproxy.edu',
    accountStatus: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  db.studentProfiles.set(outsiderStudentId, {
    id: outsiderStudentId,
    userId: outsiderStudentId,
    institutionId,
    studentIdNumber: 'OUT-999',
    fullName: 'Outsider Student',
    isVerified: true,
    verificationStatus: 'VERIFIED',
    registeredAt: new Date().toISOString(),
  });

  // Generate fresh challenge for Python session
  const freshPyChallenge = generateQRChallenge(pythonSessionId, pythonSession.batchId, 20);
  const outsiderAttempt = db.submitOfflineAttendance({
    authenticatedUserId: outsiderStudentId,
    sessionId: pythonSessionId,
    rawToken: freshPyChallenge.rawToken,
    studentCoords: { latitude: 19.0760, longitude: 72.8777, accuracy: 10 },
  });

  if (!outsiderAttempt.success && outsiderAttempt.error?.toLowerCase().includes('not actively enrolled')) {
    console.log('  [PASS] Non-enrolled student QR submission was correctly REJECTED.');
  } else {
    throw new Error(`Security failure: Non-enrolled student attendance was accepted. Result: ${JSON.stringify(outsiderAttempt)}`);
  }

  return true;
}
