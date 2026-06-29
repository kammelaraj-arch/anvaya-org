// Runtime configuration for org.anvaya.one — region-aware, mirroring me.anvaya's fabric topology:
//   • Common DB (control plane): org admins, dedapi API keys, the audit chain. No country content.
//   • Per-country cells (DB India/UK/US): the governed guidance catalogue + governance rules for that
//     country, physically separated so a country's governed content lives in its own fabric.
// A single org-api process routes to all cells via OrgRegionRouter; splitting cells onto separate
// hosts/containers later is config (set ORG_DATABASE_URL_<REGION>), not a rewrite. Secrets come from
// env (a vault in production), never hardcoded.

import type { RegionCode } from './shared';

export interface OrgRegionDbConfig { region: RegionCode; databaseUrl: string }

export interface OrgConfig {
  port: number;
  sessionSecret: string;
  /** Country fabric cells available to this deployment (each its own DB; falls back to ORG_DATABASE_URL). */
  regions: OrgRegionDbConfig[];
  /** Default country for governance reads when none is specified. */
  defaultRegion: RegionCode;
  /** Control-plane (Common) DB — org admins + API keys + audit. Falls back to the default cell's DB. */
  commonUrl: string | null;
  appOrigins: string[];
  governedBy: string;
}

const REGIONS: RegionCode[] = ['IN', 'UK', 'US'];

function regionFromEnv(region: RegionCode): OrgRegionDbConfig | null {
  const url = process.env[`ORG_DATABASE_URL_${region}`] ?? process.env.ORG_DATABASE_URL ?? process.env.DATABASE_URL;
  return url ? { region, databaseUrl: url } : null;
}

export function loadConfig(): OrgConfig {
  const defaultRegion = (process.env.ORG_DEFAULT_REGION as RegionCode) ?? 'IN';
  const regions = REGIONS.map(regionFromEnv).filter((r): r is OrgRegionDbConfig => r !== null);
  return {
    port: Number(process.env.ORG_PORT ?? process.env.PORT ?? 4100),
    sessionSecret: process.env.ORG_SESSION_SECRET ?? process.env.SESSION_SECRET ?? 'org-anvaya-dev-secret',
    regions,
    defaultRegion,
    commonUrl: process.env.ORG_COMMON_DATABASE_URL ?? process.env.ORG_DATABASE_URL ?? process.env.DATABASE_URL ?? null,
    appOrigins: (process.env.ORG_APP_BASE ?? 'https://org.anvaya.one').split(',').map((s) => s.trim()).filter(Boolean),
    governedBy: process.env.ORG_GOVERNED_BY ?? 'org.anvaya.one',
  };
}
