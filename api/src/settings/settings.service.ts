// Platform configuration management for org.anvaya.one (owner/admin). A typed registry of managed
// settings — integration API keys (e.g. Companies House) and platform settings — stored encrypted at
// rest via ConfigStore. Secret values are NEVER returned to the client (only set-status + provenance);
// every change is recorded in the tamper-evident audit chain. Mirrors me.anvaya's Secrets & Keys.

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigStore } from './config-store';
import { AuditService } from '../audit/audit.service';
import { OrgRegionRouter } from '../db/client';
import { ORG_CONFIG } from '../core.tokens';
import type { OrgConfig } from '../config';
import type { OrgPrincipal } from '../auth/auth.service';

export type ConfigCategory = 'integration' | 'platform';
export interface ConfigEntryDef { id: string; label: string; category: ConfigCategory; secret: boolean; help?: string; placeholder?: string }

// The known, managed settings. Adding an integration/setting is a one-line registry edit — the
// console renders it automatically. `secret:true` ⇒ the value is write-only (masked, never returned).
export const CONFIG_REGISTRY: ConfigEntryDef[] = [
  {
    id: 'companies_house.api_key', label: 'Companies House API key (UK)', category: 'integration', secret: true,
    help: 'Live REST key from developer.company-information.service.gov.uk — verifies UK organisations (Verify tab + dedapi).',
  },
  { id: 'platform.display_name', label: 'Platform display name', category: 'platform', secret: false, placeholder: 'org.anvaya.one' },
  { id: 'platform.support_email', label: 'Support email', category: 'platform', secret: false, placeholder: 'support@org.anvaya.one' },
];

export interface ConfigEntryView extends ConfigEntryDef { isSet: boolean; value?: string; updatedBy?: string; updatedAt?: number }

@Injectable()
export class SettingsService {
  constructor(
    private readonly store: ConfigStore,
    private readonly audit: AuditService,
    @Inject(ORG_CONFIG) private readonly cfg: OrgConfig,
    private readonly router: OrgRegionRouter,
  ) {}

  private def(id: string): ConfigEntryDef {
    const d = CONFIG_REGISTRY.find((e) => e.id === id);
    if (!d) throw new BadRequestException('Unknown setting.');
    return d;
  }

  /** All managed settings with set-status + provenance. Non-secret values are returned for editing;
   *  secret values are never included. */
  async list(): Promise<ConfigEntryView[]> {
    const out: ConfigEntryView[] = [];
    for (const d of CONFIG_REGISTRY) {
      const info = await this.store.info(d.id);
      const view: ConfigEntryView = {
        ...d, isSet: info.isSet,
        ...(info.updatedBy ? { updatedBy: info.updatedBy } : {}),
        ...(info.updatedAt ? { updatedAt: info.updatedAt } : {}),
      };
      if (!d.secret && info.isSet) {
        const v = await this.store.get(d.id);
        if (v !== undefined) view.value = v;
      }
      out.push(view);
    }
    return out;
  }

  async set(p: OrgPrincipal, id: string, value: string) {
    const d = this.def(id);
    if (!value.trim()) throw new BadRequestException('A value is required.');
    await this.store.set(id, value.trim(), p.userId);
    // Audit records the change of THIS key — never the value (secret-safe).
    await this.audit.record('config', 'UPDATE', id, p.userId, undefined, { id, secret: d.secret });
    return { ok: true as const };
  }

  async clear(p: OrgPrincipal, id: string) {
    this.def(id);
    await this.store.clear(id);
    await this.audit.record('config', 'DELETE', id, p.userId);
    return { ok: true as const };
  }

  /** Non-secret live runtime configuration (operator diagnostics readout). */
  runtime() {
    return {
      governedBy: this.cfg.governedBy,
      defaultRegion: this.cfg.defaultRegion,
      regions: this.router.regions(),
      commonConfigured: this.cfg.commonUrl !== null,
      appOrigins: this.cfg.appOrigins,
    };
  }
}
