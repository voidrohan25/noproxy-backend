// ==============================================================================
// NOPROXY INDEPENDENT SENIOR SECURITY & ADVERSARIAL AUDIT TEST SUITE
// ==============================================================================

import { db } from '../lib/db/mock-db';
import { generateBatchAttendanceExcel } from '../lib/excel/generator';
import { generateQRChallenge, verifyQRChallenge } from '../lib/qr/token';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const discoveredBugs: string[] = [];

function auditAssert(condition: boolean, testName: string, failureDetails?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    const bug = `FAIL: ${testName} - ${failureDetails || 'Assertion violated'}`;
    discoveredBugs.push(bug);
    console.error(`  [FAIL] ${testName}: ${failureDetails || 'Assertion violated'}`);
  }
}

export async function runAdversarialSecurityAudit() {
  console.log('\n--- 8. Testing Adversarial Security Penetration & Boundaries ---');

  const instId = '11111111-1111-1111-1111-111111111111';

  // 1. IDOR & Object-Level Authorization
  const batchARes = db.createBatch({ name: 'Batch Alpha (Python)', institutionId: instId });
  const batchBRes = db.createBatch({ name: 'Batch Beta (Java)', institutionId: instId });
  const batchA = batchARes.batch!;
  const batchB = batchBRes.batch!;

  const trainerARes = db.createTrainerAccount({
    institutionId: instId,
    name: 'Trainer Alpha',
    email: `trainer.alpha.${Date.now()}@noproxy.edu`,
    password: 'Password123!',
    batchIds: [batchA.id],
    subjectIds: ['66666666-6666-6666-6666-666666666661'],
    actorId: 'admin-root',
  });
  const trainerA = trainerARes.trainer!;

  const studentAliceRes = db.enrollStudentByEmail({
    batchId: batchA.id,
    fullName: 'Alice Walker',
    email: `alice.${Date.now()}@noproxy.edu`,
  });
  const studentAlice = studentAliceRes.student!;

  // 1.1: Trainer A attempting to enroll into Batch Beta
  const unauthorizedEnroll = db.enrollStudentByEmail({
    batchId: batchB.id,
    fullName: 'Intruder Student',
    email: `intruder.${Date.now()}@test.com`,
    actorId: trainerA.id,
    actorRole: 'TRAINER',
  });
  auditAssert(!unauthorizedEnroll.success, 'Trainer A unauthorized student enrollment into Batch B is strictly BLOCKED');

  // 1.2: Student Alice attempting to enroll another student
  const studentEnrollAttempt = db.enrollStudentByEmail({
    batchId: batchA.id,
    fullName: 'Malicious Student',
    email: `malicious.${Date.now()}@test.com`,
    actorId: studentAlice.id,
    actorRole: 'STUDENT',
  });
  auditAssert(!studentEnrollAttempt.success, 'Student role cannot enroll other students into batches');

  // 2. Strict 3-Status Rules
  const sessionAlphaId = `session-audit-${Date.now()}`;
  db.sessions.set(sessionAlphaId, {
    id: sessionAlphaId,
    institutionId: instId,
    batchId: batchA.id,
    subjectId: '66666666-6666-6666-6666-666666666661',
    classroomId: '88888888-8888-8888-8888-888888888881',
    createdBy: trainerA.id,
    title: 'Adversarial Security Session',
    sessionDate: '2026-11-01',
    startTime: '09:00:00',
    endTime: '11:00:00',
    mode: 'OFFLINE',
    sessionStatus: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const badStatuses = ['LATE', 'HALF_DAY', 'GRACE_PERIOD', 'EXCUSED', 'DELAYED'];
  let allBadStatusesRejected = true;
  for (const bad of badStatuses) {
    const res = db.correctAttendance({
      sessionId: sessionAlphaId,
      studentId: studentAlice.id,
      newStatus: bad as any,
      reason: 'Adversarial test injection',
      actorId: trainerA.id,
    });
    if (res.success) allBadStatusesRejected = false;
  }
  auditAssert(allBadStatusesRejected, 'All prohibited non-3-status values (LATE, GRACE, EXCUSED) strictly REJECTED');

  // 3. Dynamic QR Cryptographic Verification & Anti-Replay
  const challenge = generateQRChallenge(sessionAlphaId, instId, 20);
  const validVerify = verifyQRChallenge(challenge.rawToken, sessionAlphaId);
  auditAssert(validVerify.valid === true, 'Fresh cryptographic QR challenge valid within 20s TTL');

  const tokenParts = challenge.rawToken.split('.');
  const tamperedToken = `${tokenParts[0]}.FORGED_DATA.${tokenParts[2]}.${tokenParts[3]}`;
  const tamperedVerify = verifyQRChallenge(tamperedToken, sessionAlphaId);
  auditAssert(tamperedVerify.valid === false, 'Tampered QR challenge payload strictly REJECTED');

  const expiredChallenge = generateQRChallenge(sessionAlphaId, instId, -10);
  const expiredVerify = verifyQRChallenge(expiredChallenge.rawToken, sessionAlphaId);
  auditAssert(expiredVerify.valid === false, 'Expired QR challenge token strictly REJECTED');

  // 4. GPS Geofence & Boundary Integrity
  const classroom = db.classrooms.get('88888888-8888-8888-8888-888888888881')!;
  const coordsInside = { latitude: classroom.latitude + 0.00005, longitude: classroom.longitude + 0.00005, accuracy: 10 };
  const attInside = db.submitOfflineAttendance({
    authenticatedUserId: studentAlice.id,
    sessionId: sessionAlphaId,
    rawToken: challenge.rawToken,
    studentCoords: coordsInside,
    deviceCredentialId: `cred-${Date.now()}`,
    localAuthConfirmed: true,
  });
  auditAssert(attInside.success === true, 'Student inside geofence radius recorded as PRESENT');

  // Duplicate submission
  const attDuplicate = db.submitOfflineAttendance({
    authenticatedUserId: studentAlice.id,
    sessionId: sessionAlphaId,
    rawToken: challenge.rawToken,
    studentCoords: coordsInside,
  });
  auditAssert(attDuplicate.success === false, 'Duplicate scan by same student on same session strictly REJECTED');

  // Outside geofence radius
  const studentCharlieRes = db.enrollStudentByEmail({
    batchId: batchA.id,
    fullName: 'Charlie Davis',
    email: `charlie.${Date.now()}@noproxy.edu`,
  });
  const studentCharlie = studentCharlieRes.student!;
  const coordsOutside = { latitude: classroom.latitude + 0.03, longitude: classroom.longitude + 0.03, accuracy: 10 }; // ~4.5 km away
  const challenge3 = generateQRChallenge(sessionAlphaId, instId, 20);
  const attOutside = db.submitOfflineAttendance({
    authenticatedUserId: studentCharlie.id,
    sessionId: sessionAlphaId,
    rawToken: challenge3.rawToken,
    studentCoords: coordsOutside,
  });
  auditAssert(attOutside.success === false, 'Student outside geofence radius (4.5 km away) strictly REJECTED');

  // Inaccurate GPS reading
  const coordsInaccurate = { latitude: classroom.latitude + 0.00005, longitude: classroom.longitude + 0.00005, accuracy: 120 };
  const challenge4 = generateQRChallenge(sessionAlphaId, instId, 20);
  const attInaccurate = db.submitOfflineAttendance({
    authenticatedUserId: studentCharlie.id,
    sessionId: sessionAlphaId,
    rawToken: challenge4.rawToken,
    studentCoords: coordsInaccurate,
  });
  auditAssert(attInaccurate.success === false, 'Inaccurate GPS device fix (accuracy: 120m > 30m threshold) strictly REJECTED');

  // 5. Concurrency & Race Conditions
  const studentDavidRes = db.enrollStudentByEmail({
    batchId: batchA.id,
    fullName: 'David Concurrency',
    email: `david.${Date.now()}@noproxy.edu`,
  });
  const studentDavid = studentDavidRes.student!;
  const raceChallenge = generateQRChallenge(sessionAlphaId, instId, 20);

  const concurrentSubmissions = await Promise.all(
    Array.from({ length: 25 }, () =>
      Promise.resolve(
        db.submitOfflineAttendance({
          authenticatedUserId: studentDavid.id,
          sessionId: sessionAlphaId,
          rawToken: raceChallenge.rawToken,
          studentCoords: coordsInside,
        })
      )
    )
  );
  const successfulScans = concurrentSubmissions.filter((r) => r.success);
  const duplicateRejections = concurrentSubmissions.filter((r) => !r.success);
  auditAssert(
    successfulScans.length === 1 && duplicateRejections.length === 24,
    '25 concurrent scan submissions: Exactly 1 SUCCESS, 24 duplicate rejections'
  );

  // 6. Deactivated Account Enforcement
  db.profiles.get(trainerA.id)!.accountStatus = 'INACTIVE';
  const deactLogin = db.authenticateUser(trainerA.email, 'Password123!');
  auditAssert(deactLogin.success === false, 'Deactivated trainer account login strictly BLOCKED');

  db.profiles.get(trainerA.id)!.accountStatus = 'ACTIVE';
  const reactLogin = db.authenticateUser(trainerA.email, 'Password123!');
  auditAssert(reactLogin.success === true, 'Reactivated trainer account login SUCCEEDS');

  if (failedTests > 0) {
    throw new Error(`${failedTests} adversarial security tests failed.`);
  }
}
