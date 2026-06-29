// API-key crypto (vendored — formerly @anvaya/domain/secrets/api-key). The plaintext secret is
// generated with a CSPRNG, returned EXACTLY ONCE, and never stored — only its salted SHA-256 hash is
// retained. Verification is constant-time (crypto.timingSafeEqual).

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const SECRET_BYTES = 32;
const PREFIX_RANDOM_BYTES = 4;

function b64url(buf: Buffer): string { return buf.toString('base64url'); }

export function hashSecret(plaintext: string, prefix: string): string {
  const digest = createHash('sha256').update(`${prefix}:${plaintext}`).digest('hex');
  return `sha256:${digest}`;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifySecret(plaintext: string, prefix: string, hashedSecret: string): boolean {
  return safeEqual(hashSecret(plaintext, prefix), hashedSecret);
}

export interface GeneratedApiKey { plaintext: string; prefix: string; hashedSecret: string }

export function generateApiKey(env: 'live' | 'test' = 'live'): GeneratedApiKey {
  const prefix = `anv_${env}_${b64url(randomBytes(PREFIX_RANDOM_BYTES))}`;
  const secret = b64url(randomBytes(SECRET_BYTES));
  const plaintext = `${prefix}.${secret}`;
  return { plaintext, prefix, hashedSecret: hashSecret(plaintext, prefix) };
}

export function parseApiKey(presented: string): { prefix: string } | undefined {
  const dot = presented.indexOf('.');
  if (dot <= 0) return undefined;
  return { prefix: presented.slice(0, dot) };
}
