// Standalone shared types for org.anvaya.one (vendored — formerly @anvaya/contracts). This app is
// independent of the family-app monorepo; these are the few types it needs, kept self-contained.

export const RegionCode = { IN: 'IN', UK: 'UK', US: 'US' } as const;
export type RegionCode = (typeof RegionCode)[keyof typeof RegionCode];

// --- Audit (tamper-evident hash chain) ---
export const AuditOperation = {
  insert: 'INSERT', update: 'UPDATE', delete: 'DELETE', read: 'READ', login: 'LOGIN', execute: 'EXECUTE',
} as const;
export type AuditOperation = (typeof AuditOperation)[keyof typeof AuditOperation];

export interface AuditLogEntry {
  id: string;
  entity: string;
  operation: AuditOperation;
  rowId: string;
  beforeHash?: string;
  afterHash?: string;
  prevEntryHash?: string;
  entryHash: string;
  changedBy: string;
  changedAt: number;
}

// --- Guidance ---
export const GuidanceKind = {
  apply: 'apply', renew: 'renew', lost: 'lost', contact: 'contact',
  embassy: 'embassy', emergency: 'emergency', guidance: 'guidance', support: 'support',
} as const;
export type GuidanceKind = (typeof GuidanceKind)[keyof typeof GuidanceKind];

export const GUIDANCE_KIND_ORDER: GuidanceKind[] = ['apply', 'renew', 'lost', 'contact', 'embassy', 'emergency', 'guidance', 'support'];

export interface GuidanceItem {
  id: string;
  country: RegionCode;
  entityType: string;
  kind: GuidanceKind;
  label: string;
  url?: string;
  summary?: string;
  governedBy: string;
  sequence: number;
}

// --- Compliance ---
export const ComplianceSeverity = { info: 'info', rights: 'rights', legal: 'legal' } as const;
export type ComplianceSeverity = (typeof ComplianceSeverity)[keyof typeof ComplianceSeverity];

export interface ComplianceNote {
  id: string;
  country: RegionCode;
  entityType: string;
  title: string;
  body: string;
  severity: ComplianceSeverity;
  url?: string;
  governedBy: string;
  sequence: number;
}
