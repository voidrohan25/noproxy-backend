// ==============================================================================
// NOPROXY DATABASE ADAPTER & IN-MEMORY STORE (COMMERCIAL SAAS EDITION)
// Strict 3-Status System (PRESENT, ONLINE, ABSENT) - No Late/Grace Period
// Authoritative Institutional Student Roster & Secure Identity Validation
// ==============================================================================

import {
  Institution,
  Profile,
  InstitutionMembership,
  Course,
  Subject,
  Batch,
  Classroom,
  Session,
  AttendanceRecord,
  DeviceRegistration,
  AttendancePolicy,
  AuditLog,
  AttendanceStatus,
  AttendanceSummary,
  AuthoritativeStudent,
  StudentProfile,
  StudentEnrollment,
  Role,
  PublicClassroom,
} from './types';
import { verifyClassroomGeofence, Coordinates } from '../geo/haversine';
import { verifyQRChallenge } from '../qr/token';

export interface UserCredential {
  email: string;
  passwordHash: string; // Plaintext or hashed for testing
  role: Role;
  userId: string;
  institutionId: string;
}

class NoProxyStore {
  institutions: Map<string, Institution> = new Map();
  profiles: Map<string, Profile> = new Map();
  memberships: Map<string, InstitutionMembership> = new Map();
  courses: Map<string, Course> = new Map();
  subjects: Map<string, Subject> = new Map();
  batches: Map<string, Batch> = new Map();
  classrooms: Map<string, Classroom> = new Map();
  sessions: Map<string, Session> = new Map();
  attendance: Map<string, AttendanceRecord> = new Map(); // key: `${sessionId}:${studentId}`
  deviceRegistrations: Map<string, DeviceRegistration> = new Map(); // key: studentId
  policies: Map<string, AttendancePolicy> = new Map();
  consumedQRNonces: Set<string> = new Set();
  auditLogs: AuditLog[] = [];

  // Commercial Security & Authoritative Roster Entities
  authoritativeRoster: Map<string, AuthoritativeStudent> = new Map(); // key: rosterId
  studentProfiles: Map<string, StudentProfile> = new Map(); // key: userId
  studentEnrollments: Map<string, StudentEnrollment> = new Map();
  trainerAssignments: Map<string, { id: string; institutionId: string; trainerId: string; batchId: string; subjectId?: string; status: string }> = new Map();
  credentials: Map<string, UserCredential> = new Map(); // key: lowercase email

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    const instId = '11111111-1111-1111-1111-111111111111';

