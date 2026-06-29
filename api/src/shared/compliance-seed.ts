// Canonical country COMPLIANCE catalogue — governed notices about the regional law, data-protection
// regime and the family's rights that apply to their information in each country. Governed by
// org.anvaya.one and served over dedapi alongside guidance; the family app surfaces them so people
// understand the legal basis + their rights. Public legal reference data, not business data.
//
// Shared by org.anvaya.one (seeds + serves) and me.anvaya (governed fallback before dedapi is wired).

import type { RegionCode, ComplianceSeverity, ComplianceNote } from './types';

export interface ComplianceSeedDef {
  country: RegionCode;
  entityType: string;
  title: string;
  body: string;
  severity: ComplianceSeverity;
  url?: string;
}

const c = (country: RegionCode, entityType: string, title: string, body: string, severity: ComplianceSeverity, url?: string): ComplianceSeedDef =>
  ({ country, entityType, title, body, severity, ...(url ? { url } : {}) });

export const COMPLIANCE_SEED: ComplianceSeedDef[] = [
  c('UK', '*', 'UK GDPR & Data Protection Act 2018', 'Your information is held under UK GDPR. You have the right to access, correct, erase and port your data, and to complain to the ICO.', 'legal', 'https://ico.org.uk/your-data-matters/'),
  c('IN', '*', 'Digital Personal Data Protection Act, 2023', 'Your personal data is processed on the basis of consent under the DPDP Act 2023. You may access, correct and erase your data and withdraw consent.', 'legal', 'https://www.meity.gov.in/data-protection-framework'),
  c('US', '*', 'US state privacy laws', 'Privacy rights vary by state (e.g. CCPA/CPRA in California). Where applicable you can access, delete and opt out of the sale/sharing of your data.', 'legal', 'https://www.usa.gov/privacy'),
  // A type-specific example: passports carry sensitive identifiers — minimise sharing.
  c('UK', 'passport', 'Sensitive identity document', 'Passport details are sensitive. Share only what is necessary and verify who is asking before disclosing the number.', 'rights'),
  c('IN', 'aadhaar', 'Aadhaar — handle with care', 'Aadhaar is sensitive. Use a masked/virtual ID where possible and never share your number or OTP with untrusted parties.', 'rights', 'https://uidai.gov.in/'),
];

export const complianceSeedId = (s: { country: RegionCode; entityType: string; severity: ComplianceSeverity }): string =>
  `cn_${s.country}_${s.entityType}_${s.severity}`.toLowerCase().replace(/\*/g, 'all');

/** Governed compliance notices for a country (optionally a type), incl. country-wide ('*') notices. */
export function complianceSeedFor(country: RegionCode, entityType?: string, governedBy = 'org.anvaya.one'): ComplianceNote[] {
  return COMPLIANCE_SEED
    .filter((s) => s.country === country && (s.entityType === '*' || !entityType || s.entityType === entityType))
    .map((s, i) => ({ id: complianceSeedId(s), country: s.country, entityType: s.entityType, title: s.title, body: s.body, severity: s.severity, ...(s.url ? { url: s.url } : {}), governedBy, sequence: i }));
}
