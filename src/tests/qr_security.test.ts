// ==============================================================================
// TEST SUITE: DYNAMIC QR CRYPTOGRAPHIC SECURITY & ANTI-REPLAY
// ==============================================================================

import { generateQRChallenge, verifyQRChallenge } from '../lib/qr/token';

export function runQRSecurityTests() {
  console.log('\n--- 2. Testing Dynamic QR Cryptographic Security & Anti-Replay ---');

  const sessionId = '99999999-9999-9999-9999-999999999994';
  const institutionId = '11111111-1111-1111-1111-111111111111';

  // Test 1: Valid Challenge Token
  const challenge = generateQRChallenge(sessionId, institutionId, 20);
  const verifyRes = verifyQRChallenge(challenge.rawToken, sessionId);
  if (verifyRes.valid && verifyRes.payload?.sessionId === sessionId) {
    console.log('  [PASS] Fresh valid QR token verified with HMAC-SHA256 signature.');
  } else {
    throw new Error('QR test failed: Fresh token should be valid.');
  }

  // Test 2: Expired Token Rejection
  const expiredChallenge = generateQRChallenge(sessionId, institutionId, -5); // expired 5s ago
  const expiredRes = verifyQRChallenge(expiredChallenge.rawToken, sessionId);
  if (!expiredRes.valid && expiredRes.error?.includes('expired')) {
    console.log('  [PASS] Expired QR token was correctly REJECTED.');
  } else {
    throw new Error('QR test failed: Expired token was accepted.');
  }

  // Test 3: Tampered Token Signature Rejection
  const parts = challenge.rawToken.split('.');
  const tamperedToken = `${parts[0]}.forged_signature_xyz123`;
  const tamperedRes = verifyQRChallenge(tamperedToken, sessionId);
  if (!tamperedRes.valid && tamperedRes.error?.includes('mismatch')) {
    console.log('  [PASS] Tampered signature was correctly REJECTED.');
  } else {
    throw new Error('Security failure: Tampered signature was accepted.');
  }

  // Test 4: Cross-session Token Rejection
  const otherSessionId = '00000000-0000-0000-0000-000000000000';
  const wrongSessionRes = verifyQRChallenge(challenge.rawToken, otherSessionId);
  if (!wrongSessionRes.valid && wrongSessionRes.error?.includes('different session')) {
    console.log('  [PASS] Token generated for another session was correctly REJECTED.');
  } else {
    throw new Error('Security failure: Cross-session token was accepted.');
  }

  return true;
}
