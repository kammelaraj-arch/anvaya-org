// Tamper-evident audit hash-chain (vendored — formerly @anvaya/domain/audit/hash-chain). Each entry
// hashes its own fields PLUS the previous entry's hash, so any insertion/edit/deletion of history
// breaks the chain and is detectable by re-running verifyChain. Pure (node:crypto only). Never hashes
// plaintext/PII — only the snapshot hashes the caller already computed.

import { createHash } from 'node:crypto';
import type { AuditLogEntry } from './types';

export type AuditEntryInput = Omit<AuditLogEntry, 'entryHash' | 'prevEntryHash'>;

export interface ChainVerification { ok: boolean; length: number; brokenAt?: number; reason?: string }

export function computeEntryHash(entry: Omit<AuditLogEntry, 'entryHash'>): string {
  const canonical = [
    entry.id, entry.entity, entry.operation, entry.rowId,
    entry.beforeHash ?? '', entry.afterHash ?? '', entry.prevEntryHash ?? '',
    entry.changedBy, String(entry.changedAt),
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

export function appendEntry(prev: AuditLogEntry | undefined, input: AuditEntryInput): AuditLogEntry {
  const linked: Omit<AuditLogEntry, 'entryHash'> = prev ? { ...input, prevEntryHash: prev.entryHash } : { ...input };
  return { ...linked, entryHash: computeEntryHash(linked) };
}

export function verifyChain(entries: AuditLogEntry[]): ChainVerification {
  let prevHash: string | undefined;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if ((e.prevEntryHash ?? undefined) !== prevHash) {
      return { ok: false, length: entries.length, brokenAt: i, reason: 'previous-hash link mismatch' };
    }
    if (computeEntryHash(e) !== e.entryHash) {
      return { ok: false, length: entries.length, brokenAt: i, reason: 'entry hash mismatch (content altered)' };
    }
    prevHash = e.entryHash;
  }
  return { ok: true, length: entries.length };
}
