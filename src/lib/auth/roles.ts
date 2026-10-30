import { Role } from '../db/types';

export const ROLES: Record<Role, { name: string; description: string }> = {
  ADMIN: {
    name: 'Super Admin / Admin',
    description: 'Manages institution, trainers, students, authoritative rosters, batches, courses, classrooms, and Excel registers',
  },
  TRAINER: {
    name: 'Trainer',
    description: 'Manages assigned lectures, launches dynamic QR codes, confirms online rosters, and finalizes attendance',
  },
  STUDENT: {
    name: 'Student',
    description: 'Scans dynamic QR codes on smartphone, verifies GPS geofence, and views personal attendance history',
  },
};

export function isAdmin(role?: Role | string): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'INSTITUTION_ADMIN';
}

export function isTrainer(role?: Role | string): boolean {
  return role === 'TRAINER';
}

export function isStudent(role?: Role | string): boolean {
  return role === 'STUDENT';
}

export function canManageInstitution(role?: Role | string): boolean {
  return isAdmin(role);
}

export function canRunSessions(role?: Role | string): boolean {
  return isTrainer(role) || isAdmin(role);
}

export function canExportReports(role?: Role | string): boolean {
  return isTrainer(role) || isAdmin(role);
}
