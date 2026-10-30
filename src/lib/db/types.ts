// ==============================================================================
// NOPROXY DATABASE TYPES
// Strict 3 Attendance Statuses: PRESENT, ONLINE, ABSENT (NO Late/Delayed)
// ==============================================================================

export type Role = 'ADMIN' | 'TRAINER' | 'STUDENT';

export type InstitutionStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export type SessionMode = 'OFFLINE' | 'ONLINE';

export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'FINALIZED' | 'CANCELLED';

// STRICT ATTENDANCE STATUS: EXACTLY THREE VALUES
export type AttendanceStatus = 'PRESENT' | 'ONLINE' | 'ABSENT';

export type AttendanceSource = 
  | 'DYNAMIC_QR' 
  | 'TRAINER_ONLINE_ROSTER' 
  | 'SYSTEM_FINALIZATION' 
  | 'ADMIN_CORRECTION';

export interface Institution {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  contactEmail: string;
  status: InstitutionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  displayName: string;
  email: string;
  role?: Role;
  phone?: string;
  avatarUrl?: string;
  accountStatus: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionMembership {
  id: string;
  institutionId: string;
  userId: string;
  role: Role;
  status: 'ACTIVE' | 'INVITED' | 'INACTIVE';
  createdAt: string;
}

export interface Course {
  id: string;
  institutionId: string;
  name: string;
  code?: string;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  institutionId: string;
  courseId?: string;
  name: string;
  code?: string;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  institutionId: string;
  courseId?: string;
  name: string;
  code: string;
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface AuthoritativeStudent {
  id: string;
  institutionId: string;
  batchId: string;
  studentIdNumber: string; // Institutional ID/Roll e.g. "ST-001" or "CS-2026-042"
  fullName: string;
  email?: string;
  isClaimed: boolean;
  claimedByUserId?: string;
  createdAt: string;
  claimedAt?: string;
}

export interface StudentEnrollment {
  id: string;
  institutionId: string;
  studentId: string;
  batchId: string;
  rollNumber?: string;
  enrolledAt?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DROPPED' | 'COMPLETED';
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  institutionId: string;
  batchId?: string; // backwards compatibility
  primaryBatchId?: string;
  studentIdNumber?: string;
  fullName: string;
  isVerified: boolean;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  registeredAt: string;
  emergencyContactPhone?: string;
}

export interface Classroom {
  id: string;
  institutionId: string;
  name: string;
  building?: string;
  roomNumber?: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  requiredGpsAccuracyMeters: number;
  gpsVerificationEnabled: boolean;
  gpsMandatory: boolean;
  allowedNetworkCidrs: string[];
  networkVerificationEnabled: boolean;
  networkMandatory: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

// Sanitized classroom for trainers and students (no exact coordinates or raw network ranges)
export interface PublicClassroom {
  id: string;
  institutionId: string;
  name: string;
  building?: string;
  roomNumber?: string;
  gpsVerificationEnabled: boolean;
  networkVerificationEnabled: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Session {
  id: string;
  institutionId: string;
  batchId: string;
  subjectId: string;
  classroomId?: string;
  createdBy: string;
  title: string;
  sessionDate: string; // YYYY-MM-DD
  startTime: string;   // HH:MM:SS
  endTime: string;     // HH:MM:SS
  mode: SessionMode;
  sessionStatus: SessionStatus;
  externalMeetingPlatform?: string;
  externalMeetingUrl?: string;
  finalizedBy?: string;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  institutionId: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  attendanceSource: AttendanceSource;
  verificationSummary?: {
    qrChallengeId?: string;
    gpsVerified?: boolean;
    distanceMeters?: number;
    networkVerified?: boolean;
    deviceVerified?: boolean;
    localAuthVerified?: boolean;
    notes?: string;
    previousStatus?: string;
    correctionReason?: string;
    correctedBy?: string;
    [key: string]: unknown;
  };
  markedBy: string;
  markedAt: string;
  updatedAt: string;
  correctionReason?: string;
}

export interface DeviceRegistration {
  id: string;
  institutionId: string;
  studentId: string;
  credentialId: string;
  publicKey?: string;
  deviceModel: string;
  platform: string;
  registeredAt: string;
  revokedAt?: string;
  status: 'ACTIVE' | 'REVOKED' | 'PENDING_RESET';
  resetAudit?: Record<string, unknown>;
}

export interface AttendancePolicy {
  id: string;
  institutionId: string;
  sessionMode: 'OFFLINE' | 'ONLINE' | 'ALL';
  requireDynamicQr: boolean;
  requireGps: boolean;
  requireNetwork: boolean;
  requireRegisteredDevice: boolean;
  requireLocalAuth: boolean;
  qrRefreshSeconds: number;
  strictMode: boolean;
  updatedBy?: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  institutionId?: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AttendanceSummary {
  studentId: string;
  studentName: string;
  rollNumber: string;
  email: string;
  presentCount: number;
  onlineCount: number;
  absentCount: number;
  totalFinalizedSessions: number;
  attendancePercentage: number;
}
