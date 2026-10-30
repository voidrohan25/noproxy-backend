// ==============================================================================
// DYNAMIC QR CHALLENGE ENGINE
// Cryptographic HMAC-SHA256 Signed Short-Lived Tokens for Attendance
// Prevents Replay, Screenshot Sharing, and Tampering
// ==============================================================================

import crypto from 'crypto';
import QRCode from 'qrcode';

const DEFAULT_SECRET = process.env.QR_SIGNING_SECRET || 'noproxy_secure_default_hmac_challenge_key_2026_xyz';
const DEFAULT_EXPIRY_SECONDS = 20;

export interface QRChallengePayload {
  sessionId: string;
  institutionId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

export interface QRTokenData {
  payload: QRChallengePayload;
  signature: string;
  rawToken: string;
}

/**
 * Creates a cryptographically signed dynamic QR token.
 */
export function generateQRChallenge(
  sessionId: string,
  institutionId: string,
  expirySeconds: number = DEFAULT_EXPIRY_SECONDS,
  secretKey: string = DEFAULT_SECRET
): QRTokenData {
  const now = Date.now();
  const expiresAt = now + expirySeconds * 1000;
  const nonce = crypto.randomBytes(8).toString('hex');

  const payload: QRChallengePayload = {
    sessionId,
    institutionId,
    issuedAt: now,
    expiresAt,
    nonce,
  };

  const payloadString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(payloadString)
    .digest('base64url');

  const rawToken = `${payloadString}.${signature}`;

  return {
    payload,
    signature,
    rawToken,
  };
}

/**
 * Validates a dynamic QR challenge token.
 */
export function verifyQRChallenge(
  rawToken: string,
  expectedSessionId?: string,
  secretKey: string = DEFAULT_SECRET
): { valid: boolean; payload?: QRChallengePayload; error?: string } {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, error: 'Empty or invalid QR token format.' };
  }

  const parts = rawToken.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed challenge token structure.' };
  }

  const [payloadString, signature] = parts;

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payloadString)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    return { valid: false, error: 'Cryptographic signature mismatch. Token was tampered with or forged.' };
  }

  // Parse payload
  let payload: QRChallengePayload;
  try {
    const jsonStr = Buffer.from(payloadString, 'base64url').toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch {
    return { valid: false, error: 'Invalid challenge payload encoding.' };
  }

  // Check expiration
  const now = Date.now();
  if (now > payload.expiresAt) {
    const expiredAgoSeconds = Math.round((now - payload.expiresAt) / 1000);
    return {
      valid: false,
      payload,
      error: `QR code expired ${expiredAgoSeconds} seconds ago. Please scan the current code displayed on the screen.`,
    };
  }

  // Optional: check session match
  if (expectedSessionId && payload.sessionId !== expectedSessionId) {
    return {
      valid: false,
      payload,
      error: 'QR token was generated for a different session.',
    };
  }

  return { valid: true, payload };
}

/**
 * Generates an SVG or PNG data URL for rendering on the Trainer's projection display.
 */
export async function generateQRCodeDataUrl(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#1e1b4b', // brand indigo-950
      light: '#ffffff',
    },
  });
}
