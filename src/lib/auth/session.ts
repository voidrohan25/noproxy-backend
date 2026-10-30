import { Role, Profile, Institution, StudentProfile } from '../db/types';
import { db } from '../db/mock-db';

export interface UserSession {
  user: Profile;
  institution?: Institution;
  role: Role;
  studentProfile?: StudentProfile;
}

// Fixed Initial Super Admin (can be overridden via environment variables)
export const INITIAL_ADMIN_CREDENTIALS = {
  email: process.env.INITIAL_ADMIN_EMAIL || 'admin@noproxy.edu',
  password: process.env.INITIAL_ADMIN_PASSWORD || 'Admin@NoProxy2026!',
};

export function getSessionForUserId(userId: string): UserSession | null {
  const profile = db.getProfile(userId);
  if (!profile) return null;

  const membership = Array.from(db.memberships.values()).find((m) => m.userId === userId);
  const institution = membership ? db.getInstitution(membership.institutionId) : undefined;
  const studentProfile = db.getStudentProfile(userId);

  return {
    user: profile,
    institution,
    role: membership?.role || 'STUDENT',
    studentProfile,
  };
}

export function authenticateWithCredentials(email: string, passwordAttempt: string): {
  success: boolean;
  session?: UserSession;
  error?: string;
} {
  const res = db.authenticateUser(email, passwordAttempt);
  if (!res.success || !res.user || !res.role) {
    return { success: false, error: res.error || 'Authentication failed.' };
  }

  const session = getSessionForUserId(res.user.id);
  if (!session) {
    return { success: false, error: 'Session could not be established.' };
  }

  return {
    success: true,
    session,
  };
}
