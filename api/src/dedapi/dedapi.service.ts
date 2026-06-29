import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { generateApiKey, parseApiKey, verifySecret } from '../shared';
import type { GuidanceItem, RegionCode } from '../shared';
import { OrgRegionRouter } from '../db/client';
import { AuditService } from '../audit/audit.service';
import { evaluateGovernanceRules, type ValidateIssue } from '../governance/validate';
import type { OrgPrincipal } from '../auth/auth.service';
import * as s from '../db/schema';

export interface DedapiKeyView { id: string; name: string; prefix: string; scopes: string[]; region: string | null; status: string; createdAt: number; lastUsedAt: number | null }

const DEFAULT_SCOPES = ['guidance:read', 'rules:read', 'validate'];

// The dedapi provider: serves the governed catalogue + rules + profile validation to consuming
// platforms (me.anvaya) over an API-key-authenticated channel, plus key lifecycle for admins.
@Injectable()
export class DedapiService {
  constructor(private readonly router: OrgRegionRouter, private readonly audit: AuditService) {}
  private get common() { return this.router.common(); }

  // --- API-key auth (used by the guard) — keys live in the Common control plane ---
  async authenticate(presented: string): Promise<{ id: string; scopes: string[]; region: string | null } | null> {
    const parsed = parseApiKey(presented);
    if (!parsed) return null;
    const row = (await this.common.select().from(s.dedapiKeys).where(and(eq(s.dedapiKeys.prefix, parsed.prefix), eq(s.dedapiKeys.status, 'active'))))[0];
    if (!row) return null;
    if (!verifySecret(presented, row.prefix, row.hashedSecret)) return null;
    void this.common.update(s.dedapiKeys).set({ lastUsedAt: Date.now() }).where(eq(s.dedapiKeys.id, row.id)).catch(() => undefined);
    return { id: row.id, scopes: row.scopes, region: row.region };
  }

  // --- Served (governed) data — read from the COUNTRY cell ---
  async guidance(country: string, entityType: string): Promise<GuidanceItem[]> {
    const rows = await this.router.db(country as RegionCode).select().from(s.guidanceCatalog)
      .where(and(eq(s.guidanceCatalog.country, country), eq(s.guidanceCatalog.entityType, entityType), eq(s.guidanceCatalog.status, 'active')));
    return rows
      .sort((a, b) => a.sequence - b.sequence)
      .map((r) => ({
        id: r.id, country: r.country as RegionCode, entityType: r.entityType, kind: r.kind as GuidanceItem['kind'],
        label: r.label, ...(r.url ? { url: r.url } : {}), ...(r.summary ? { summary: r.summary } : {}),
        governedBy: r.governedBy, sequence: r.sequence,
      }));
  }

  async compliance(country: string, entityType?: string) {
    const t = (entityType ?? '').trim();
    const rows = await this.router.db(country as RegionCode).select().from(s.complianceNotes)
      .where(and(eq(s.complianceNotes.country, country), eq(s.complianceNotes.status, 'active')));
    return rows
      .filter((r) => r.entityType === '*' || !t || r.entityType === t)
      .sort((a, b) => a.sequence - b.sequence)
      .map((r) => ({ id: r.id, country: r.country as RegionCode, entityType: r.entityType, title: r.title, body: r.body, severity: r.severity, ...(r.url ? { url: r.url } : {}), governedBy: r.governedBy, sequence: r.sequence }));
  }

  async rules(country: string, entityType: string) {
    const rows = await this.router.db(country as RegionCode).select().from(s.governanceRules)
      .where(and(eq(s.governanceRules.country, country), eq(s.governanceRules.entityType, entityType), eq(s.governanceRules.status, 'active')));
    return rows.map((r) => ({ id: r.id, ruleKind: r.ruleKind, config: r.config as Record<string, unknown>, description: r.description }));
  }

  async metadata() {
    const byCountry = new Map<string, Set<string>>();
    let total = 0;
    for (const region of (this.router.regions().length ? this.router.regions() : (['IN', 'UK', 'US'] as RegionCode[]))) {
      const rows = await this.router.db(region).select({ country: s.guidanceCatalog.country, entityType: s.guidanceCatalog.entityType })
        .from(s.guidanceCatalog).where(eq(s.guidanceCatalog.status, 'active'));
      total += rows.length;
      for (const r of rows) {
        if (!byCountry.has(r.country)) byCountry.set(r.country, new Set());
        byCountry.get(r.country)!.add(r.entityType);
      }
    }
    return {
      governedBy: 'org.anvaya.one',
      countries: [...byCountry.keys()].sort(),
      types: Object.fromEntries([...byCountry.entries()].map(([c, set]) => [c, [...set].sort()])),
      total,
    };
  }

  /** Validate a draft profile/record against the governed rules for its country + type. */
  async validateProfile(country: string, entityType: string, payload: Record<string, unknown>): Promise<{ valid: boolean; issues: ValidateIssue[] }> {
    const rules = await this.rules(country, entityType);
    const issues = evaluateGovernanceRules(rules, payload);
    return { valid: issues.length === 0, issues };
  }

  // --- Key lifecycle (admin) ---
  async listKeys(): Promise<DedapiKeyView[]> {
    const rows = await this.common.select().from(s.dedapiKeys).orderBy(sql`${s.dedapiKeys.createdAt} desc`);
    return rows.map((r) => ({ id: r.id, name: r.name, prefix: r.prefix, scopes: r.scopes, region: r.region, status: r.status, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt }));
  }

  /** Issue a new key — the plaintext is returned ONCE and never stored. */
  async createKey(by: OrgPrincipal, name: string, scopes?: string[], region?: string): Promise<{ key: DedapiKeyView; plaintext: string }> {
    if (!name?.trim()) throw new BadRequestException('Give the key a name (the consuming platform).');
    const gen = generateApiKey('live');
    const id = `dk_${randomBytes(8).toString('hex')}`;
    const now = Date.now();
    const scopeList = (scopes && scopes.length ? scopes : DEFAULT_SCOPES).filter((x) => DEFAULT_SCOPES.includes(x));
    await this.common.insert(s.dedapiKeys).values({
      id, name: name.trim(), prefix: gen.prefix, hashedSecret: gen.hashedSecret, scopes: scopeList,
      region: region && region.trim() ? region.trim() : null, status: 'active', createdBy: by.userId, createdAt: now,
    });
    await this.audit.record('dedapi_key', 'INSERT', id, by.userId, undefined, { name, scopes: scopeList, region });
    return { key: { id, name: name.trim(), prefix: gen.prefix, scopes: scopeList, region: region ?? null, status: 'active', createdAt: now, lastUsedAt: null }, plaintext: gen.plaintext };
  }

  async revokeKey(by: OrgPrincipal, id: string): Promise<{ ok: true }> {
    const row = (await this.common.select().from(s.dedapiKeys).where(eq(s.dedapiKeys.id, id)))[0];
    if (!row) throw new ForbiddenException('Unknown key.');
    await this.common.update(s.dedapiKeys).set({ status: 'revoked' }).where(eq(s.dedapiKeys.id, id));
    await this.audit.record('dedapi_key', 'UPDATE', id, by.userId, { status: row.status }, { status: 'revoked' });
    return { ok: true };
  }
}
