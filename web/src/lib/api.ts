// Typed client for the org.anvaya.one governance API (org-api). Cookie session (credentials:'include').

import type { GuidanceItem, RegionCode } from './types';

const BASE = process.env['NEXT_PUBLIC_ORG_API_URL'] ?? '';

export function apiEnabled(): boolean { return Boolean(BASE); }

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try { const j = await res.json(); message = (j.message as string) ?? message; } catch { /* ignore */ }
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status);
  }
  return (await res.json()) as T;
}

export type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer';
export interface OrgUserView { id: string; email: string; displayName: string | null; role: OrgRole; status: string; lastLogin: number | null }
export interface GuidanceRow { id: string; country: string; entityType: string; kind: string; label: string; url: string | null; summary: string | null; sequence: number; status: string; updatedAt: number }
export interface RuleRow { id: string; country: string; entityType: string; ruleKind: string; config: Record<string, unknown>; description: string | null; status: string; updatedAt: number }
export interface DedapiKeyView { id: string; name: string; prefix: string; scopes: string[]; region: string | null; status: string; createdAt: number; lastUsedAt: number | null }
export interface ComplianceRow { id: string; country: string; entityType: string; title: string; body: string; severity: string; url: string | null; status: string; updatedAt: number }
export interface GovMeta { countries: RegionCode[]; kinds: string[]; ruleKinds: string[]; severities: string[] }

export const api = {
  auth: {
    status: () => call<{ initialised: boolean }>('/auth/status'),
    bootstrap: (email: string, password: string, displayName?: string) =>
      call<{ userId: string; role: OrgRole; email: string }>('/auth/bootstrap', { method: 'POST', body: JSON.stringify({ email, password, displayName }) }),
    login: (email: string, password: string) =>
      call<{ userId: string; role: OrgRole; email: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => call<{ ok: true }>('/auth/logout', { method: 'POST' }),
    me: () => call<OrgUserView>('/auth/me'),
    users: () => call<{ users: OrgUserView[]; roles: OrgRole[] }>('/auth/users'),
    addUser: (b: { email: string; password: string; role: OrgRole; displayName?: string }) =>
      call<OrgUserView>('/auth/users', { method: 'POST', body: JSON.stringify(b) }),
  },
  gov: {
    meta: () => call<GovMeta>('/governance/meta'),
    overview: () => call<{ cells: { country: string; online: boolean; guidance: number; rules: number }[] }>('/governance/overview'),
    guidance: (country?: string, type?: string) => {
      const q = new URLSearchParams(); if (country) q.set('country', country); if (type) q.set('type', type);
      return call<{ items: GuidanceRow[] }>(`/governance/guidance${q.toString() ? `?${q}` : ''}`);
    },
    setGuidance: (b: Partial<GuidanceRow> & { country: string; entityType: string; kind: string; label: string }) =>
      call<{ id: string }>('/governance/guidance', { method: 'POST', body: JSON.stringify(b) }),
    delGuidance: (id: string) => call<{ ok: true }>(`/governance/guidance/${id}`, { method: 'DELETE' }),
    rules: (country?: string, type?: string) => {
      const q = new URLSearchParams(); if (country) q.set('country', country); if (type) q.set('type', type);
      return call<{ rules: RuleRow[] }>(`/governance/rules${q.toString() ? `?${q}` : ''}`);
    },
    setRule: (b: { id?: string; country: string; entityType: string; ruleKind: string; config?: Record<string, unknown>; description?: string }) =>
      call<{ id: string }>('/governance/rules', { method: 'POST', body: JSON.stringify(b) }),
    delRule: (id: string) => call<{ ok: true }>(`/governance/rules/${id}`, { method: 'DELETE' }),
    auditVerify: () => call<{ valid: boolean; count: number; reason?: string }>('/governance/audit/verify'),
    compliance: (country?: string, type?: string) => {
      const q = new URLSearchParams(); if (country) q.set('country', country); if (type) q.set('type', type);
      return call<{ notes: ComplianceRow[] }>(`/governance/compliance${q.toString() ? `?${q}` : ''}`);
    },
    setCompliance: (b: { id?: string; country: string; entityType?: string; title: string; body: string; severity?: string; url?: string }) =>
      call<{ id: string }>('/governance/compliance', { method: 'POST', body: JSON.stringify(b) }),
    delCompliance: (id: string) => call<{ ok: true }>(`/governance/compliance/${id}`, { method: 'DELETE' }),
  },
  keys: {
    list: () => call<{ keys: DedapiKeyView[] }>('/keys'),
    create: (b: { name: string; scopes?: string[]; region?: string }) =>
      call<{ key: DedapiKeyView; plaintext: string }>('/keys', { method: 'POST', body: JSON.stringify(b) }),
    revoke: (id: string) => call<{ ok: true }>(`/keys/${id}`, { method: 'DELETE' }),
  },
  companies: {
    status: () => call<{ configured: boolean }>('/companies/status'),
    setKey: (key: string) => call<{ ok: true }>('/companies/key', { method: 'POST', body: JSON.stringify({ key }) }),
    search: (q: string) => call<{ configured: boolean; items: CompanyHit[] }>(`/companies/search?q=${encodeURIComponent(q)}`),
    get: (number: string) => call<{ configured: boolean; company: CompanyDetail | null }>(`/companies/company/${encodeURIComponent(number)}`),
  },
  settings: {
    list: () => call<{ entries: ConfigEntry[]; runtime: RuntimeConfig }>('/settings'),
    set: (id: string, value: string) => call<{ ok: true }>(`/settings/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ value }) }),
    clear: (id: string) => call<{ ok: true }>(`/settings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  fabric: {
    cells: () => call<{ cells: FabricCell[] }>('/fabric/cells'),
    setCell: (b: { country: string; displayName?: string; enabled?: boolean; notes?: string }) =>
      call<{ country: string }>('/fabric/cells', { method: 'POST', body: JSON.stringify(b) }),
  },
};

export type ConfigCategory = 'integration' | 'platform';
export interface ConfigEntry { id: string; label: string; category: ConfigCategory; secret: boolean; help?: string; placeholder?: string; isSet: boolean; value?: string; updatedBy?: string; updatedAt?: number }
export interface RuntimeConfig { governedBy: string; defaultRegion: string; regions: string[]; commonConfigured: boolean; appOrigins: string[] }
export interface FabricCell { country: string; displayName: string; enabled: boolean; notes: string | null; provisioned: boolean; online: boolean; guidance: number; rules: number; compliance: number; updatedAt: number | null }

export interface CompanyHit { number: string; name: string; status?: string; type?: string; address?: string }
export interface CompanyDetail extends CompanyHit { incorporatedOn?: string; sicCodes?: string[] }

export type { GuidanceItem };
