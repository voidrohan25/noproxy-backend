// ==============================================================================
// NOPROXY STUDENT ENROLLMENT MANDATORY SCENARIOS (PART 1.5)
// Scenarios A through F Verification
// ==============================================================================

import { db } from '../lib/db/mock-db';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

export function runStudentEnrollmentScenariosTests() {
  console.log('\n--- 1.3 Testing Mandatory Student Enrollment Scenarios (A - F) ---');

  const instId = '11111111-1111-1111-1111-111111111111';

  // Create clean isolated test batches
  const pythonBatchRes = db.createBatch({
    name: 'Python Data Engineering 2026',
    courseName: 'Data Engineering',
  });
  const javaBatchRes = db.createBatch({
    name: 'Java Enterprise Architecture 2026',
    courseName: 'Software Engineering',
  });
  const reactBatchRes = db.createBatch({
    name: 'React Cloud Native 2026',
    courseName: 'Frontend Architecture',
  });

  const pythonBatch = pythonBatchRes.batch!;
  const javaBatch = javaBatchRes.batch!;
  const reactBatch = reactBatchRes.batch!;

  // --------------------------------------------------------------------------
  // Scenario A: Existing student in another batch
  // Rahul Sharma, rahul@example.com, already belongs to Python Batch.
  // Trainer searches rahul@example.com and enrolls Rahul in Java Batch.
  // Expected: 1 student account, 2 enrollment records, both batches display Rahul.
  // --------------------------------------------------------------------------
  const enrA1 = db.enrollStudentByEmail({
    batchId: pythonBatch.id,
    fullName: 'Rahul Sharma',
    email: 'rahul@example.com',
  });
  assert(enrA1.success, 'Scenario A: Initial enrollment in Python batch must succeed');
  assert(enrA1.isNewStudent === true, 'Scenario A: Rahul should be a new student initially');

  const searchA = db.searchStudents('rahul@example.com', javaBatch.id);
  assert(searchA.length === 1, 'Scenario A: Search should find Rahul Sharma');
  assert(searchA[0].isAlreadyEnrolled === false, 'Scenario A: Rahul is not yet enrolled in Java Batch');

  const enrA2 = db.enrollStudentByEmail({
    batchId: javaBatch.id,
    fullName: 'Rahul Sharma',
    email: 'rahul@example.com',
  });
  assert(enrA2.success, 'Scenario A: Enrollment into Java batch must succeed');
  assert(enrA2.isNewStudent === false, 'Scenario A: Account must be REUSED, not recreated');

  // Verify accounts and enrollments
  const rahulAccounts = Array.from(db.profiles.values()).filter((p) => p.email.toLowerCase() === 'rahul@example.com');
  assert(rahulAccounts.length === 1, 'Scenario A: There must be exactly ONE student account for rahul@example.com');

  const rahulEnrollments = Array.from(db.studentEnrollments.values()).filter(
    (e) => e.studentId === rahulAccounts[0].id && e.status === 'ACTIVE'
  );
  assert(rahulEnrollments.length >= 2, 'Scenario A: Rahul must have active enrollments in both batches');

  const pythonStudents = db.getBatchEnrolledStudents(pythonBatch.id);
  const javaStudents = db.getBatchEnrolledStudents(javaBatch.id);
  assert(pythonStudents.some((s) => s.student.id === rahulAccounts[0].id), 'Scenario A: Rahul must appear in Python batch');
  assert(javaStudents.some((s) => s.student.id === rahulAccounts[0].id), 'Scenario A: Rahul must appear in Java batch');
  console.log('  [PASS] Scenario A: Existing student in another batch reused with independent enrollments.');

  // --------------------------------------------------------------------------
  // Scenario B: Completely new student
  // Amit Patil, amit@example.com, does not exist.
  // Application creates the student and enrollment.
  // Expected: 1 student account, 1 enrollment record, student appears immediately in the batch.
  // --------------------------------------------------------------------------
  const enrB = db.enrollStudentByEmail({
    batchId: javaBatch.id,
    fullName: 'Amit Patil',
    email: 'amit@example.com',
  });
  assert(enrB.success, 'Scenario B: Amit Patil enrollment must succeed');
  assert(enrB.isNewStudent === true, 'Scenario B: Amit must be marked as new student');

  const amitAccounts = Array.from(db.profiles.values()).filter((p) => p.email.toLowerCase() === 'amit@example.com');
  assert(amitAccounts.length === 1, 'Scenario B: Exactly one account created for Amit');

  const javaStudentsAfterB = db.getBatchEnrolledStudents(javaBatch.id);
  assert(javaStudentsAfterB.some((s) => s.student.email === 'amit@example.com'), 'Scenario B: Amit appears immediately in Java batch');
  console.log('  [PASS] Scenario B: Completely new student account and enrollment created cleanly.');

  // --------------------------------------------------------------------------
  // Scenario C: Duplicate enrollment
  // Rahul is already enrolled in Java Batch. Trainer attempts to add him again.
  // Expected: No duplicate account, no duplicate enrollment, clear message: Already enrolled.
  // --------------------------------------------------------------------------
  const enrC = db.enrollStudentByEmail({
    batchId: javaBatch.id,
    fullName: 'Rahul Sharma',
    email: 'rahul@example.com',
  });
  assert(!enrC.success, 'Scenario C: Duplicate enrollment must be rejected');
  assert(enrC.error?.includes('already'), 'Scenario C: Error message must explain student is already enrolled');

  const rahulJavaEnrollments = Array.from(db.studentEnrollments.values()).filter(
    (e) => e.studentId === rahulAccounts[0].id && e.batchId === javaBatch.id && e.status === 'ACTIVE'
  );
  assert(rahulJavaEnrollments.length === 1, 'Scenario C: Exactly 1 active enrollment must exist in Java batch');
  console.log('  [PASS] Scenario C: Duplicate enrollment correctly rejected with clear error message.');

  // --------------------------------------------------------------------------
  // Scenario D: Student belongs to three batches
  // A student is enrolled in Python, Java, and React.
  // Expected: Same account across all three. Independent attendance for every batch.
  // --------------------------------------------------------------------------
  const enrD = db.enrollStudentByEmail({
    batchId: reactBatch.id,
    fullName: 'Rahul Sharma',
    email: 'rahul@example.com',
  });
  assert(enrD.success, 'Scenario D: Rahul enrollment into React batch must succeed');

  const rahulBatches = db.getStudentEnrolledBatches(rahulAccounts[0].id);
  const enrolledBatchIds = rahulBatches.map((b: any) => b?.batch?.id);
  assert(enrolledBatchIds.includes(pythonBatch.id), 'Scenario D: Must include Python batch');
  assert(enrolledBatchIds.includes(javaBatch.id), 'Scenario D: Must include Java batch');
  assert(enrolledBatchIds.includes(reactBatch.id), 'Scenario D: Must include React batch');
  console.log('  [PASS] Scenario D: Student belongs to 3 concurrent batches with isolated rosters.');

  // --------------------------------------------------------------------------
  // Scenario E: Multiple existing students
  // Add 10 existing students to one batch.
  // Expected: All 10 are displayed. None disappear. None are recreated.
  // --------------------------------------------------------------------------
  const batchERes = db.createBatch({
    name: 'Full Stack Cloud Lab 2026',
    courseName: 'Cloud Engineering',
  });
  const batchE = batchERes.batch!;

  // Seed 10 existing students across the institute
  const existingStudentsList = [];
  for (let i = 1; i <= 10; i++) {
    const email = `batch.student.${i}@institute.edu`;
    const fullName = `Batch Student ${i}`;
    const enr = db.enrollStudentByEmail({
      batchId: pythonBatch.id,
      fullName,
      email,
    });
    existingStudentsList.push(enr.student!);
  }

  // Now enroll all 10 into batchE
  for (const stud of existingStudentsList) {
    const res = db.enrollStudentByEmail({
      batchId: batchE.id,
      fullName: stud.displayName,
      email: stud.email,
    });
    assert(res.success, `Scenario E: Enrolling existing student ${stud.displayName} must succeed`);
    assert(res.isNewStudent === false, `Scenario E: Student ${stud.displayName} must be reused, not recreated`);
  }

  const batchEStudents = db.getBatchEnrolledStudents(batchE.id);
  assert(batchEStudents.length === 10, `Scenario E: Exactly 10 students must be in batchE, found ${batchEStudents.length}`);
  console.log('  [PASS] Scenario E: 10 existing students enrolled into new batch with zero account duplication.');

  // --------------------------------------------------------------------------
  // Scenario F: Large enrollment (100 students)
  // Verify accurate results and correct batch counts under bulk operations.
  // --------------------------------------------------------------------------
  const batchFRes = db.createBatch({
    name: 'Mega Data Science Cohort 100',
    courseName: 'Data Science',
  });
  const batchF = batchFRes.batch!;

  for (let i = 1; i <= 100; i++) {
    const email = `cohort100.student.${i}@institute.edu`;
    const fullName = `Cohort Student ${i}`;
    const res = db.enrollStudentByEmail({
      batchId: batchF.id,
      fullName,
      email,
    });
    assert(res.success, `Scenario F: Student ${i} enrollment must succeed`);
  }

  const batchFStudents = db.getBatchEnrolledStudents(batchF.id);
  assert(batchFStudents.length === 100, `Scenario F: Exactly 100 students enrolled, found ${batchFStudents.length}`);
  console.log('  [PASS] Scenario F: Large batch enrollment (100 students) completed and verified with 100% accuracy.');
}
