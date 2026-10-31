import { Router, Response } from 'express';
import { generateQRChallenge, verifyQRChallenge } from '../lib/qr/token';
import { db } from '../lib/db/mock-db';
import { AuthenticatedRequest, requireAuth, requireTrainer } from '../middleware/auth';
import QRCode from 'qrcode';

const router = Router();

router.use(requireAuth);

// POST /api/qr/generate (Trainer generates dynamic QR code with sliding 20s HMAC)
router.post('/generate', requireTrainer, async (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required.' });
  }

  const session = db.sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  if (req.userRole === 'TRAINER') {
    const isAssigned = Array.from(db.trainerAssignments.values()).some(
      (a) => a.trainerId === req.userId && a.batchId === session.batchId && a.status === 'ACTIVE'
    );
    if (!isAssigned && session.createdBy !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to generate QR codes for this batch session.' });
    }
  }

  if (session.sessionStatus !== 'ACTIVE') {
    return res.status(400).json({ error: `Cannot generate QR: Session is not ACTIVE (current status: ${session.sessionStatus}).` });
  }

  const instId = session.institutionId;
  const challenge = generateQRChallenge(sessionId, instId, 20);

  // Generate data URL for browser display
  const qrDataUrl = await QRCode.toDataURL(challenge.rawToken, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#1e1b4b', // Indigo-950
      light: '#ffffff',
    },
  });

  return res.json({
    success: true,
    token: challenge.rawToken,
    expiresAt: challenge.payload.expiresAt,
    expiresInSeconds: 20,
    qrDataUrl,
    sessionId,
  });
});

// POST /api/qr/verify (Validation check)
router.post('/verify', (req: AuthenticatedRequest, res: Response) => {
  const { rawToken, sessionId } = req.body || {};

  if (!rawToken || !sessionId) {
    return res.status(400).json({ error: 'rawToken and sessionId are required.' });
  }

  const verifyRes = verifyQRChallenge(rawToken, sessionId);
  return res.json(verifyRes);
});

export default router;
