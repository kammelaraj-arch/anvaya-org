// Fabric cell configuration management for org.anvaya.one (owner/admin). Each country fabric cell
// (One Fabric IN/UK/US) carries operator-managed metadata + an enable flag in the Common DB, merged
// with the live topology (provisioned? online? guidance/rules/compliance counts) from GovernanceService.
// The physical DB connection itself stays env-level (ORG_DATABASE_URL_<R>) — this manages governance,
// not infrastructure. Every change is recorded in the audit chain.

import { BadRequestException, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { RegionCode } from '../shared';
import { OrgRegionRouter } from '../db/client';
import { AuditService } from '../audit/audit.service';
import { GovernanceService } from '../governance/governance.service';
import type { OrgPrincipal } from '../auth/auth.service';
import * as s from '../db/schema';

const COUNTRIES: RegionCode[] = ['IN', 'UK', 'US'];
const DEFAULT_NAME: Record<string, string> = { IN: 'One Fabric India', UK: 'One Fabric UK', US: 'One Fabric US' };

export interface CellInput { country: string; displayName?: string; enabled?: boolean; notes?: string }

@Injectable()
export class FabricService {
  constructor(
    private readonly router: OrgRegionRouter,
    private readonly audit: AuditService,
    private readonly gov: GovernanceService,
  ) {}
  private get db() { return this.router.common(); }

  /** Every fabric cell with its config + live status, for the console's Fabric view. */
  async listCells() {
    const rows = await this.db.select().from(s.fabricCells);
    const reg = new Map(rows.map((r) => [r.id, r]));
    const overview = await this.gov.overview();
    const counts = new Map(overview.cells.map((c) => [c.country, c]));
    const provisioned = this.router.regions();
    const cells = COUNTRIES.map((country) => {
      const r = reg.get(country);
      const o = counts.get(country);
      return {
        country,
        displayName: r?.displayName ?? DEFAULT_NAME[country] ?? `One Fabric ${country}`,
        enabled: r?.enabled ?? true,
        notes: r?.notes ?? null,
        provisioned: provisioned.includes(country),
        online: o?.online ?? false,
        guidance: o?.guidance ?? 0,
        rules: o?.rules ?? 0,
        compliance: o?.compliance ?? 0,
        updatedAt: r?.updatedAt ?? null,
      };
    });
    return { cells };
  }

  async upsertCell(p: OrgPrincipal, b: CellInput) {
    const country = (b.country ?? '').toUpperCase();
    if (!COUNTRIES.includes(country as RegionCode)) throw new BadRequestException('Unknown country.');
    const now = Date.now();
    const existing = (await this.db.select().from(s.fabricCells).where(eq(s.fabricCells.id, country)))[0];
    const v = {
      displayName: b.displayName?.trim() || existing?.displayName || DEFAULT_NAME[country] || `One Fabric ${country}`,
      enabled: b.enabled ?? existing?.enabled ?? true,
      notes: b.notes?.trim() || null,
      updatedBy: p.userId,
      updatedAt: now,
    };
    if (existing) {
      await this.db.update(s.fabricCells).set(v).where(eq(s.fabricCells.id, country));
      await this.audit.record('fabric_cell', 'UPDATE', country, p.userId, existing, v);
    } else {
      await this.db.insert(s.fabricCells).values({ id: country, sequence: COUNTRIES.indexOf(country as RegionCode), createdAt: now, ...v });
      await this.audit.record('fabric_cell', 'INSERT', country, p.userId, undefined, v);
    }
    return { country };
  }
}
