// Idempotent migration + governed seed for org.anvaya.one, split like me.anvaya:
//   migrateCommon(url)        → org_users, dedapi_keys, audit_log   (control plane)
//   migrateCell(url, region)  → guidance_catalog, governance_rules  (that country's fabric) + seed
// Raw SQL (no engine binary). Single-DB deployments get both schemas on one database.

import pgPkg from 'pg';
import { GUIDANCE_SEED, guidanceSeedId, GUIDANCE_KIND_ORDER, COMPLIANCE_SEED, complianceSeedId } from '../shared';
import type { RegionCode } from '../shared';

// --- Control plane (Common DB): org admins + dedapi keys + audit chain. No country content. ---
const COMMON_DDL = `
CREATE TABLE IF NOT EXISTS org_users (
  id varchar(64) PRIMARY KEY, email varchar(200) NOT NULL UNIQUE, password_hash text NOT NULL,
  display_name text, role varchar(16) NOT NULL DEFAULT 'viewer', status varchar(24) NOT NULL DEFAULT 'active',
  created_by varchar(64) NOT NULL, created_at bigint NOT NULL, updated_at bigint NOT NULL, last_login bigint
);
CREATE TABLE IF NOT EXISTS dedapi_keys (
  id varchar(64) PRIMARY KEY, name text NOT NULL, prefix varchar(64) NOT NULL UNIQUE,
  hashed_secret text NOT NULL, scopes text[] NOT NULL, region varchar(4),
  status varchar(16) NOT NULL DEFAULT 'active', created_by varchar(64) NOT NULL,
  created_at bigint NOT NULL, last_used_at bigint
);
CREATE TABLE IF NOT EXISTS audit_log (
  id varchar(64) PRIMARY KEY, entity varchar(80) NOT NULL, operation varchar(16) NOT NULL,
  row_id varchar(96) NOT NULL, before_hash text, after_hash text, prev_entry_hash text,
  entry_hash text NOT NULL, changed_by varchar(64) NOT NULL, changed_at bigint NOT NULL
);
`;

// --- Country fabric cell (per-region DB): the governed guidance + rules for THAT country. ---
const CELL_DDL = `
CREATE TABLE IF NOT EXISTS guidance_catalog (
  id varchar(96) PRIMARY KEY, country varchar(4) NOT NULL, entity_type varchar(48) NOT NULL,
  kind varchar(16) NOT NULL, label text NOT NULL, url text, summary text,
  sequence bigint NOT NULL DEFAULT 0, governed_by varchar(48) NOT NULL DEFAULT 'org.anvaya.one',
  status varchar(24) NOT NULL DEFAULT 'active', updated_by varchar(64) NOT NULL,
  created_at bigint NOT NULL, updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS guidance_catalog_lookup_idx ON guidance_catalog (country, entity_type, status);
CREATE TABLE IF NOT EXISTS governance_rules (
  id varchar(96) PRIMARY KEY, country varchar(4) NOT NULL, entity_type varchar(48) NOT NULL,
  rule_kind varchar(32) NOT NULL, config jsonb NOT NULL DEFAULT '{}', description text,
  status varchar(24) NOT NULL DEFAULT 'active', updated_by varchar(64) NOT NULL,
  created_at bigint NOT NULL, updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS governance_rules_lookup_idx ON governance_rules (country, entity_type, status);
CREATE TABLE IF NOT EXISTS compliance_notes (
  id varchar(96) PRIMARY KEY, country varchar(4) NOT NULL, entity_type varchar(48) NOT NULL DEFAULT '*',
  title text NOT NULL, body text NOT NULL, severity varchar(12) NOT NULL DEFAULT 'info', url text,
  sequence bigint NOT NULL DEFAULT 0, governed_by varchar(48) NOT NULL DEFAULT 'org.anvaya.one',
  status varchar(24) NOT NULL DEFAULT 'active', updated_by varchar(64) NOT NULL,
  created_at bigint NOT NULL, updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS compliance_notes_lookup_idx ON compliance_notes (country, entity_type, status);
`;

