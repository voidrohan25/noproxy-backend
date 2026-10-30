import { Request, Response, NextFunction } from 'express';
import { getSessionForUserId, UserSession } from '../lib/auth/session';

export interface AuthenticatedRequest extends Request {
  sessionData?: UserSession;
  userId?: string;
  userRole?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let userId = req.cookies?.['noproxy_session_user'];

  if (!userId && req.headers.authorization) {
    const authParts = req.headers.authorization.split(' ');
    if (authParts.length === 2 && authParts[0].toLowerCase() === 'bearer') {
      userId = authParts[1];
    }
  }

  if (!userId && req.headers['x-user-id']) {
    userId = req.headers['x-user-id'] as string;
  }

  if (userId) {
    const session = getSessionForUserId(userId);
    if (session) {
      req.sessionData = session;
      req.userId = session.user.id;
      req.userRole = session.role;
    }
  }

  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.sessionData || !req.userId) {
    return res.status(401).json({ authenticated: false, error: 'Authentication required. Please sign in.' });
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.sessionData || (req.userRole !== 'ADMIN' && req.userRole !== 'SUPER_ADMIN')) {
    return res.status(403).json({ error: 'Access forbidden: Administrative privilege required.' });
  }
  next();
}

export function requireTrainer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.sessionData || (req.userRole !== 'TRAINER' && req.userRole !== 'ADMIN' && req.userRole !== 'SUPER_ADMIN')) {
    return res.status(403).json({ error: 'Access forbidden: Trainer authorization required.' });
  }
  next();
}

export function requireStudent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.sessionData || (req.userRole !== 'STUDENT' && req.userRole !== 'ADMIN' && req.userRole !== 'SUPER_ADMIN')) {
    return res.status(403).json({ error: 'Access forbidden: Student authorization required.' });
  }
  next();
}
