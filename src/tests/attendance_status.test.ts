// ==============================================================================
// TEST SUITE: STRICT ATTENDANCE STATUS & AUTHORITATIVE ROSTER ENFORCEMENT
// Verifies strictly 3 statuses: PRESENT, ONLINE, ABSENT (NO Late/Delayed)
// Verifies Authoritative Student Roster identity validation & anti-spoofing
// ==============================================================================

import { db } from '../lib/db/mock-db';
import { AttendanceStatus } from '../lib/db/types';
import { isAdmin, isTrainer, isStudent } from '../lib/auth/roles';

export function runAttendanceStatusTests() {
  console.log('\n--- 1. Testing Strict Attendance Status Rules ---');

  const sessionId = '99999999-9999-9999-9999-999999999991';
  const studentId = '44444444-4444-4444-4444-444444444441';
  const actorId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  // Test 1: Permitted status PRESENT
  const res1 = db.correctAttendance({
    sessionId,
    studentId,
    newStatus: 'PRESENT',
    reason: 'Verified physically present in lab',
    actorId,
  });
  if (res1.success && res1.record?.status === 'PRESENT') {
    console.log('  [PASS] Status "PRESENT" accepted successfully.');
  } else {
    throw new Error('Test failed: PRESENT should be accepted.');
  }

  // Test 2: Permitted status ONLINE
  const res2 = db.correctAttendance({
    sessionId,
    studentId,
    newStatus: 'ONLINE',
    reason: 'Attended via Zoom conference meeting',
    actorId,
  });
  if (res2.success && res2.record?.status === 'ONLINE') {
    console.log('  [PASS] Status "ONLINE" accepted successfully.');
  } else {
    throw new Error('Test failed: ONLINE should be accepted.');
  }

  // Test 3: Permitted status ABSENT
  const res3 = db.correctAttendance({
    sessionId,
    studentId,
    newStatus: 'ABSENT',
    reason: 'Unexcused non-attendance',
    actorId,
  });
  if (res3.success && res3.record?.status === 'ABSENT') {
    console.log('  [PASS] Status "ABSENT" accepted successfully.');
  } else {
    throw new Error('Test failed: ABSENT should be accepted.');
  }

  // Test 4: STRICTLY PROHIBITED "LATE" status must be rejected!
  const res4 = db.correctAttendance({
    sessionId,
    studentId,
    newStatus: 'LATE' as any,
    reason: 'Arrived 15 minutes late',
    actorId,
  });
  if (!res4.success && res4.error?.includes('Invalid status')) {
    console.log('  [PASS] Prohibited status "LATE" was correctly REJECTED.');
  } else {
    throw new Error('Security failure: Status "LATE" should be strictly rejected.');
  }

  // Test 5: Rejection of other unauthorized statuses
  const invalidStatuses = ['DELAYED', 'GRACE_PERIOD', 'HALF_DAY', 'EXCUSED'];
  for (const inv of invalidStatuses) {
    const res = db.correctAttendance({
      sessionId,
      studentId,
      newStatus: inv as any,
      reason: 'Testing invalid status rejection',
      actorId,
    });
    if (!res.success) {
      console.log(`  [PASS] Prohibited status "${inv}" correctly rejected.`);
    } else {
      throw new Error(`Security failure: Status "${inv}" was accepted.`);
    }
  }

  // --- Authoritative Student Roster Validation Tests ---
  console.log('\n--- 1.1 Testing Authoritative Student Roster Validation ---');

  const batchId = '77777777-7777-7777-7777-777777777771';
  const testStudentUserId = 'test-student-user-999';

  // Create mock profile for test user
  db.profiles.set(testStudentUserId, {
    id: testStudentUserId,
    displayName: 'Priya Singh',
    email: 'priya.singh@student.edu',
    accountStatus: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const instId = '11111111-1111-1111-1111-111111111111';

  // Test 6: Successfully claim an unclaimed authoritative record (ST-002: Priya Singh)
  const claimRes = db.claimAuthoritativeStudent({
    userId: testStudentUserId,
    institutionId: instId,
    batchId,
    studentIdNumber: 'ST-002',
    submittedFullName: 'Priya Singh',
  });

  if (claimRes.success && claimRes.profile?.isVerified) {
    console.log('  [PASS] Authoritative student record ST-002 claimed and verified successfully.');
  } else {
    throw new Error(`Authoritative claim failed: ${claimRes.error}`);
  }

  // Test 7: Duplicate claim on same student record by another user must be rejected
  const dupClaimRes = db.claimAuthoritativeStudent({
    userId: 'another-user-888',
    institutionId: instId,
    batchId,
    studentIdNumber: 'ST-002',
    submittedFullName: 'Priya Singh',
  });

  if (!dupClaimRes.success && dupClaimRes.error?.toLowerCase().includes('claimed')) {
    console.log('  [PASS] Duplicate claim on ST-002 was correctly REJECTED.');
  } else {
    throw new Error(`Security failure: Duplicate roster claim was allowed. Result: ${JSON.stringify(dupClaimRes)}`);
  }

  // Test 8: Name mismatch on authoritative roster must be rejected
  const mismatchRes = db.claimAuthoritativeStudent({
    userId: 'another-user-777',
    institutionId: instId,
    batchId,
    studentIdNumber: 'ST-003',
    submittedFullName: 'Wrong Imposter Name',
  });

  if (!mismatchRes.success && mismatchRes.error?.includes('does not match')) {
    console.log('  [PASS] Name mismatch against authoritative roster was correctly REJECTED.');
  } else {
    throw new Error('Security failure: Name mismatch roster claim was allowed.');
  }

  // Test 9: Role Guards Test
  console.log('\n--- 1.2 Testing Role Guards ---');
  if (isAdmin('ADMIN') && isAdmin('SUPER_ADMIN') && !isAdmin('TRAINER') && !isAdmin('STUDENT')) {
    console.log('  [PASS] isAdmin guard correctly enforces administrative access.');
  } else {
    throw new Error('Role guard failure: isAdmin logic error.');
  }

  if (isTrainer('TRAINER') && !isTrainer('STUDENT') && !isTrainer('ADMIN')) {
    console.log('  [PASS] isTrainer guard correctly isolates trainer role.');
  } else {
    throw new Error('Role guard failure: isTrainer logic error.');
  }

  if (isStudent('STUDENT') && !isStudent('TRAINER') && !isStudent('ADMIN')) {
    console.log('  [PASS] isStudent guard correctly isolates student role.');
  } else {
    throw new Error('Role guard failure: isStudent logic error.');
  }

  return true;
}