const esc = (s: string) => s.replace(/'/g, "''");

// Seed ONLY this country's governed guidance into its cell (insert-missing, so admin edits stick).
function guidanceSeedSql(region: RegionCode, now: number): string {
  const rows = GUIDANCE_SEED.filter((s) => s.country === region);
  if (!rows.length) return '';
  const values = rows.map((s) => {
    const id = guidanceSeedId(s);
    const seq = GUIDANCE_KIND_ORDER.indexOf(s.kind);
    const url = s.url ? `'${esc(s.url)}'` : 'NULL';
    const summary = s.summary ? `'${esc(s.summary)}'` : 'NULL';
    return `('${id}','${s.country}','${esc(s.entityType)}','${s.kind}','${esc(s.label)}',${url},${summary},${seq},'org.anvaya.one','active','system',${now},${now})`;
  }).join(',\n ');
  return `INSERT INTO guidance_catalog (id,country,entity_type,kind,label,url,summary,sequence,governed_by,status,updated_by,created_at,updated_at) VALUES
 ${values}
ON CONFLICT (id) DO NOTHING;
`;
}

// Seed ONLY this country's compliance notices into its cell (insert-missing).
function complianceSeedSql(region: RegionCode, now: number): string {
  const rows = COMPLIANCE_SEED.filter((s) => s.country === region);
  if (!rows.length) return '';
  const values = rows.map((s, i) => {
    const id = complianceSeedId(s);
    const url = s.url ? `'${esc(s.url)}'` : 'NULL';
    return `('${id}','${s.country}','${esc(s.entityType)}','${esc(s.title)}','${esc(s.body)}','${s.severity}',${url},${i},'org.anvaya.one','active','system',${now},${now})`;
  }).join(',\n ');
  return `INSERT INTO compliance_notes (id,country,entity_type,title,body,severity,url,sequence,governed_by,status,updated_by,created_at,updated_at) VALUES
 ${values}
ON CONFLICT (id) DO NOTHING;
`;
}

async function run(connectionString: string, sql: string): Promise<void> {
  const client = new pgPkg.Client({ connectionString });
  await client.connect();
  try { await client.query(sql); } finally { await client.end(); }
}

export async function migrateCommon(connectionString: string): Promise<void> {
  await run(connectionString, COMMON_DDL);
}

export async function migrateCell(connectionString: string, region: RegionCode, now: number = Date.now()): Promise<void> {
  await run(connectionString, CELL_DDL + guidanceSeedSql(region, now) + complianceSeedSql(region, now));
}

/** Apply both schemas to one DB — single-DB deployments (every country seeded). */
export async function migrateOrg(connectionString: string, now: number = Date.now()): Promise<void> {
  const seeds = (['IN', 'UK', 'US'] as RegionCode[]).map((r) => guidanceSeedSql(r, now) + complianceSeedSql(r, now)).join('\n');
  await run(connectionString, COMMON_DDL + CELL_DDL + seeds);
}

if (require.main === module) {
  const base = process.env.ORG_DATABASE_URL ?? process.env.DATABASE_URL;
  const commonUrl = process.env.ORG_COMMON_DATABASE_URL ?? base;
  if (!commonUrl) { console.error('Set ORG_COMMON_DATABASE_URL and/or ORG_DATABASE_URL[_IN|_UK|_US]'); process.exit(1); }
  (async () => {
    await migrateCommon(commonUrl);
    // Group regions by DB URL so a dedicated cell DB is migrated once; shared/single-DB get all seeds.
    const byUrl = new Map<string, RegionCode[]>();
    for (const r of ['IN', 'UK', 'US'] as RegionCode[]) {
      const u = process.env[`ORG_DATABASE_URL_${r}`] ?? base;
      if (u) byUrl.set(u, [...(byUrl.get(u) ?? []), r]);
    }
    for (const [u, rs] of byUrl) {
      await run(u, CELL_DDL);
      for (const r of rs) await migrateCell(u, r);
    }
    console.log('org.anvaya.one migration complete');
    process.exit(0);
  })().catch((err) => { console.error(err); process.exit(1); });
}
