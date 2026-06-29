// Local types for the org.anvaya.one console (standalone — no shared workspace package).
export type RegionCode = 'IN' | 'UK' | 'US';

export interface GuidanceItem {
  id: string;
  country: RegionCode;
  entityType: string;
  kind: string;
  label: string;
  url?: string;
  summary?: string;
  governedBy: string;
  sequence: number;
}
