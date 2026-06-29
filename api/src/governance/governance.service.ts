import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { RegionCode } from '../shared';
import { OrgRegionRouter } from '../db/client';
import { AuditService } from '../audit/audit.service';
import type { OrgPrincipal } from '../auth/auth.service';
import * as s from '../db/schema';

const COUNTRIES: RegionCode[] = ['IN', 'UK', 'US'];
const KINDS = ['apply', 'renew', 'lost', 'contact', 'embassy', 'emergency', 'guidance', 'support'];
const RULE_KINDS = ['required_field', 'min_age', 'id_format', 'note'];
const rid = () => randomBytes(8).toString('hex');

export interface GuidanceInput { id?: string; country: string; entityType: string; kind: string; label: string; url?: string; summary?: string; sequence?: number; status?: string }
export interface RuleInput { id?: string; country: string; entityType: string; ruleKind: string; config?: Record<string, unknown>; description?: string; status?: string }
export interface ComplianceInput { id?: string; country: string; entityType?: string; title: string; body: string; severity?: string; url?: string; status?: string }
const SEVERITIES = ['info', 'rights', 'legal'];

// Governance of the per-country fabric catalogue + rules — the SOURCE OF TRUTH org.anvaya.one owns.
// Guidance + rules live in the COUNTRY CELL (db(country)); writes are audited (in the Common chain).
@Injectable()
export class GovernanceService {
  constructor(private readonly router: OrgRegionRouter, private readonly audit: AuditService) {}

  private cells(): RegionCode[] { return this.router.regions().length ? this.router.regions() : COUNTRIES; }

  async listGuidance(country?: string, entityType?: string) {
    const regions = country ? [country as RegionCode] : this.cells();
    const out: (typeof s.guidanceCatalog.$inferSelect)[] = [];
    for (const r of regions) {
      const where = [eq(s.guidanceCatalog.country, r), entityType ? eq(s.guidanceCatalog.entityType, entityType) : undefined].filter(Boolean);
      out.push(...await this.router.db(r).select().from(s.guidanceCatalog).where(and(...where)));
    }
    return out.sort((a, b) => a.country.localeCompare(b.country) || a.entityType.localeCompare(b.entityType) || a.sequence - b.sequence);
  }

  async setGuidance(by: OrgPrincipal, g: GuidanceInput) {
    if (!COUNTRIES.includes(g.country as RegionCode)) throw new BadRequestException('Unknown country.');
    if (!KINDS.includes(g.kind)) throw new BadRequestException('Unknown guidance kind.');
    if (!g.entityType?.trim() || !g.label?.trim()) throw new BadRequestException('Type and label are required.');
    const db = this.router.db(g.country as RegionCode);
    const id = g.id?.trim() || `gd_${g.country}_${g.entityType}_${g.kind}_${rid()}`.toLowerCase();
    const now = Date.now();
    const existing = (await db.select().from(s.guidanceCatalog).where(eq(s.guidanceCatalog.id, id)))[0];
    const v = {
      country: g.country, entityType: g.entityType.trim(), kind: g.kind, label: g.label.trim(),
      url: g.url?.trim() || null, summary: g.summary?.trim() || null, sequence: g.sequence ?? KINDS.indexOf(g.kind),
      status: g.status ?? 'active', updatedBy: by.userId, updatedAt: now,
    };
    if (existing) {
      await db.update(s.guidanceCatalog).set(v).where(eq(s.guidanceCatalog.id, id));
      await this.audit.record('guidance', 'UPDATE', id, by.userId, existing, v);
    } else {
      await db.insert(s.guidanceCatalog).values({ id, governedBy: 'org.anvaya.one', createdAt: now, ...v });
      await this.audit.record('guidance', 'INSERT', id, by.userId, undefined, v);
    }
    return { id };
  }

  async deleteGuidance(by: OrgPrincipal, id: string) {
    for (const r of this.cells()) await this.router.db(r).delete(s.guidanceCatalog).where(eq(s.guidanceCatalog.id, id));
    await this.audit.record('guidance', 'DELETE', id, by.userId);
    return { ok: true as const };
  }

  async listRules(country?: string, entityType?: string) {
    const regions = country ? [country as RegionCode] : this.cells();
    const out: (typeof s.governanceRules.$inferSelect)[] = [];
    for (const r of regions) {
      const where = [eq(s.governanceRules.country, r), entityType ? eq(s.governanceRules.entityType, entityType) : undefined].filter(Boolean);
      out.push(...await this.router.db(r).select().from(s.governanceRules).where(and(...where)));
    }
    return out.sort((a, b) => a.country.localeCompare(b.country) || a.entityType.localeCompare(b.entityType));
  }