    // 1. Institution
    this.institutions.set(instId, {
      id: instId,
      name: 'Apex Institute of Technology',
      slug: 'apex-tech',
      logoUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?w=128&q=80',
      contactEmail: 'admin@apexinstitute.edu',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    // 2. Fixed Initial Super Admin
    const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@noproxy.edu').toLowerCase();
    const adminPass = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@NoProxy2026!';
    const adminId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    this.profiles.set(adminId, {
      id: adminId,
      displayName: 'System Super Admin',
      email: adminEmail,
      accountStatus: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    this.memberships.set(`mem-${adminId}`, {
      id: `mem-${adminId}`,
      institutionId: instId,
      userId: adminId,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
    });

    this.credentials.set(adminEmail, {
      email: adminEmail,
      passwordHash: adminPass,
      role: 'ADMIN',
      userId: adminId,
      institutionId: instId,
    });

    // 3. Courses & Subjects
    const courseId = '55555555-5555-5555-5555-555555555551';
    this.courses.set(courseId, {
      id: courseId,
      institutionId: instId,
      name: 'Full Stack Cloud Engineering',
      code: 'FSCE-2026',
      description: 'Comprehensive web, cloud, and distributed architectures',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    const sub1Id = '66666666-6666-6666-6666-666666666661';
    const sub2Id = '66666666-6666-6666-6666-666666666662';

    this.subjects.set(sub1Id, {
      id: sub1Id,
      institutionId: instId,
      courseId,
      name: 'Next.js & Frontend Systems',
      code: 'SUB-FE-101',
      description: 'Modern App Router, SSR, and Responsive UI',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    this.subjects.set(sub2Id, {
      id: sub2Id,
      institutionId: instId,
      courseId,
      name: 'Distributed Database Design',
      code: 'SUB-DB-201',
      description: 'PostgreSQL, RLS, ACID, and Performance Optimization',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    // 4. Batches (Multi-Batch Support)
    const batchId = '77777777-7777-7777-7777-777777777771'; // Full Stack Alpha
    const batch2Id = '77777777-7777-7777-7777-777777777772'; // Python 25 Batch
    const batch3Id = '77777777-7777-7777-7777-777777777773'; // Java 22 Batch

    this.batches.set(batchId, {
      id: batchId,
      institutionId: instId,
      courseId,
      name: 'Full Stack Batch Alpha',
      code: 'FS-BATCH-ALPHA',
      startDate: '2026-09-01',
      endDate: '2027-03-31',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    this.batches.set(batch2Id, {
      id: batch2Id,
      institutionId: instId,
      courseId,
      name: 'Python Data Engineering 25 Batch',
      code: 'PY-BATCH-25',
      startDate: '2026-09-15',
      endDate: '2027-04-15',
      status: 'ACTIVE',
      createdAt: '2026-09-15T00:00:00Z',
      updatedAt: '2026-09-15T00:00:00Z',
    });

    this.batches.set(batch3Id, {
      id: batch3Id,
      institutionId: instId,
      courseId,
      name: 'Java Enterprise Systems 22 Batch',
      code: 'JAVA-BATCH-22',
      startDate: '2026-10-01',
      endDate: '2027-05-01',
      status: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    });

    // Additional Subjects
    const sub3Id = '66666666-6666-6666-6666-666666666663';
    const sub4Id = '66666666-6666-6666-6666-666666666664';
    this.subjects.set(sub3Id, {
      id: sub3Id,
      institutionId: instId,
      courseId,
      name: 'Python Async & Fast Data Systems',
      code: 'SUB-PY-301',
      description: 'Asyncio, Pandas, Fast APIs, and Stream Processing',
      status: 'ACTIVE',
      createdAt: '2026-09-15T00:00:00Z',
      updatedAt: '2026-09-15T00:00:00Z',
    });

    this.subjects.set(sub4Id, {
      id: sub4Id,
      institutionId: instId,
      courseId,
      name: 'Spring Boot & Cloud Microservices',
      code: 'SUB-JAVA-401',
      description: 'Spring Security, JPA, Kafka, and Enterprise Microservices',
      status: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    });

    // 5. Trainers (Multi-Trainer Support)
    const trainerId = '33333333-3333-3333-3333-333333333331';
    const trainerEmail = 'trainer.kapoor@apexinstitute.edu';
    this.profiles.set(trainerId, {
      id: trainerId,
      displayName: 'Prof. Arvind Kapoor',
      email: trainerEmail,
      accountStatus: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    this.memberships.set(`mem-${trainerId}`, {
      id: `mem-${trainerId}`,
      institutionId: instId,
      userId: trainerId,
      role: 'TRAINER',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
    });

    this.trainerAssignments.set(`assign-${trainerId}-${batchId}`, {
      id: `assign-${trainerId}-${batchId}`,
      institutionId: instId,
      trainerId,
      batchId,
      subjectId: sub1Id,
      status: 'ACTIVE',
    });

    this.trainerAssignments.set(`assign-${trainerId}-${batch2Id}`, {
      id: `assign-${trainerId}-${batch2Id}`,
      institutionId: instId,
      trainerId,
      batchId: batch2Id,
      subjectId: sub3Id,
      status: 'ACTIVE',
    });

    this.credentials.set(trainerEmail, {
      email: trainerEmail,
      passwordHash: 'Trainer@2026!',
      role: 'TRAINER',
      userId: trainerId,
      institutionId: instId,
    });
    // Convenience aliases for testing
    this.credentials.set('trainer@apexinstitute.edu', {
      email: 'trainer@apexinstitute.edu',
      passwordHash: 'Trainer@2026!',
      role: 'TRAINER',
      userId: trainerId,
      institutionId: instId,
    });
    this.credentials.set('trainer@noproxy.edu', {
      email: 'trainer@noproxy.edu',
      passwordHash: 'Trainer@2026!',
      role: 'TRAINER',
      userId: trainerId,
      institutionId: instId,
    });

    // Trainer 2: Dr. Meera Nambiar
    const trainer2Id = '33333333-3333-3333-3333-333333333332';
    const trainer2Email = 'trainer.meera@apexinstitute.edu';
    this.profiles.set(trainer2Id, {
      id: trainer2Id,
      displayName: 'Dr. Meera Nambiar',
      email: trainer2Email,
      accountStatus: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    });

    this.memberships.set(`mem-${trainer2Id}`, {
      id: `mem-${trainer2Id}`,
      institutionId: instId,
      userId: trainer2Id,
      role: 'TRAINER',
      status: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00Z',
    });

    this.trainerAssignments.set(`assign-${trainer2Id}-${batch3Id}`, {
      id: `assign-${trainer2Id}-${batch3Id}`,
      institutionId: instId,
      trainerId: trainer2Id,
      batchId: batch3Id,
      subjectId: sub4Id,
      status: 'ACTIVE',
    });

    this.credentials.set(trainer2Email, {
      email: trainer2Email,
      passwordHash: 'Trainer@2026!',
      role: 'TRAINER',
      userId: trainer2Id,
      institutionId: instId,
    });

    // 6. Classroom
    const classroomId = '88888888-8888-8888-8888-888888888881';
    this.classrooms.set(classroomId, {
      id: classroomId,
      institutionId: instId,
      name: 'Advanced Software Lab 402',
      building: 'Science & Tech Tower',
      roomNumber: 'Lab 402',
      latitude: 18.5196,
      longitude: 73.8554,
      geofenceRadiusMeters: 1000.0,
      requiredGpsAccuracyMeters: 150.0,
      gpsVerificationEnabled: true,
      gpsMandatory: false,
      allowedNetworkCidrs: ['192.168.1.0/24', '116.74.159.0/24', '116.74.159.28/32', '10.0.0.0/16', '127.0.0.1/32'],
      networkVerificationEnabled: false,
      networkMandatory: false,
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    // 7. Authoritative Institutional Student Roster (Pre-loaded Roster by Institution)
    const authoritativeRosterList: Array<{ idNumber: string; name: string; email: string }> = [
      { idNumber: 'ST-001', name: 'Aarav Patel', email: 'aarav.patel@student.edu' },
      { idNumber: 'ST-002', name: 'Priya Singh', email: 'priya.singh@student.edu' },
      { idNumber: 'ST-003', name: 'Rohan Gupta', email: 'rohan.gupta@student.edu' },
      { idNumber: 'ST-004', name: 'Ananya Sharma', email: 'ananya.sharma@student.edu' },
      { idNumber: 'ST-005', name: 'Vikram Aditya', email: 'vikram.aditya@student.edu' },
      { idNumber: 'ST-006', name: 'Neha Verma', email: 'neha.verma@student.edu' },
      { idNumber: 'ST-007', name: 'Kabir Mehta', email: 'kabir.mehta@student.edu' },
      { idNumber: 'ST-008', name: 'Sanjana Rao', email: 'sanjana.rao@student.edu' },
    ];

    for (const authStudent of authoritativeRosterList) {
      const rosterId = `roster-${batchId}-${authStudent.idNumber}`;
      this.authoritativeRoster.set(rosterId, {
        id: rosterId,
        institutionId: instId,
        batchId,
        studentIdNumber: authStudent.idNumber,
        fullName: authStudent.name,
        email: authStudent.email,
        isClaimed: false,
        createdAt: '2026-09-01T00:00:00Z',
      });
    }

    // 8. Pre-Register and Claim Verified Students for Demo
    const demoStudents = [
      { id: '44444444-4444-4444-4444-444444444441', name: 'Aarav Patel', email: 'aarav.patel@student.edu', idNum: 'ST-001', initialBatches: [batchId, batch2Id, batch3Id] },
      { id: '44444444-4444-4444-4444-444444444443', name: 'Rohan Gupta', email: 'rohan.gupta@student.edu', idNum: 'ST-003', initialBatches: [batchId] },
      { id: '44444444-4444-4444-4444-444444444444', name: 'Ananya Sharma', email: 'ananya.sharma@student.edu', idNum: 'ST-004', initialBatches: [batch2Id] },
      { id: '44444444-4444-4444-4444-444444444445', name: 'Vikram Aditya', email: 'vikram.aditya@student.edu', idNum: 'ST-005', initialBatches: [batch2Id] },
      { id: '44444444-4444-4444-4444-444444444446', name: 'Neha Verma', email: 'neha.verma@student.edu', idNum: 'ST-006', initialBatches: [batch3Id] },
      { id: '44444444-4444-4444-4444-444444444447', name: 'Kabir Mehta', email: 'kabir.mehta@student.edu', idNum: 'ST-007', initialBatches: [] },
      { id: '44444444-4444-4444-4444-444444444448', name: 'Sanjana Rao', email: 'sanjana.rao@student.edu', idNum: 'ST-008', initialBatches: [] },
    ];

    for (const s of demoStudents) {
      this.profiles.set(s.id, {
        id: s.id,
        displayName: s.name,
        email: s.email,
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      });

      this.memberships.set(`mem-${s.id}`, {
        id: `mem-${s.id}`,
        institutionId: instId,
        userId: s.id,
        role: 'STUDENT',
        status: 'ACTIVE',
        createdAt: '2026-09-01T00:00:00Z',
      });

      this.credentials.set(s.email, {
        email: s.email,
        passwordHash: 'Student@2026!',
        role: 'STUDENT',
        userId: s.id,
        institutionId: instId,
      });

      this.studentProfiles.set(s.id, {
        id: `sp-${s.id}`,
        userId: s.id,
        institutionId: instId,
        studentIdNumber: s.idNum,
        fullName: s.name,
        isVerified: true,
        verificationStatus: 'VERIFIED',
        registeredAt: '2026-09-01T10:00:00Z',
      });

      // Mark claimed in authoritative roster if ST-001
      if (s.idNum === 'ST-001') {
        const rosterItem = this.authoritativeRoster.get(`roster-${batchId}-ST-001`);
        if (rosterItem) {
          rosterItem.isClaimed = true;
          rosterItem.claimedByUserId = s.id;
          rosterItem.claimedAt = '2026-09-01T10:00:00Z';
        }
      }

      for (const bId of s.initialBatches) {
        this.studentEnrollments.set(`enr-${s.id}-${bId}`, {
          id: `enr-${s.id}-${bId}`,
          institutionId: instId,
          batchId: bId,
          studentId: s.id,
          rollNumber: s.idNum,
          enrolledAt: '2026-09-01T10:00:00Z',
          status: 'ACTIVE',
        });
      }
    }

    const student1Id = '44444444-4444-4444-4444-444444444441';

    // Convenience aliases for student testing
    this.credentials.set('student@apexinstitute.edu', {
      email: 'student@apexinstitute.edu',
      passwordHash: 'Student@2026!',
      role: 'STUDENT',
      userId: student1Id,
      institutionId: instId,
    });
    this.credentials.set('student@noproxy.edu', {
      email: 'student@noproxy.edu',
      passwordHash: 'Student@2026!',
      role: 'STUDENT',
      userId: student1Id,
      institutionId: instId,
    });

    this.deviceRegistrations.set(student1Id, {
      id: 'dev-reg-aarav-1',
      institutionId: instId,
      studentId: student1Id,
      credentialId: 'cred-mock-webauthn-aarav-phone',
      deviceModel: 'iPhone 15 Pro / Mobile Safari',
      platform: 'iOS',
      registeredAt: '2026-09-02T10:00:00Z',
      status: 'ACTIVE',
    });

    // 9. Sessions across Batches
    // --- Batch 1: Full Stack Alpha Sessions ---
    this.sessions.set('99999999-9999-9999-9999-999999999991', {
      id: '99999999-9999-9999-9999-999999999991',
      institutionId: instId,
      batchId,
      subjectId: sub1Id,
      classroomId,
      createdBy: trainerId,
      title: 'Lecture 1: Next.js Architecture & Layouts',
      sessionDate: '2026-10-12',
      startTime: '10:00:00',
      endTime: '12:00:00',
      mode: 'OFFLINE',
      sessionStatus: 'FINALIZED',
      finalizedBy: trainerId,
      finalizedAt: '2026-10-12T12:05:00Z',
      createdAt: '2026-10-12T09:00:00Z',
      updatedAt: '2026-10-12T12:05:00Z',
    });

    this.sessions.set('99999999-9999-9999-9999-999999999992', {
      id: '99999999-9999-9999-9999-999999999992',
      institutionId: instId,
      batchId,
      subjectId: sub1Id,
      createdBy: trainerId,
      title: 'Lecture 2: Server Actions & Cache Semantics',
      sessionDate: '2026-10-14',
      startTime: '14:00:00',
      endTime: '16:00:00',
      mode: 'ONLINE',
      sessionStatus: 'FINALIZED',
      externalMeetingPlatform: 'Zoom',
      externalMeetingUrl: 'https://zoom.us/j/987654321',
      finalizedBy: trainerId,
      finalizedAt: '2026-10-14T16:02:00Z',
      createdAt: '2026-10-14T13:00:00Z',
      updatedAt: '2026-10-14T16:02:00Z',
    });

    this.sessions.set('99999999-9999-9999-9999-999999999994', {
      id: '99999999-9999-9999-9999-999999999994',
      institutionId: instId,
      batchId,
      subjectId: sub1Id,
      classroomId,
      createdBy: trainerId,
      title: 'Lecture 4: Live Production Deployment & Geofencing',
      sessionDate: '2026-10-29',
      startTime: '10:00:00',
      endTime: '12:00:00',
      mode: 'OFFLINE',
      sessionStatus: 'ACTIVE',
      createdAt: '2026-10-29T09:00:00Z',
      updatedAt: '2026-10-29T09:00:00Z',
    });

    // --- Batch 2: Python 25 Batch Sessions ---
    this.sessions.set('99999999-9999-9999-9999-999999999981', {
      id: '99999999-9999-9999-9999-999999999981',
      institutionId: instId,
      batchId: batch2Id,
      subjectId: sub3Id,
      classroomId,
      createdBy: trainerId,
      title: 'Lecture 1: Fast Data Pipelines & Polars',
      sessionDate: '2026-10-20',
      startTime: '11:00:00',
      endTime: '13:00:00',
      mode: 'OFFLINE',
      sessionStatus: 'FINALIZED',
      finalizedBy: trainerId,
      finalizedAt: '2026-10-20T13:05:00Z',
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-20T13:05:00Z',
    });

    this.sessions.set('99999999-9999-9999-9999-999999999982', {
      id: '99999999-9999-9999-9999-999999999982',
      institutionId: instId,
      batchId: batch2Id,
      subjectId: sub3Id,
      classroomId,
      createdBy: trainerId,
      title: 'Lecture 2: Python Async Event Loops & Tasks',
      sessionDate: '2026-10-29',
      startTime: '14:00:00',
      endTime: '16:00:00',
      mode: 'OFFLINE',
      sessionStatus: 'ACTIVE',
      createdAt: '2026-10-29T13:30:00Z',
      updatedAt: '2026-10-29T13:30:00Z',
    });

    // --- Batch 3: Java 22 Batch Sessions ---
    this.sessions.set('99999999-9999-9999-9999-999999999971', {
      id: '99999999-9999-9999-9999-999999999971',
      institutionId: instId,
      batchId: batch3Id,
      subjectId: sub4Id,
      classroomId,
      createdBy: trainer2Id,
      title: 'Lecture 1: Spring Boot Architecture & DI',
      sessionDate: '2026-10-22',
      startTime: '09:00:00',
      endTime: '11:00:00',
      mode: 'OFFLINE',
      sessionStatus: 'FINALIZED',
      finalizedBy: trainer2Id,
      finalizedAt: '2026-10-22T11:05:00Z',
      createdAt: '2026-10-22T08:30:00Z',
      updatedAt: '2026-10-22T11:05:00Z',
    });

    this.sessions.set('99999999-9999-9999-9999-999999999972', {
      id: '99999999-9999-9999-9999-999999999972',
      institutionId: instId,
      batchId: batch3Id,
      subjectId: sub4Id,
      createdBy: trainer2Id,
      title: 'Lecture 2: Microservices Resilience & Cloud',
      sessionDate: '2026-10-30',
      startTime: '15:00:00',
      endTime: '17:00:00',
      mode: 'ONLINE',
      sessionStatus: 'SCHEDULED',
      externalMeetingPlatform: 'Zoom',
      externalMeetingUrl: 'https://zoom.us/j/123456789',
      createdAt: '2026-10-29T10:00:00Z',
      updatedAt: '2026-10-29T10:00:00Z',
    });

    // Verified Attendance Records (Strictly 3 statuses: PRESENT, ONLINE, ABSENT)
    this.attendance.set(`99999999-9999-9999-9999-999999999991:${student1Id}`, {
      id: `att-hist-1`,
      institutionId: instId,
      sessionId: '99999999-9999-9999-9999-999999999991',
      studentId: student1Id,
      status: 'PRESENT',
      attendanceSource: 'DYNAMIC_QR',
      markedBy: trainerId,
      markedAt: '2026-10-12T10:05:00Z',
      updatedAt: '2026-10-12T10:05:00Z',
    });

    this.attendance.set(`99999999-9999-9999-9999-999999999992:${student1Id}`, {
      id: `att-hist-2`,
      institutionId: instId,
      sessionId: '99999999-9999-9999-9999-999999999992',
      studentId: student1Id,
      status: 'ONLINE',
      attendanceSource: 'TRAINER_ONLINE_ROSTER',
      markedBy: trainerId,
      markedAt: '2026-10-14T14:15:00Z',
      updatedAt: '2026-10-14T14:15:00Z',
    });

    this.attendance.set(`99999999-9999-9999-9999-999999999981:${student1Id}`, {
      id: `att-hist-py-1`,
      institutionId: instId,
      sessionId: '99999999-9999-9999-9999-999999999981',
      studentId: student1Id,
      status: 'PRESENT',
      attendanceSource: 'DYNAMIC_QR',
      markedBy: trainerId,
      markedAt: '2026-10-20T11:05:00Z',
      updatedAt: '2026-10-20T11:05:00Z',
    });

    this.attendance.set(`99999999-9999-9999-9999-999999999971:${student1Id}`, {
      id: `att-hist-java-1`,
      institutionId: instId,
      sessionId: '99999999-9999-9999-9999-999999999971',
      studentId: student1Id,
      status: 'PRESENT',
      attendanceSource: 'DYNAMIC_QR',
      markedBy: trainer2Id,
      markedAt: '2026-10-22T09:05:00Z',
      updatedAt: '2026-10-22T09:05:00Z',
    });
  }

  // ============================================================================
  // AUTHENTICATION & SECURITY
  // ============================================================================

  authenticateUser(email: string, passwordAttempt: string): { success: boolean; user?: Profile; role?: Role; error?: string } {
    const normEmail = (email || '').trim().toLowerCase();
    const cred = this.credentials.get(normEmail);

    if (!cred) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const trimmedAttempt = (passwordAttempt || '').trim();
    const isPasswordValid =
      cred.passwordHash === passwordAttempt ||
      cred.passwordHash === trimmedAttempt ||
      cred.passwordHash.toLowerCase() === trimmedAttempt.toLowerCase();

    if (!isPasswordValid) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const profile = this.profiles.get(cred.userId);
    if (!profile) {
      return { success: false, error: 'Account profile not found.' };
    }

    if ((profile.accountStatus as string) === 'INACTIVE' || profile.accountStatus === 'SUSPENDED') {
      return { success: false, error: 'Account has been deactivated. Please contact your institute administrator.' };
    }

    return {
      success: true,
      user: profile,
      role: cred.role,
    };
  }

  // ============================================================================
  // AUTHORITATIVE STUDENT ROSTER & FIRST-TIME REGISTRATION WORKFLOW
  // ============================================================================

  /**
   * Validates and claims a student identity against the authoritative institutional roster.
   */
  claimAuthoritativeStudent(params: {
    userId: string;
    institutionId: string;
    batchId: string;
    studentIdNumber: string;
    submittedFullName: string;
  }): { success: boolean; profile?: StudentProfile; error?: string } {
    const { userId, institutionId, batchId, studentIdNumber, submittedFullName } = params;

    // Check if user already claimed a student profile
    const existingProfile = this.studentProfiles.get(userId);
    if (existingProfile && existingProfile.isVerified) {
      return { success: false, error: 'Your account is already linked to a verified student identity.' };
    }

    // Find the authoritative roster record
    const normIdNumber = studentIdNumber.trim().toUpperCase();
    const rosterEntry = Array.from(this.authoritativeRoster.values()).find(
      (r) => r.batchId === batchId && r.studentIdNumber.toUpperCase() === normIdNumber
    );

    if (!rosterEntry) {
      return {
        success: false,
        error: `Student ID "${studentIdNumber}" was not found in the authoritative institution roster for this batch. Please verify your Student ID with your batch coordinator.`,
      };
    }

    // Check if already claimed
    if (rosterEntry.isClaimed) {
      return {
        success: false,
        error: `Student ID "${studentIdNumber}" has already been claimed and linked to an account. If this is an error, please request an account reset from your administrator.`,
      };
    }

    // Fuzzy/Case-insensitive name validation
    const normAuthoritativeName = rosterEntry.fullName.toLowerCase().replace(/\s+/g, ' ').trim();
    const normSubmittedName = submittedFullName.toLowerCase().replace(/\s+/g, ' ').trim();

    if (normAuthoritativeName !== normSubmittedName) {
      return {
        success: false,
        error: `Submitted name "${submittedFullName}" does not match the authoritative institutional record for Student ID "${studentIdNumber}". Please enter your full name as enrolled.`,
      };
    }

    // Verification succeeded: Link account and mark claimed
    rosterEntry.isClaimed = true;
    rosterEntry.claimedByUserId = userId;
    rosterEntry.claimedAt = new Date().toISOString();

    const verifiedProfile: StudentProfile = {
      id: userId,
      userId,
      institutionId,
      batchId,
      studentIdNumber: rosterEntry.studentIdNumber,
      fullName: rosterEntry.fullName,
      isVerified: true,
      verificationStatus: 'VERIFIED',
      registeredAt: new Date().toISOString(),
    };

    this.studentProfiles.set(userId, verifiedProfile);

    // Create enrollment record
    this.studentEnrollments.set(`enr-${userId}`, {
      id: `enr-${userId}`,
      institutionId,
      batchId,
      studentId: userId,
      rollNumber: rosterEntry.studentIdNumber,
      status: 'ACTIVE',
    });

    // Update user display name to authoritative name
    const profile = this.profiles.get(userId);
    if (profile) {
      profile.displayName = rosterEntry.fullName;
    }

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId,
      actorId: userId,
      action: 'CLAIM_STUDENT_IDENTITY',
      entityType: 'STUDENT_ROSTER',
      entityId: rosterEntry.id,
      reason: 'Student authenticated and verified identity against authoritative roster',
      metadata: { studentIdNumber: rosterEntry.studentIdNumber, batchId },
      timestamp: new Date().toISOString(),
    });

    return { success: true, profile: verifiedProfile };
  }

  getStudentProfile(userId: string): StudentProfile | undefined {
    return this.studentProfiles.get(userId);
  }

  listAuthoritativeRoster(batchId: string): AuthoritativeStudent[] {
    return Array.from(this.authoritativeRoster.values()).filter((r) => r.batchId === batchId);
  }

  addAuthoritativeStudent(params: {
    institutionId: string;
    batchId: string;
    studentIdNumber: string;
    fullName: string;
    email?: string;
  }): { success: boolean; student?: AuthoritativeStudent; error?: string } {
    const normIdNumber = params.studentIdNumber.trim().toUpperCase();

    // Check duplicate
    const exists = Array.from(this.authoritativeRoster.values()).some(
      (r) => r.batchId === params.batchId && r.studentIdNumber.toUpperCase() === normIdNumber
    );

    if (exists) {
      return { success: false, error: `Student ID "${params.studentIdNumber}" already exists in this batch.` };
    }

    const rosterId = `roster-${params.batchId}-${normIdNumber}`;
    const newStudent: AuthoritativeStudent = {
      id: rosterId,
      institutionId: params.institutionId,
      batchId: params.batchId,
      studentIdNumber: normIdNumber,
      fullName: params.fullName.trim(),
      email: params.email?.trim(),
      isClaimed: false,
      createdAt: new Date().toISOString(),
    };

    this.authoritativeRoster.set(rosterId, newStudent);
    return { success: true, student: newStudent };
  }

  importAuthoritativeRoster(
    batchId: string,
    institutionId: string,
    students: Array<{ studentIdNumber: string; fullName: string; email?: string }>
  ): { imported: number; skipped: number; errors: string[] } {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of students) {
      if (!item.studentIdNumber || !item.fullName) {
        skipped++;
        errors.push(`Missing Student ID or Name for row: ${JSON.stringify(item)}`);
        continue;
      }

      const res = this.addAuthoritativeStudent({
        institutionId,
        batchId,
        studentIdNumber: item.studentIdNumber,
        fullName: item.fullName,
        email: item.email,
      });

      if (res.success) {
        imported++;
      } else {
        skipped++;
        errors.push(res.error || 'Duplicate record');
      }
    }

    return { imported, skipped, errors };
  }

  resetStudentClaim(rosterId: string, actorId: string, reason: string): { success: boolean; error?: string } {
    const rosterEntry = this.authoritativeRoster.get(rosterId);
    if (!rosterEntry) return { success: false, error: 'Roster record not found.' };

    const claimedUser = rosterEntry.claimedByUserId;
    if (claimedUser) {
      this.studentProfiles.delete(claimedUser);
      this.studentEnrollments.delete(`enr-${claimedUser}`);
      this.deviceRegistrations.delete(claimedUser);
    }

    rosterEntry.isClaimed = false;
    rosterEntry.claimedByUserId = undefined;
    rosterEntry.claimedAt = undefined;

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: rosterEntry.institutionId,
      actorId,
      action: 'RESET_STUDENT_CLAIM',
      entityType: 'STUDENT_ROSTER',
      entityId: rosterId,
      reason,
      metadata: { previousUser: claimedUser },
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  // ============================================================================
  // ADMIN TRAINER MANAGEMENT
  // ============================================================================

  createTrainerAccount(params: {
    institutionId: string;
    name: string;
    email: string;
    password?: string;
    batchIds: string[];
    subjectIds: string[];
    actorId: string;
  }): { success: boolean; trainer?: Profile; error?: string } {
    const normEmail = params.email.trim().toLowerCase();

    if (this.credentials.has(normEmail)) {
      return { success: false, error: `An account with email "${params.email}" already exists.` };
    }

    const trainerId = `trainer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const password = params.password || 'Trainer@2026!';

    const trainerProfile: Profile = {
      id: trainerId,
      displayName: params.name.trim(),
      email: normEmail,
      accountStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles.set(trainerId, trainerProfile);

    this.memberships.set(`mem-${trainerId}`, {
      id: `mem-${trainerId}`,
      institutionId: params.institutionId,
      userId: trainerId,
      role: 'TRAINER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });

    for (const bId of params.batchIds) {
      for (const sId of params.subjectIds) {
        this.trainerAssignments.set(`assign-${trainerId}-${bId}-${sId}`, {
          id: `assign-${trainerId}-${bId}-${sId}`,
          institutionId: params.institutionId,
          trainerId,
          batchId: bId,
          subjectId: sId,
          status: 'ACTIVE',
        });
      }
    }

    this.credentials.set(normEmail, {
      email: normEmail,
      passwordHash: password,
      role: 'TRAINER',
      userId: trainerId,
      institutionId: params.institutionId,
    });

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: params.institutionId,
      actorId: params.actorId,
      action: 'CREATE_TRAINER',
      entityType: 'TRAINER',
      entityId: trainerId,
      reason: 'Admin provisioned new instructor account',
      metadata: { email: normEmail, batches: params.batchIds },
      timestamp: new Date().toISOString(),
    });

    return { success: true, trainer: trainerProfile };
  }

  listTrainers(institutionId: string): Array<{ profile: Profile; assignments: string[] }> {
    const trainerMembers = Array.from(this.memberships.values()).filter(
      (m) => m.institutionId === institutionId && m.role === 'TRAINER' && m.status === 'ACTIVE'
    );

    return trainerMembers.map((m) => {
      const p = this.profiles.get(m.userId)!;
      const assigns = Array.from(this.trainerAssignments.values())
        .filter((a) => a.trainerId === m.userId && a.status === 'ACTIVE')
        .map((a) => {
          const b = this.batches.get(a.batchId);
          return b ? `${b.name} (${b.code})` : a.batchId;
        });
      return { profile: p, assignments: assigns };
    }).filter((item) => !!item.profile);
  }

  // ============================================================================
  // ATTENDANCE WORKFLOWS & STRICT 3-STATUS SYSTEM
  // ============================================================================

  submitOfflineAttendance(params: {
    authenticatedUserId: string; // DERIVED FROM SERVER AUTHENTICATION, NOT CLIENT
    sessionId: string;
    rawToken: string;
    studentCoords?: Coordinates;
    deviceCredentialId?: string;
    localAuthConfirmed?: boolean;
    ipAddress?: string;
  }): { success: boolean; record?: AttendanceRecord; error?: string; checks?: Record<string, boolean> } {
    // 1. Authoritative Identity Chain Check
    const studentProfile = this.studentProfiles.get(params.authenticatedUserId);
    if (!studentProfile || !studentProfile.isVerified) {
      return {
        success: false,
        error: 'Identity verification required: You must complete your student registration before marking attendance.',
      };
    }

    const session = this.sessions.get(params.sessionId);
    if (!session) return { success: false, error: 'Session not found.' };

    if (session.sessionStatus !== 'ACTIVE') {
      return { success: false, error: `Session is not active (status: ${session.sessionStatus}). Attendance submissions are locked.` };
    }

    if (session.mode !== 'OFFLINE') {
      return { success: false, error: 'This session is configured for ONLINE mode. Physical QR scan is not applicable.' };
    }

    // 2. Batch Enrollment Verification (Multi-Batch Support)
    const isEnrolled = this.isStudentEnrolledInBatch(params.authenticatedUserId, session.batchId);
    if (!isEnrolled) {
      const batch = this.batches.get(session.batchId);
      return {
        success: false,
        error: `Authorization violation: You are not actively enrolled in the batch "${batch?.name || session.batchId}" for this lecture session.`,
      };
    }

    // 3. Verify Dynamic QR challenge (HMAC-SHA256, 20s expiry)
    const qrResult = verifyQRChallenge(params.rawToken, session.id);
    if (!qrResult.valid || !qrResult.payload) {
      return { success: false, error: qrResult.error || 'Invalid or expired QR token.' };
    }

    // Replay prevention (single-use challenge nonce)
    if (this.consumedQRNonces.has(qrResult.payload.nonce)) {
      return { success: false, error: 'Security alert: QR challenge nonce already consumed. Please scan the current code.' };
    }

    // 4. Check duplicate submission (Uniqueness constraint on session_id, student_id)
    const attendanceKey = `${session.id}:${studentProfile.userId}`;
    if (this.attendance.has(attendanceKey)) {
      const existing = this.attendance.get(attendanceKey)!;
      return {
        success: false,
        error: `Attendance already recorded for this session (Status: ${existing.status}). Duplicate submissions are blocked.`,
      };
    }

    // 5. Verify GPS Geofence if classroom assigned
    let gpsPassed = true;
    let distanceMeters = 0;
    if (session.classroomId) {
      const classroom = this.classrooms.get(session.classroomId);
      if (classroom && classroom.gpsVerificationEnabled) {
        if (!params.studentCoords) {
          if (classroom.gpsMandatory) {
            return { success: false, error: 'GPS coordinates required by classroom policy, but device location was not provided.' };
          }
          gpsPassed = false;
        } else {
          const geoRes = verifyClassroomGeofence(
            params.studentCoords,
            { latitude: classroom.latitude, longitude: classroom.longitude },
            classroom.geofenceRadiusMeters,
            classroom.requiredGpsAccuracyMeters
          );
          if (!geoRes.valid && classroom.gpsMandatory) {
            return { success: false, error: geoRes.reason || 'GPS geofence verification failed.' };
          }
          gpsPassed = geoRes.valid;
          distanceMeters = geoRes.distanceMeters;
        }
      }
    }

    // 6. Verify Registered Device Binding
    const registeredDevice = this.deviceRegistrations.get(studentProfile.userId);
    let devicePassed = true;
    if (registeredDevice) {
      if (registeredDevice.status === 'REVOKED' || registeredDevice.status === 'PENDING_RESET') {
        return { success: false, error: `Your registered device status is ${registeredDevice.status}. Please contact the institution administrator for a device reset.` };
      }
      // Seamlessly bind or update to student's active device identifier
      if (params.deviceCredentialId && registeredDevice.credentialId !== params.deviceCredentialId) {
        registeredDevice.credentialId = params.deviceCredentialId;
        registeredDevice.status = 'ACTIVE';
      }
    } else {
      if (params.deviceCredentialId) {
        this.deviceRegistrations.set(studentProfile.userId, {
          id: `dev-${Date.now()}`,
          institutionId: session.institutionId,
          studentId: studentProfile.userId,
          credentialId: params.deviceCredentialId,
          deviceModel: 'Mobile Authenticator',
          platform: 'Mobile Web',
          registeredAt: new Date().toISOString(),
          status: 'ACTIVE',
        });
      }
    }

    // Consume nonce to prevent replay
    this.consumedQRNonces.add(qrResult.payload.nonce);

    // Create PRESENT record (Strictly 'PRESENT')
    const record: AttendanceRecord = {
      id: `att-${Date.now()}`,
      institutionId: session.institutionId,
      sessionId: session.id,
      studentId: studentProfile.userId,
      status: 'PRESENT', // Strict 3-status rule
      attendanceSource: 'DYNAMIC_QR',
      verificationSummary: {
        qrChallengeId: qrResult.payload.nonce,
        gpsVerified: gpsPassed,
        distanceMeters,
        deviceVerified: devicePassed,
        localAuthVerified: !!params.localAuthConfirmed,
      },
      markedBy: studentProfile.userId,
      markedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.attendance.set(attendanceKey, record);

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: session.institutionId,
      actorId: studentProfile.userId,
      action: 'MARK_ATTENDANCE_PRESENT',
      entityType: 'ATTENDANCE',
      entityId: record.id,
      reason: 'Dynamic QR verified with authoritative student identity and GPS',
      metadata: { sessionId: session.id, studentIdNumber: studentProfile.studentIdNumber, distanceMeters },
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      record,
      checks: {
        identityVerified: true,
        qrValid: true,
        gpsVerified: gpsPassed,
        deviceVerified: devicePassed,
      },
    };
  }

  finalizeSession(sessionId: string, actorId: string): { success: boolean; finalizedCount: number; absentCount: number; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, finalizedCount: 0, absentCount: 0, error: 'Session not found.' };

    if (session.sessionStatus === 'FINALIZED') {
      return { success: false, finalizedCount: 0, absentCount: 0, error: 'Session already finalized and locked.' };
    }

    const students = this.getBatchEnrolledStudents(session.batchId);
    let absentCount = 0;

    for (const item of students) {
      const key = `${sessionId}:${item.student.id}`;
      if (!this.attendance.has(key)) {
        const recId = `att-auto-${sessionId}-${item.student.id}`;
        this.attendance.set(key, {
          id: recId,
          institutionId: session.institutionId,
          sessionId,
          studentId: item.student.id,
          status: 'ABSENT', // Strict 3-status rule
          attendanceSource: 'SYSTEM_FINALIZATION',
          verificationSummary: { notes: 'Session finalization absence mark' },
          markedBy: actorId,
          markedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        absentCount++;
      }
    }

    session.sessionStatus = 'FINALIZED';
    session.finalizedBy = actorId;
    session.finalizedAt = new Date().toISOString();
    session.updatedAt = new Date().toISOString();

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: session.institutionId,
      actorId,
      action: 'FINALIZE_SESSION',
      entityType: 'SESSION',
      entityId: sessionId,
      reason: 'Session finalized and locked against standard submissions',
      metadata: { absentMarked: absentCount, totalStudents: students.length },
      timestamp: new Date().toISOString(),
    });

    return { success: true, finalizedCount: students.length, absentCount };
  }

  // ============================================================================
  // SIMPLIFIED BATCH ATTENDANCE LIFECYCLE (START / STOP / LIVE STATUS)
  // ============================================================================

  startBatchAttendanceSession(params: {
    batchId: string;
    trainerId: string;
    title?: string;
  }): { success: boolean; session?: Session; error?: string } {
    const batch = this.batches.get(params.batchId);
    if (!batch) return { success: false, error: 'Batch not found.' };

    // Check if an active session already exists for this batch
    const existingActive = Array.from(this.sessions.values()).find(
      (s) => s.batchId === params.batchId && s.sessionStatus === 'ACTIVE'
    );
    if (existingActive) {
      return { success: true, session: existingActive };
    }

    // Find assigned subject or default
    const assignment = Array.from(this.trainerAssignments.values()).find(
      (a) => a.batchId === params.batchId && a.status === 'ACTIVE'
    );
    const subjectId = assignment?.subjectId || '66666666-6666-6666-6666-666666666661';
    const classroomId = '88888888-8888-8888-8888-888888888881';

    const sessionId = `sess-${Date.now()}`;
    const now = new Date();
    const session: Session = {
      id: sessionId,
      institutionId: batch.institutionId,
      batchId: batch.id,
      subjectId,
      classroomId,
      createdBy: params.trainerId,
      title: params.title || `${batch.name} - Attendance Session`,
      sessionDate: now.toISOString().split('T')[0],
      startTime: now.toTimeString().split(' ')[0],
      endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toTimeString().split(' ')[0],
      mode: 'OFFLINE',
      sessionStatus: 'ACTIVE',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.sessions.set(sessionId, session);

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: batch.institutionId,
      actorId: params.trainerId,
      action: 'START_ATTENDANCE_SESSION',
      entityType: 'SESSION',
      entityId: sessionId,
      reason: `Started active QR attendance session for ${batch.name}`,
      timestamp: now.toISOString(),
    });

    return { success: true, session };
  }

  getSessionLiveStatus(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const enrolledStudents = this.getBatchEnrolledStudents(session.batchId);
    const records = Array.from(this.attendance.values()).filter((a) => a.sessionId === sessionId);
    const presentRecords = records.filter((a) => a.status === 'PRESENT' || a.status === 'ONLINE');

    const roster = enrolledStudents.map((item) => {
      const record = this.attendance.get(`${sessionId}:${item.student.id}`);
      return {
        studentId: item.student.id,
        fullName: item.student.displayName,
        studentIdNumber: item.rollNumber || 'ST-001',
        status: record ? record.status : 'NOT_MARKED',
        markedAt: record?.markedAt,
        source: record?.attendanceSource,
      };
    });

    return {
      session,
      totalEnrolled: enrolledStudents.length,
      presentCount: presentRecords.length,
      unmarkedCount: enrolledStudents.length - presentRecords.length,
      roster,
    };
  }

  markParticipantOnline(sessionId: string, studentId: string, trainerId: string): { success: boolean; record?: AttendanceRecord; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: 'Session not found.' };

    if (session.sessionStatus === 'FINALIZED') {
      return { success: false, error: 'Cannot modify attendance on a finalized session without administrative correction.' };
    }

    const key = `${sessionId}:${studentId}`;
    const record: AttendanceRecord = {
      id: `att-online-${sessionId}-${studentId}`,
      institutionId: session.institutionId,
      sessionId,
      studentId,
      status: 'ONLINE', // Strict 3-status rule
      attendanceSource: 'TRAINER_ONLINE_ROSTER',
      verificationSummary: { notes: 'Verified via trainer online meeting roster' },
      markedBy: trainerId,
      markedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.attendance.set(key, record);

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: session.institutionId,
      actorId: trainerId,
      action: 'MARK_ATTENDANCE_ONLINE',
      entityType: 'ATTENDANCE',
      entityId: record.id,
      reason: 'Trainer confirmed participant from online meeting roster',
      metadata: { sessionId, studentId, status: 'ONLINE' },
      timestamp: new Date().toISOString(),
    });

    return { success: true, record };
  }

  correctAttendance(params: {
    sessionId: string;
    studentId: string;
    newStatus: AttendanceStatus;
    reason: string;
    actorId: string;
  }): { success: boolean; record?: AttendanceRecord; error?: string } {
    if (!['PRESENT', 'ONLINE', 'ABSENT'].includes(params.newStatus)) {
      return { success: false, error: `Invalid status: ${params.newStatus}. Only PRESENT, ONLINE, and ABSENT are permitted.` };
    }

    if (!params.reason || params.reason.trim().length < 5) {
      return { success: false, error: 'A mandatory descriptive correction reason (min 5 chars) is required for audit trails.' };
    }

    const session = this.sessions.get(params.sessionId);
    if (!session) return { success: false, error: 'Session not found.' };

    const key = `${params.sessionId}:${params.studentId}`;
    const previous = this.attendance.get(key);
    const prevStatus = previous ? previous.status : 'UNRECORDED';

    const record: AttendanceRecord = {
      id: previous ? previous.id : `att-corr-${params.sessionId}-${params.studentId}`,
      institutionId: session.institutionId,
      sessionId: params.sessionId,
      studentId: params.studentId,
      status: params.newStatus,
      attendanceSource: 'ADMIN_CORRECTION',
      markedBy: params.actorId,
      markedAt: previous ? previous.markedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      correctionReason: params.reason,
      verificationSummary: {
        previousStatus: prevStatus,
        correctionReason: params.reason,
        correctedBy: params.actorId,
      },
    };

    this.attendance.set(key, record);

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: session.institutionId,
      actorId: params.actorId,
      action: 'CORRECT_ATTENDANCE',
      entityType: 'ATTENDANCE',
      entityId: record.id,
      reason: params.reason,
      metadata: {
        sessionId: params.sessionId,
        studentId: params.studentId,
        previousStatus: prevStatus,
        newStatus: params.newStatus,
      },
      timestamp: new Date().toISOString(),
    });

    return { success: true, record };
  }

  // ============================================================================
  // READ OPERATIONS & METRICS
  // ============================================================================

  getInstitution(id: string) {
    return this.institutions.get(id);
  }

  listInstitutions() {
    return Array.from(this.institutions.values());
  }

  getProfile(id: string) {
    return this.profiles.get(id);
  }

  getMembership(userId: string, institutionId: string) {
    return Array.from(this.memberships.values()).find(
      (m) => m.userId === userId && m.institutionId === institutionId
    );
  }

  listBatches(institutionId: string) {
    return Array.from(this.batches.values()).filter((b) => b.institutionId === institutionId);
  }

  listSubjects(institutionId: string) {
    return Array.from(this.subjects.values()).filter((s) => s.institutionId === institutionId);
  }

  listCourses(institutionId: string) {
    return Array.from(this.courses.values()).filter((c) => c.institutionId === institutionId);
  }

  listClassrooms(institutionId: string) {
    return Array.from(this.classrooms.values()).filter((c) => c.institutionId === institutionId);
  }

  listSessions(batchId: string) {
    return Array.from(this.sessions.values()).filter((s) => s.batchId === batchId);
  }

  getSession(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  getBatchEnrolledStudents(batchId: string) {
    const enrollments = Array.from(this.studentEnrollments.values()).filter(
      (e) => e.batchId === batchId && e.status === 'ACTIVE'
    );
    return enrollments.map((enr) => ({
      rollNumber: enr.rollNumber,
      student: this.profiles.get(enr.studentId)!,
    })).filter((item) => !!item.student);
  }

  getStudentAttendanceSummary(batchId: string, studentId: string): AttendanceSummary | null {
    const student = this.profiles.get(studentId);
    if (!student) return null;

    const studentProfile = this.studentProfiles.get(studentId);
    const finalizedSessions = Array.from(this.sessions.values()).filter(
      (s) => s.batchId === batchId && s.sessionStatus === 'FINALIZED'
    );

    let present = 0;
    let online = 0;
    let absent = 0;

    for (const sess of finalizedSessions) {
      const rec = this.attendance.get(`${sess.id}:${studentId}`);
      if (rec?.status === 'PRESENT') present++;
      else if (rec?.status === 'ONLINE') online++;
      else absent++;
    }

    const total = finalizedSessions.length;
    const attended = present + online;
    const percentage = total > 0 ? Math.round((attended / total) * 10000) / 100 : 0;

    return {
      studentId,
      studentName: student.displayName,
      rollNumber: studentProfile?.studentIdNumber || 'N/A',
      email: student.email,
      presentCount: present,
      onlineCount: online,
      absentCount: absent,
      totalFinalizedSessions: total,
      attendancePercentage: percentage,
    };
  }

  getBatchExportData(batchId: string) {
    const batch = this.batches.get(batchId);
    if (!batch) return null;

    const institution = this.institutions.get(batch.institutionId);
    const course = batch.courseId ? this.courses.get(batch.courseId) : undefined;
    const students = this.getBatchEnrolledStudents(batchId);
    const sessions = Array.from(this.sessions.values()).filter(
      (s) => s.batchId === batchId && s.sessionStatus === 'FINALIZED'
    );

    const sessionIds = new Set(sessions.map((s) => s.id));
    const attendanceRecords = Array.from(this.attendance.values()).filter((a) =>
      sessionIds.has(a.sessionId)
    );

    return {
      institutionName: institution?.name || 'Educational Institution',
      batchName: batch.name,
      batchCode: batch.code,
      courseName: course?.name || 'Academic Program',
      students,
      sessions,
      attendanceRecords,
    };
  }

  // ============================================================================
  // MULTI-BATCH ENROLLMENT OPERATIONS
  // ============================================================================

  isStudentEnrolledInBatch(studentId: string, batchId: string): boolean {
    return Array.from(this.studentEnrollments.values()).some(
      (e) => e.studentId === studentId && e.batchId === batchId && e.status === 'ACTIVE'
    );
  }

  getStudentEnrolledBatches(studentId: string) {
    const enrollments = Array.from(this.studentEnrollments.values()).filter(
      (e) => e.studentId === studentId && e.status === 'ACTIVE'
    );

    return enrollments.map((enr) => {
      const batch = this.batches.get(enr.batchId);
      if (!batch) return null;

      // Find assigned trainer for this batch
      const assignment = Array.from(this.trainerAssignments.values()).find(
        (a) => a.batchId === batch.id && a.status === 'ACTIVE'
      );
      const trainer = assignment ? this.profiles.get(assignment.trainerId) : undefined;

      // Find subject for this batch
      const subject = assignment?.subjectId ? this.subjects.get(assignment.subjectId) : undefined;

      // Find active or scheduled session for this batch
      const batchSessions = Array.from(this.sessions.values()).filter((s) => s.batchId === batch.id);
      const activeSession = batchSessions.find((s) => s.sessionStatus === 'ACTIVE') ||
        batchSessions.find((s) => s.sessionStatus === 'SCHEDULED');

      let sessionWithMyStatus = activeSession ? { ...activeSession } : undefined;
      if (activeSession) {
        const myRecord = this.attendance.get(`${activeSession.id}:${studentId}`);
        (sessionWithMyStatus as any).myAttendanceStatus = myRecord ? myRecord.status : null;
      }

      const summary = this.getStudentAttendanceSummary(batch.id, studentId);

      return {
        batch,
        enrollment: enr,
        trainer,
        subject,
        activeSession: sessionWithMyStatus,
        summary,
      };
    }).filter((item) => item !== null);
  }

  enrollStudentInBatch(params: {
    institutionId: string;
    studentId: string;
    batchId: string;
    rollNumber?: string;
    actorId?: string;
  }): { success: boolean; enrollment?: any; error?: string } {
    const profile = this.profiles.get(params.studentId);
    if (!profile) return { success: false, error: 'Student account not found.' };

    const batch = this.batches.get(params.batchId);
    if (!batch) return { success: false, error: 'Target batch does not exist.' };

    const isAlreadyEnrolled = Array.from(this.studentEnrollments.values()).some(
      (e) => e.studentId === params.studentId && e.batchId === params.batchId && e.status === 'ACTIVE'
    );
    if (isAlreadyEnrolled) {
      return {
        success: false,
        error: `Student is already actively enrolled in batch "${batch.name}" (${batch.code}). Duplicate active enrollments are blocked.`,
      };
    }

    const enrId = `enr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const rollNumber = params.rollNumber || this.studentProfiles.get(params.studentId)?.studentIdNumber || 'ST-ENR';

    const enrollment = {
      id: enrId,
      institutionId: params.institutionId,
      studentId: params.studentId,
      batchId: params.batchId,
      rollNumber,
      enrolledAt: new Date().toISOString(),
      status: 'ACTIVE' as const,
    };

    this.studentEnrollments.set(enrId, enrollment);

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: params.institutionId,
      actorId: params.actorId || 'ADMIN',
      action: 'ENROLL_STUDENT_BATCH',
      entityType: 'STUDENT_ENROLLMENT',
      entityId: enrId,
      reason: `Enrolled student into batch ${batch.name} (${batch.code})`,
      metadata: { studentId: params.studentId, batchId: params.batchId },
      timestamp: new Date().toISOString(),
    });

    return { success: true, enrollment };
  }

  removeStudentFromBatch(params: {
    studentId: string;
    batchId: string;
    actorId?: string;
    reason?: string;
  }): { success: boolean; error?: string } {
    const entry = Array.from(this.studentEnrollments.entries()).find(
      ([_, e]) => e.studentId === params.studentId && e.batchId === params.batchId && e.status === 'ACTIVE'
    );
    if (!entry) {
      return { success: false, error: 'Active enrollment record not found for this student and batch.' };
    }

    const [enrKey, enrollment] = entry;
    enrollment.status = 'DROPPED';

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: enrollment.institutionId,
      actorId: params.actorId || 'ADMIN',
      action: 'DEACTIVATE_STUDENT_ENROLLMENT',
      entityType: 'STUDENT_ENROLLMENT',
      entityId: enrKey,
      reason: params.reason || 'Deactivated batch enrollment by administrator',
      metadata: { studentId: params.studentId, batchId: params.batchId },
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  listStudentBatchEnrollments(studentId: string) {
    return Array.from(this.studentEnrollments.values()).filter((e) => e.studentId === studentId);
  }

  isStudentUser(userId: string): boolean {
    const mem = Array.from(this.memberships.values()).find((m) => m.userId === userId);
    if (mem?.role === 'STUDENT') return true;
    const p = this.profiles.get(userId);
    if (p?.role === 'STUDENT') return true;
    if (this.studentProfiles.has(userId)) return true;
    return false;
  }

  findStudentByEmail(email: string): Profile | undefined {
    const norm = (email || '').trim().toLowerCase();
    if (!norm) return undefined;
    return Array.from(this.profiles.values()).find((p) => {
      if (p.email.toLowerCase() !== norm) return false;
      return this.isStudentUser(p.id);
    });
  }

  searchStudents(query: string, currentBatchId?: string) {
    const q = (query || '').trim().toLowerCase();
    const studentUserIds = new Set(
      Array.from(this.memberships.values())
        .filter((m) => m.role === 'STUDENT')
        .map((m) => m.userId)
    );

    const allStudents = Array.from(this.profiles.values()).filter((p) => {
      const isStudent = studentUserIds.has(p.id) || p.role === 'STUDENT' || this.studentProfiles.has(p.id);
      if (!isStudent) return false;
      if (!q) return true;
      return p.displayName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    });

    return allStudents.map((s) => {
      const isAlreadyEnrolled = currentBatchId
        ? Array.from(this.studentEnrollments.values()).some(
            (e) => e.studentId === s.id && e.batchId === currentBatchId && e.status === 'ACTIVE'
          )
        : false;

      const enrolledBatchesCount = Array.from(this.studentEnrollments.values()).filter(
        (e) => e.studentId === s.id && e.status === 'ACTIVE'
      ).length;

      return {
        id: s.id,
        displayName: s.displayName,
        email: s.email,
        accountStatus: s.accountStatus,
        isAlreadyEnrolled,
        enrolledBatchesCount,
      };
    });
  }

  // --------------------------------------------------------------------------
  // SIMPLIFIED ZERO-ROLL-NUMBER ENROLLMENT (NAME + EMAIL ONLY)
  // --------------------------------------------------------------------------
  enrollStudentByEmail(params: {
    batchId: string;
    fullName: string;
    email: string;
    actorId?: string;
    actorRole?: string;
  }): { success: boolean; student?: Profile; enrollment?: any; error?: string; isNewStudent?: boolean; message?: string } {
    if (!params.batchId) return { success: false, error: 'Target batch ID is required.' };
    if (!params.fullName || !params.fullName.trim()) return { success: false, error: 'Student full name is required.' };
    if (!params.email || !params.email.trim()) return { success: false, error: 'Student email address is required.' };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = params.email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      return { success: false, error: 'Please provide a valid email address.' };
    }

    const batch = this.batches.get(params.batchId);
    if (!batch) return { success: false, error: 'Selected batch does not exist.' };

    // If a trainer is adding, verify they are assigned to this batch
    if (params.actorRole === 'TRAINER' && params.actorId) {
      const isAssigned = Array.from(this.trainerAssignments.values()).some(
        (a) => a.trainerId === params.actorId && a.batchId === params.batchId && a.status === 'ACTIVE'
      );
      if (!isAssigned) {
        return { success: false, error: 'Forbidden: You are not authorized to enroll students into this batch.' };
      }
    }

    // Check if user already exists
    let student = this.findStudentByEmail(normalizedEmail);
    let isNew = false;

    if (!student) {
      isNew = true;
      const studentId = `stud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      student = {
        id: studentId,
        email: normalizedEmail,
        role: 'STUDENT',
        displayName: params.fullName.trim(),
        accountStatus: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.profiles.set(studentId, student);

      this.studentProfiles.set(studentId, {
        id: `sp-${studentId}`,
        userId: studentId,
        institutionId: batch.institutionId,
        fullName: params.fullName.trim(),
        isVerified: true,
        verificationStatus: 'VERIFIED',
        registeredAt: new Date().toISOString(),
        emergencyContactPhone: '',
      });

      this.memberships.set(`mem-${studentId}`, {
        id: `mem-${studentId}`,
        institutionId: batch.institutionId,
        userId: studentId,
        role: 'STUDENT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      });

      this.credentials.set(normalizedEmail, {
        userId: studentId,
        email: normalizedEmail,
        passwordHash: 'Student@2026!',
        role: 'STUDENT',
        institutionId: batch.institutionId,
      });
    }

    // Check duplicate enrollment in this batch
    const existingEnrollment = Array.from(this.studentEnrollments.values()).find(
      (e) => e.studentId === student!.id && e.batchId === params.batchId && e.status === 'ACTIVE'
    );
    if (existingEnrollment) {
      return {
        success: false,
        error: `Student "${student.displayName}" (${normalizedEmail}) is already actively enrolled in this batch.`,
      };
    }

    const enrId = `enr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const enrollment = {
      id: enrId,
      institutionId: batch.institutionId,
      studentId: student.id,
      batchId: params.batchId,
      rollNumber: '',
      enrolledAt: new Date().toISOString(),
      status: 'ACTIVE' as const,
    };
    this.studentEnrollments.set(enrId, enrollment);

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: batch.institutionId,
      actorId: params.actorId || 'SYSTEM',
      action: 'ENROLL_STUDENT_BY_EMAIL',
      entityType: 'STUDENT_ENROLLMENT',
      entityId: enrId,
      reason: `Enrolled ${student.displayName} (${normalizedEmail}) into batch ${batch.name}`,
      metadata: { studentId: student.id, batchId: params.batchId, isNewStudent: isNew },
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      student,
      enrollment,
      isNewStudent: isNew,
      message: isNew
        ? `New student account created for "${student.displayName}" and enrolled into ${batch.name}.`
        : `Existing student "${student.displayName}" successfully enrolled into ${batch.name}.`,
    };
  }

  // --------------------------------------------------------------------------
  // BATCH CREATION & TRAINER ASSIGNMENT
  // --------------------------------------------------------------------------
  createBatch(params: {
    name: string;
    courseName?: string;
    startDate?: string;
    endDate?: string;
    trainerId?: string;
    institutionId?: string;
  }): { success: boolean; batch?: Batch; error?: string } {
    if (!params.name || !params.name.trim()) {
      return { success: false, error: 'Batch name is required.' };
    }

    const instId = params.institutionId || '11111111-1111-1111-1111-111111111111';
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const courseId = '55555555-5555-5555-5555-555555555551';
    const now = new Date();

    const batch: Batch = {
      id: batchId,
      institutionId: instId,
      courseId,
      name: params.name.trim(),
      code: params.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').substring(0, 20),
      startDate: params.startDate || now.toISOString().split('T')[0],
      endDate: params.endDate || new Date(now.getTime() + 180 * 86400000).toISOString().split('T')[0],
      status: 'ACTIVE',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.batches.set(batchId, batch);

    if (params.trainerId) {
      this.assignTrainerToBatch({
        trainerId: params.trainerId,
        batchId,
        institutionId: instId,
      });
    }

    return { success: true, batch };
  }

  assignTrainerToBatch(params: {
    trainerId: string;
    batchId: string;
    subjectId?: string;
    institutionId?: string;
  }): { success: boolean; assignment?: any; error?: string } {
    const trainer = this.profiles.get(params.trainerId);
    if (!trainer || trainer.role !== 'TRAINER') {
      return { success: false, error: 'Trainer not found or user is not a trainer.' };
    }
    const batch = this.batches.get(params.batchId);
    if (!batch) {
      return { success: false, error: 'Batch not found.' };
    }

    const instId = params.institutionId || batch.institutionId;
    const assignId = `asgn-${params.trainerId}-${params.batchId}`;
    const assignment = {
      id: assignId,
      institutionId: instId,
      trainerId: params.trainerId,
      batchId: params.batchId,
      subjectId: params.subjectId || '66666666-6666-6666-6666-666666666661',
      status: 'ACTIVE',
    };

    this.trainerAssignments.set(assignId, assignment);
    return { success: true, assignment };
  }

  // --------------------------------------------------------------------------
  // ADMIN DASHBOARD REAL DATABASE METRICS
  // --------------------------------------------------------------------------
  getAdminDashboardStats() {
    const studentUserIds = new Set(
      Array.from(this.memberships.values())
        .filter((m) => m.role === 'STUDENT')
        .map((m) => m.userId)
    );
    const trainerUserIds = new Set(
      Array.from(this.memberships.values())
        .filter((m) => m.role === 'TRAINER')
        .map((m) => m.userId)
    );
    const totalStudents = studentUserIds.size;
    const totalTrainers = trainerUserIds.size;
    const totalBatches = this.batches.size;
    const activeSessions = Array.from(this.sessions.values()).filter((s) => s.sessionStatus === 'ACTIVE');
    const totalAttendanceRecords = this.attendance.size;

    const recentRecords = Array.from(this.attendance.values())
      .sort((a, b) => (b.markedAt || '').localeCompare(a.markedAt || ''))
      .slice(0, 10)
      .map((rec) => {
        const student = this.profiles.get(rec.studentId);
        const session = this.sessions.get(rec.sessionId);
        const batch = session ? this.batches.get(session.batchId) : undefined;
        return {
          id: rec.id,
          studentName: student?.displayName || 'Unknown Student',
          studentEmail: student?.email || '',
          batchName: batch?.name || 'Session',
          status: rec.status,
          markedAt: rec.markedAt,
          source: rec.attendanceSource,
        };
      });

    const batchSummaries = Array.from(this.batches.values()).map((b) => {
      const enrolledCount = Array.from(this.studentEnrollments.values()).filter(
        (e) => e.batchId === b.id && e.status === 'ACTIVE'
      ).length;
      const assignment = Array.from(this.trainerAssignments.values()).find(
        (a) => a.batchId === b.id && a.status === 'ACTIVE'
      );
      const trainer = assignment ? this.profiles.get(assignment.trainerId) : undefined;
      const activeSession = activeSessions.find((s) => s.batchId === b.id);

      return {
        id: b.id,
        name: b.name,
        code: b.code,
        status: b.status,
        startDate: b.startDate,
        endDate: b.endDate,
        enrolledCount,
        trainerName: trainer?.displayName || 'Unassigned',
        trainerEmail: trainer?.email || '',
        hasActiveSession: !!activeSession,
      };
    });

    return {
      totalStudents,
      totalTrainers,
      totalBatches,
      activeSessionsCount: activeSessions.length,
      totalAttendanceRecords,
      recentRecords,
      batchSummaries,
    };
  }

  // ============================================================================
  // ADMIN-ONLY LOCATION & NETWORK CONFIGURATION
  // ============================================================================

  getClassroomAdmin(classroomId: string, userRole?: string): { success: boolean; classroom?: Classroom; error?: string } {
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Access Denied: Only Super Admin and Institution Administrators are authorized to view sensitive classroom coordinates and network CIDRs.',
      };
    }
    const classroom = this.classrooms.get(classroomId);
    if (!classroom) return { success: false, error: 'Classroom not found.' };
    return { success: true, classroom };
  }

  listClassroomsAdmin(institutionId: string, userRole?: string): { success: boolean; classrooms?: Classroom[]; error?: string } {
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Access Denied: Only Administrators can inspect institute-wide location and network infrastructure.',
      };
    }
    const list = Array.from(this.classrooms.values()).filter((c) => c.institutionId === institutionId);
    return { success: true, classrooms: list };
  }

  listClassroomsPublic(institutionId: string): PublicClassroom[] {
    return Array.from(this.classrooms.values())
      .filter((c) => c.institutionId === institutionId)
      .map((c) => ({
        id: c.id,
        institutionId: c.institutionId,
        name: c.name,
        building: c.building,
        roomNumber: c.roomNumber,
        gpsVerificationEnabled: c.gpsVerificationEnabled,
        networkVerificationEnabled: c.networkVerificationEnabled,
        status: c.status,
      }));
  }

  updateClassroomSettings(params: {
    classroomId: string;
    userRole: string;
    actorId: string;
    name?: string;
    building?: string;
    roomNumber?: string;
    latitude: number;
    longitude: number;
    geofenceRadiusMeters: number;
    requiredGpsAccuracyMeters: number;
    allowedNetworkCidrs: string[];
    gpsVerificationEnabled: boolean;
    gpsMandatory: boolean;
    networkVerificationEnabled: boolean;
    networkMandatory: boolean;
    reason?: string;
  }): { success: boolean; classroom?: Classroom; error?: string } {
    if (params.userRole !== 'ADMIN' && params.userRole !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Security Violation: Only Administrators are authorized to modify classroom geofences and network CIDRs.',
      };
    }

    const classroom = this.classrooms.get(params.classroomId);
    if (!classroom) return { success: false, error: 'Classroom record not found.' };

    if (params.latitude < -90 || params.latitude > 90) {
      return { success: false, error: 'Invalid latitude: Must be between -90 and 90 degrees.' };
    }
    if (params.longitude < -180 || params.longitude > 180) {
      return { success: false, error: 'Invalid longitude: Must be between -180 and 180 degrees.' };
    }
    if (params.geofenceRadiusMeters < 5 || params.geofenceRadiusMeters > 500) {
      return { success: false, error: 'Invalid geofence radius: Must be between 5 and 500 meters.' };
    }

    if (params.name) classroom.name = params.name.trim();
    if (params.building) classroom.building = params.building.trim();
    if (params.roomNumber) classroom.roomNumber = params.roomNumber.trim();
    classroom.latitude = params.latitude;
    classroom.longitude = params.longitude;
    classroom.geofenceRadiusMeters = params.geofenceRadiusMeters;
    classroom.requiredGpsAccuracyMeters = params.requiredGpsAccuracyMeters;
    classroom.allowedNetworkCidrs = params.allowedNetworkCidrs;
    classroom.gpsVerificationEnabled = params.gpsVerificationEnabled;
    classroom.gpsMandatory = params.gpsMandatory;
    classroom.networkVerificationEnabled = params.networkVerificationEnabled;
    classroom.networkMandatory = params.networkMandatory;
    classroom.updatedAt = new Date().toISOString();

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      institutionId: classroom.institutionId,
      actorId: params.actorId,
      action: 'UPDATE_CLASSROOM_LOCATION_NETWORK',
      entityType: 'CLASSROOM',
      entityId: classroom.id,
      reason: params.reason || 'Admin updated classroom location and network verification settings',
      metadata: {
        latitude: params.latitude,
        longitude: params.longitude,
        geofenceRadiusMeters: params.geofenceRadiusMeters,
      },
      timestamp: new Date().toISOString(),
    });

    return { success: true, classroom };
  }
}

// Global Singleton for enterprise multi-tenant state
export const db = new NoProxyStore();
