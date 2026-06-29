// Encrypted key/value config for org.anvaya.one (Common control-plane). Holds operator-entered
// integration secrets like the Companies House API key — sealed at rest (AES-256-GCM under the org
// session secret), never returned in plaintext to the client.

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { OrgRegionRouter } from '../db/client';
import { ORG_CONFIG } from '../core.tokens';
import type { OrgConfig } from '../config';
import { sealConfig, openConfig } from '../shared/secret-box';
import * as s from '../db/schema';

@Injectable()
export class ConfigStore {
  constructor(private readonly router: OrgRegionRouter, @Inject(ORG_CONFIG) private readonly cfg: OrgConfig) {}
  private get db() { return this.router.common(); }

  async get(key: string): Promise<string | undefined> {
    const row = (await this.db.select().from(s.orgConfig).where(eq(s.orgConfig.id, key)))[0];
    if (!row?.valueEnc) return undefined;
    try { return openConfig(row.valueEnc, this.cfg.sessionSecret); } catch { return undefined; }
  }

  async isSet(key: string): Promise<boolean> {
    const row = (await this.db.select().from(s.orgConfig).where(eq(s.orgConfig.id, key)))[0];
    return Boolean(row?.valueEnc);
  }

  /** Non-secret metadata for a config key (set status + provenance). Never returns the value. */
  async info(key: string): Promise<{ isSet: boolean; updatedBy?: string; updatedAt?: number }> {
    const row = (await this.db.select().from(s.orgConfig).where(eq(s.orgConfig.id, key)))[0];
    if (!row) return { isSet: false };
    return { isSet: Boolean(row.valueEnc), updatedBy: row.updatedBy, updatedAt: row.updatedAt };
  }

  async set(key: string, value: string, by: string): Promise<void> {
    const now = Date.now();
    const valueEnc = sealConfig(value, this.cfg.sessionSecret);
    const existing = (await this.db.select().from(s.orgConfig).where(eq(s.orgConfig.id, key)))[0];
    if (existing) await this.db.update(s.orgConfig).set({ valueEnc, updatedBy: by, updatedAt: now }).where(eq(s.orgConfig.id, key));
    else await this.db.insert(s.orgConfig).values({ id: key, valueEnc, updatedBy: by, createdAt: now, updatedAt: now });
  }

  async clear(key: string): Promise<void> {
    await this.db.delete(s.orgConfig).where(eq(s.orgConfig.id, key));
  }
}