  async setRule(by: OrgPrincipal, r: RuleInput) {
    if (!COUNTRIES.includes(r.country as RegionCode)) throw new BadRequestException('Unknown country.');
    if (!RULE_KINDS.includes(r.ruleKind)) throw new BadRequestException('Unknown rule kind.');
    if (!r.entityType?.trim()) throw new BadRequestException('Type is required.');
    const db = this.router.db(r.country as RegionCode);
    const id = r.id?.trim() || `gr_${rid()}`;
    const now = Date.now();
    const existing = (await db.select().from(s.governanceRules).where(eq(s.governanceRules.id, id)))[0];
    const v = {
      country: r.country, entityType: r.entityType.trim(), ruleKind: r.ruleKind, config: r.config ?? {},
      description: r.description?.trim() || null, status: r.status ?? 'active', updatedBy: by.userId, updatedAt: now,
    };
    if (existing) {
      await db.update(s.governanceRules).set(v).where(eq(s.governanceRules.id, id));
      await this.audit.record('rule', 'UPDATE', id, by.userId, existing, v);
    } else {
      await db.insert(s.governanceRules).values({ id, createdAt: now, ...v });
      await this.audit.record('rule', 'INSERT', id, by.userId, undefined, v);
    }
    return { id };
  }

  async deleteRule(by: OrgPrincipal, id: string) {
    for (const r of this.cells()) await this.router.db(r).delete(s.governanceRules).where(eq(s.governanceRules.id, id));
    await this.audit.record('rule', 'DELETE', id, by.userId);
    return { ok: true as const };
  }

  async listCompliance(country?: string, entityType?: string) {
    const regions = country ? [country as RegionCode] : this.cells();
    const out: (typeof s.complianceNotes.$inferSelect)[] = [];
    for (const r of regions) {
      const where = [eq(s.complianceNotes.country, r), entityType ? eq(s.complianceNotes.entityType, entityType) : undefined].filter(Boolean);
      out.push(...await this.router.db(r).select().from(s.complianceNotes).where(and(...where)));
    }
    return out.sort((a, b) => a.country.localeCompare(b.country) || a.entityType.localeCompare(b.entityType) || a.sequence - b.sequence);
  }

  async setCompliance(by: OrgPrincipal, n: ComplianceInput) {
    if (!COUNTRIES.includes(n.country as RegionCode)) throw new BadRequestException('Unknown country.');
    if (!n.title?.trim() || !n.body?.trim()) throw new BadRequestException('Title and body are required.');
    const severity = SEVERITIES.includes(n.severity ?? '') ? n.severity! : 'info';
    const db = this.router.db(n.country as RegionCode);
    const entityType = n.entityType?.trim() || '*';
    const id = n.id?.trim() || `cn_${n.country}_${entityType}_${severity}_${rid()}`.toLowerCase().replace(/\*/g, 'all');
    const now = Date.now();
    const existing = (await db.select().from(s.complianceNotes).where(eq(s.complianceNotes.id, id)))[0];
    const v = {
      country: n.country, entityType, title: n.title.trim(), body: n.body.trim(), severity,
      url: n.url?.trim() || null, status: n.status ?? 'active', updatedBy: by.userId, updatedAt: now,
    };
    if (existing) {
      await db.update(s.complianceNotes).set(v).where(eq(s.complianceNotes.id, id));
      await this.audit.record('compliance', 'UPDATE', id, by.userId, existing, v);
    } else {
      await db.insert(s.complianceNotes).values({ id, governedBy: 'org.anvaya.one', sequence: 0, createdAt: now, ...v });
      await this.audit.record('compliance', 'INSERT', id, by.userId, undefined, v);
    }
    return { id };
  }

  async deleteCompliance(by: OrgPrincipal, id: string) {
    for (const r of this.cells()) await this.router.db(r).delete(s.complianceNotes).where(eq(s.complianceNotes.id, id));
    await this.audit.record('compliance', 'DELETE', id, by.userId);
    return { ok: true as const };
  }

  meta() {
    return { countries: COUNTRIES, kinds: KINDS, ruleKinds: RULE_KINDS, severities: SEVERITIES };
  }

  /** Per-country fabric overview: each cell's reachability + governed-content counts. Proves the
   *  per-country topology is live and shows where governed content sits. */
  async overview() {
    const cells: { country: RegionCode; online: boolean; guidance: number; rules: number; compliance: number }[] = [];
    for (const r of this.cells()) {
      try {
        const g = await this.router.db(r).select().from(s.guidanceCatalog).where(eq(s.guidanceCatalog.country, r));
        const ru = await this.router.db(r).select().from(s.governanceRules).where(eq(s.governanceRules.country, r));
        const cn = await this.router.db(r).select().from(s.complianceNotes).where(eq(s.complianceNotes.country, r));
        cells.push({ country: r, online: true, guidance: g.length, rules: ru.length, compliance: cn.length });
      } catch {
        cells.push({ country: r, online: false, guidance: 0, rules: 0, compliance: 0 });
      }
    }
    return { cells };
  }
}
