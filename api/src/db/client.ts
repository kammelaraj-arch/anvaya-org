// OrgRegionRouter — resolves the datastore for org.anvaya.one, mirroring me.anvaya's RegionRouter:
//   • common()      → the control-plane DB (org admins, API keys, audit chain).
//   • db(region)    → a country fabric cell DB (guidance catalogue + governance rules for that country).
// Lazy: a pool is created on first use, so importing never connects. Single-DB deployments (only
// ORG_DATABASE_URL) get every handle pointed at the one database.

import { Inject, Injectable } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pgPkg from 'pg';
import type { RegionCode } from '../shared';
import { ORG_CONFIG } from '../core.tokens';
import type { OrgConfig, OrgRegionDbConfig } from '../config';
import * as schema from './schema';

const { Pool } = pgPkg;
export type OrgDb = NodePgDatabase<typeof schema>;

interface Cell { config: OrgRegionDbConfig; db?: OrgDb; pool?: pgPkg.Pool }

@Injectable()
export class OrgRegionRouter {
  private readonly cells = new Map<RegionCode, Cell>();
  private readonly commonUrl: string | null;
  private commonDb?: OrgDb;
  private commonPool?: pgPkg.Pool;
  readonly defaultRegion: RegionCode;

  constructor(@Inject(ORG_CONFIG) config: OrgConfig) {
    this.defaultRegion = config.defaultRegion;
    this.commonUrl = config.commonUrl;
    for (const c of config.regions) this.cells.set(c.region, { config: c });
  }

  /** Control-plane DB: org admins, dedapi keys, audit. Falls back to the default cell's DB. */
  common(): OrgDb {
    if (!this.commonDb) {
      const url = this.commonUrl ?? this.cell(this.defaultRegion).config.databaseUrl;
      this.commonPool = new Pool({ connectionString: url });
      this.commonDb = drizzle(this.commonPool, { schema });
    }
    return this.commonDb;
  }

  /** Configured country fabric cells. */
  regions(): RegionCode[] {
    return [...this.cells.keys()];
  }

  hasRegion(region: RegionCode): boolean { return this.cells.has(region); }

  /** A country cell DB — created on first use. Falls back to the default cell for an unknown region. */
  db(region: RegionCode): OrgDb {
    const cell = this.cells.get(region) ?? this.cells.get(this.defaultRegion);
    if (!cell) throw new Error(`No org fabric cell configured for '${region}'. Set ORG_DATABASE_URL_${region}.`);
    if (!cell.db) {
      cell.pool = new Pool({ connectionString: cell.config.databaseUrl });
      cell.db = drizzle(cell.pool, { schema });
    }
    return cell.db;
  }

  async close(): Promise<void> {
    for (const cell of this.cells.values()) await cell.pool?.end().catch(() => undefined);
    await this.commonPool?.end().catch(() => undefined);
  }

  private cell(region: RegionCode): Cell {
    const cell = this.cells.get(region);
    if (!cell) throw new Error(`No org fabric cell configured for '${region}'.`);
    return cell;
  }
}
