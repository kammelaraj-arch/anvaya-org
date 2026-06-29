import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { desc } from 'drizzle-orm';
import { appendEntry, verifyChain } from '../shared';
import type { AuditLogEntry, AuditOperation } from '../shared';
import { OrgRegionRouter } from '../db/client';
import * as s from '../db/schema';

const sha = (v: unknown): string | undefined =>
  v === undefined ? undefined : createHash('sha256').update(JSON.stringify(v)).digest('hex');

// Tamper-evident, hash-chained change log for governance actions. Reuses the @anvaya/domain
// primitives (appendEntry / verifyChain). Never stores plaintext — only snapshot hashes.
@Injectable()
export class AuditService {
  constructor(private readonly router: OrgRegionRouter) {}
  private get db() { return this.router.common(); }

  /** Append a chained entry for a governance change. before/after are snapshots (hashed, not stored). */
  async record(entity: string, operation: AuditOperation, rowId: string, changedBy: string, before?: unknown, after?: unknown): Promise<void> {
    const lastRow = (await this.db.select().from(s.auditLog).orderBy(desc(s.auditLog.changedAt)).limit(1))[0];
    const prev: AuditLogEntry | undefined = lastRow
      ? {
          id: lastRow.id, entity: lastRow.entity, operation: lastRow.operation as AuditOperation, rowId: lastRow.rowId,
          beforeHash: lastRow.beforeHash ?? undefined, afterHash: lastRow.afterHash ?? undefined,
          prevEntryHash: lastRow.prevEntryHash ?? undefined, entryHash: lastRow.entryHash,
          changedBy: lastRow.changedBy, changedAt: lastRow.changedAt,
        }
      : undefined;
    const entry = appendEntry(prev, {
      id: `al_${randomBytes(8).toString('hex')}`, entity, operation, rowId,
      beforeHash: sha(before), afterHash: sha(after), changedBy, changedAt: Date.now(),
    });
    await this.db.insert(s.auditLog).values({
      id: entry.id, entity: entry.entity, operation: entry.operation, rowId: entry.rowId,
      beforeHash: entry.beforeHash ?? null, afterHash: entry.afterHash ?? null,
      prevEntryHash: entry.prevEntryHash ?? null, entryHash: entry.entryHash,
      changedBy: entry.changedBy, changedAt: entry.changedAt,
    });
  }

  /** Re-run the chain verification over the whole log (integrity check). */
  async verify(): Promise<{ valid: boolean; count: number; reason?: string }> {
    const rows = await this.db.select().from(s.auditLog).orderBy(s.auditLog.changedAt);
    const entries: AuditLogEntry[] = rows.map((r) => ({
      id: r.id, entity: r.entity, operation: r.operation as AuditOperation, rowId: r.rowId,
      beforeHash: r.beforeHash ?? undefined, afterHash: r.afterHash ?? undefined,
      prevEntryHash: r.prevEntryHash ?? undefined, entryHash: r.entryHash, changedBy: r.changedBy, changedAt: r.changedAt,
    }));
    const res = verifyChain(entries);
    return { valid: res.ok, count: entries.length, ...(res.ok ? {} : { reason: res.reason ?? 'chain broken' }) };
  }
}
