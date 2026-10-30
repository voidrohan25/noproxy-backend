import { Router, Response } from 'express';
import { authenticateWithCredentials, getSessionForUserId } from '../lib/auth/session';
import { db } from '../lib/db/mock-db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res: Response) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter both email address and password.' });
  }

  const authRes = authenticateWithCredentials(email, password);
  if (!authRes.success || !authRes.session) {
    return res.status(401).json({ error: authRes.error || 'Invalid credentials.' });
  }

  const { role, user, studentProfile } = authRes.session;

  let redirectUrl = '/';
  if (role === 'ADMIN') {
    redirectUrl = '/admin';
  } else if (role === 'TRAINER') {
    redirectUrl = '/trainer';
  } else if (role === 'STUDENT') {
    if (!studentProfile || !studentProfile.isVerified) {
      redirectUrl = '/student/complete-registration';
    } else {
      redirectUrl = '/student';
    }
  }

  // Set secure cookie
  res.cookie('noproxy_session_user', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
  });

  return res.json({
    success: true,
    token: user.id, // For cross-domain Bearer auth
    role,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    redirectUrl,
  });
});

// GET /api/auth/me
router.get('/me', (req: AuthenticatedRequest, res: Response) => {
  if (!req.sessionData || !req.userId) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user: {
      id: req.sessionData.user.id,
      email: req.sessionData.user.email,
      displayName: req.sessionData.user.displayName,
    },
    role: req.sessionData.role,
    institution: req.sessionData.institution,
    studentProfile: req.sessionData.studentProfile,
  });
});

// POST /api/auth/logout
router.post('/logout', (_req, res: Response) => {
  res.clearCookie('noproxy_session_user', { path: '/' });
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// POST /api/auth/register
router.post('/register', (req, res: Response) => {
  const { email, password, displayName, role = 'STUDENT' } = req.body || {};

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }

  const existing = db.credentials.get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email address already exists. Please log in.' });
  }

  const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const instId = '11111111-1111-1111-1111-111111111111';

  db.profiles.set(userId, {
    id: userId,
    displayName,
    email: email.toLowerCase(),
    accountStatus: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  db.memberships.set(`mem-${userId}`, {
    id: `mem-${userId}`,
    institutionId: instId,
    userId,
    role: (role === 'TRAINER' ? 'TRAINER' : 'STUDENT') as any,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  });

  db.credentials.set(email.toLowerCase(), {
    email: email.toLowerCase(),
    passwordHash: password,
    role: (role === 'TRAINER' ? 'TRAINER' : 'STUDENT') as any,
    userId,
    institutionId: instId,
  });

  res.cookie('noproxy_session_user', userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 * 1000,
  });

  return res.json({
    success: true,
    token: userId,
    user: { id: userId, email: email.toLowerCase(), displayName },
    role,
    redirectUrl: role === 'STUDENT' ? '/student/complete-registration' : '/trainer',
  });
});

// POST /api/auth/claim-student
router.post('/claim-student', (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Please sign in to verify your identity.' });
  }

  const { batchId, studentIdNumber, submittedFullName } = req.body || {};

  if (!batchId || !studentIdNumber || !submittedFullName) {
    return res.status(400).json({ error: 'Batch selection, Student ID, and Full Name are required.' });
  }

  const instId = '11111111-1111-1111-1111-111111111111';
  const claimRes = db.claimAuthoritativeStudent({
    userId: req.userId,
    institutionId: instId,
    batchId,
    studentIdNumber: studentIdNumber.trim(),
    submittedFullName: submittedFullName.trim(),
  });

  if (!claimRes.success) {
    return res.status(400).json({ error: claimRes.error });
  }

  return res.json({
    success: true,
    message: 'Institutional student identity claimed and verified successfully.',
    profile: claimRes.profile,
  });
});

export default router;
