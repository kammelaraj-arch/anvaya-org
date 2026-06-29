// Minimal signed session token (HMAC) — the cookie holds `<userId>.<sig>`, bound to the org session
// secret so it can't be forged. Stateless; rotate the secret to invalidate all sessions.

import { createHmac, timingSafeEqual } from 'node:crypto';

export function signSession(userId: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(userId).digest('base64url');
  return `${userId}.${sig}`;
}

export function verifySession(token: string | undefined, secret: string): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const expected = createHmac('sha256', secret).update(userId).digest('base64url');
  const got = token.slice(dot + 1);
  if (got.length !== expected.length) return null;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected)) ? userId : null;
  } catch {
    return null;
  }
}
