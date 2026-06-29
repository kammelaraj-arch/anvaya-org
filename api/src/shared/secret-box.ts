// Minimal authenticated encryption for stored config secrets (e.g. the Companies House API key).
// AES-256-GCM with a key derived from the org session secret. Self-contained (node:crypto). The
// stored blob is base64(iv|tag|ciphertext); tampering fails the GCM auth check on open.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, 'org-config-v1', 32);
}

export function sealConfig(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function openConfig(blob: string, secret: string): string {
  const b = Buffer.from(blob, 'base64');
  const iv = b.subarray(0, 12);
  const tag = b.subarray(12, 28);
  const enc = b.subarray(28);
  const dec = createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(enc), dec.final()]).toString('utf8');
}
