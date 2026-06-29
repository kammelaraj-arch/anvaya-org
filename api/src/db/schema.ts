// org.anvaya.one control-plane schema (drizzle). Governance only — NO family personal data.
//   • org_users        — the organisation's administrators (owner/admin/editor/viewer).
//   • guidance_catalog — the GOVERNED country-specific guidance (source of truth) served via dedapi.
//   • governance_rules — per country/type rules (required fields, min age, …) used to validate.
//   • dedapi_keys      — API keys issued to consuming platforms (me.anvaya) for the dedapi channel.
//   • audit_log        — tamper-evident hash-chained change log.

import { pgTable, varchar, text, jsonb, bigint } from 'drizzle-orm/pg-core';

// Encrypted operator config (e.g. Companies House API key) — value sealed at rest.
export const orgConfig = pgTable('org_config', {
  id: varchar('id', { length: 96 }).primaryKey(),
  valueEnc: text('value_enc').notNull(),
  updatedBy: varchar('updated_by', { length: 64 }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const orgUsers = pgTable('org_users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  email: varchar('email', { length: 200 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  role: varchar('role', { length: 16 }).notNull().default('viewer'), // owner | admin | editor | viewer
  status: varchar('status', { length: 24 }).notNull().default('active'),
  createdBy: varchar('created_by', { length: 64 }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  lastLogin: bigint('last_login', { mode: 'number' }),
});

export const guidanceCatalog = pgTable('guidance_catalog', {
  id: varchar('id', { length: 96 }).primaryKey(),
  country: varchar('country', { length: 4 }).notNull(),
  entityType: varchar('entity_type', { length: 48 }).notNull(),
  kind: varchar('kind', { length: 16 }).notNull(),
  label: text('label').notNull(),
  url: text('url'),
  summary: text('summary'),
  sequence: bigint('sequence', { mode: 'number' }).notNull().default(0),
  governedBy: varchar('governed_by', { length: 48 }).notNull().default('org.anvaya.one'),
  status: varchar('status', { length: 24 }).notNull().default('active'),
  updatedBy: varchar('updated_by', { length: 64 }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const governanceRules = pgTable('governance_rules', {
  id: varchar('id', { length: 96 }).primaryKey(),
  country: varchar('country', { length: 4 }).notNull(),
  entityType: varchar('entity_type', { length: 48 }).notNull(),
  ruleKind: varchar('rule_kind', { length: 32 }).notNull(), // required_field | min_age | id_format | note
  config: jsonb('config').notNull().default({}),
  description: text('description'),
  status: varchar('status', { length: 24 }).notNull().default('active'),
  updatedBy: varchar('updated_by', { length: 64 }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const complianceNotes = pgTable('compliance_notes', {
  id: varchar('id', { length: 96 }).primaryKey(),
  country: varchar('country', { length: 4 }).notNull(),
  entityType: varchar('entity_type', { length: 48 }).notNull().default('*'),
  title: text('title').notNull(),
  body: text('body').notNull(),
  severity: varchar('severity', { length: 12 }).notNull().default('info'),
  url: text('url'),
  sequence: bigint('sequence', { mode: 'number' }).notNull().default(0),
  governedBy: varchar('governed_by', { length: 48 }).notNull().default('org.anvaya.one'),
  status: varchar('status', { length: 24 }).notNull().default('active'),
  updatedBy: varchar('updated_by', { length: 64 }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const dedapiKeys = pgTable('dedapi_keys', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: text('name').notNull(),
  prefix: varchar('prefix', { length: 64 }).notNull().unique(),
  hashedSecret: text('hashed_secret').notNull(),
  scopes: text('scopes').array().notNull(),
  region: varchar('region', { length: 4 }), // null = all regions
  status: varchar('status', { length: 16 }).notNull().default('active'), // active | revoked
  createdBy: varchar('created_by', { length: 64 }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  lastUsedAt: bigint('last_used_at', { mode: 'number' }),
});

export const auditLog = pgTable('audit_log', {
  id: varchar('id', { length: 64 }).primaryKey(),
  entity: varchar('entity', { length: 80 }).notNull(),
  operation: varchar('operation', { length: 16 }).notNull(),
  rowId: varchar('row_id', { length: 96 }).notNull(),
  beforeHash: text('before_hash'),
  afterHash: text('after_hash'),
  prevEntryHash: text('prev_entry_hash'),
  entryHash: text('entry_hash').notNull(),
  changedBy: varchar('changed_by', { length: 64 }).notNull(),
  changedAt: bigint('changed_at', { mode: 'number' }).notNull(),
});
