// Canonical country-specific GUIDANCE catalogue — the governed action cards + helpful official links
// attached to each Information-Library type per country (e.g. Passport → Apply / Renew / Lost or
// Stolen / Contact / Embassy abroad / Emergency), plus broader guidance (government, health & safety,
// identity & verification, age-based guardrails, local support).
//
// Single source of truth shared by two consumers so they never drift:
//   • org.anvaya.one (apps/org-api) — the GOVERNANCE platform — seeds its catalogue from this and
//     serves it (admins then add/update/remove, audited) over the dedapi channel.
//   • me.anvaya (apps/api) — the family app — uses it as the governed fallback when the live dedapi
//     endpoint isn't configured yet, served through the federation API (never hardcoded in the client).
//
// This is PUBLIC government/official reference data (links + format guidance), not business data.

import { GUIDANCE_KIND_ORDER, type RegionCode, type GuidanceKind, type GuidanceItem } from './types';

/** A seed definition (id + audit are derived when seeding). */
export interface GuidanceSeedDef {
  country: RegionCode;
  entityType: string;
  kind: GuidanceKind;
  label: string;
  url: string;
  summary?: string;
}

const g = (country: RegionCode, entityType: string, kind: GuidanceKind, label: string, url: string, summary?: string): GuidanceSeedDef =>
  ({ country, entityType, kind, label, url, ...(summary ? { summary } : {}) });

// --- Passport ---------------------------------------------------------------------------------
const PASSPORT: GuidanceSeedDef[] = [
  // United Kingdom (GOV.UK / FCDO)
  g('UK', 'passport', 'apply', 'Apply for a passport', 'https://www.gov.uk/apply-renew-passport', 'Apply for your first UK adult or child passport on GOV.UK.'),
  g('UK', 'passport', 'renew', 'Renew your passport', 'https://www.gov.uk/renew-adult-passport', 'Renew an adult UK passport online.'),
  g('UK', 'passport', 'lost', 'Report lost or stolen', 'https://www.gov.uk/report-a-lost-or-stolen-passport', 'Cancel a lost or stolen UK passport so it can’t be misused.'),
  g('UK', 'passport', 'contact', 'Passport Adviceline', 'https://www.gov.uk/passport-advice-line', 'HM Passport Office contact details.'),
  g('UK', 'passport', 'embassy', 'UK embassies abroad', 'https://www.gov.uk/world/embassies', 'Find the nearest British embassy, consulate or high commission.'),
  g('UK', 'passport', 'emergency', 'Emergency travel document', 'https://www.gov.uk/emergency-travel-document', 'Apply for an emergency travel document when abroad without a passport.'),
  // India (Passport Seva / MEA)
  g('IN', 'passport', 'apply', 'Apply for a passport', 'https://www.passportindia.gov.in/', 'Apply for a fresh Indian passport via Passport Seva.'),
  g('IN', 'passport', 'renew', 'Re-issue / renew', 'https://www.passportindia.gov.in/AppOnlineProject/welcomeLink', 'Re-issue an Indian passport (renewal / change of particulars).'),
  g('IN', 'passport', 'lost', 'Lost or damaged', 'https://www.passportindia.gov.in/AppOnlineProject/online/procLostDmg', 'Re-issue a lost or damaged Indian passport.'),
  g('IN', 'passport', 'contact', 'Passport Seva helpline', 'https://www.passportindia.gov.in/AppOnlineProject/online/contactUs', 'National Call Centre 1800-258-1800.'),
  g('IN', 'passport', 'embassy', 'Indian missions abroad', 'https://www.mea.gov.in/indian-missions-abroad-new.htm', 'Find Indian embassies and consulates worldwide.'),
  g('IN', 'passport', 'emergency', 'Emergency certificate', 'https://www.mea.gov.in/passport-and-visa-services.htm', 'Emergency certificate / consular help when abroad.'),
  // United States (State Dept)
  g('US', 'passport', 'apply', 'Apply for a passport', 'https://travel.state.gov/content/travel/en/passports/how-apply.html', 'Apply for a new US passport.'),
  g('US', 'passport', 'renew', 'Renew your passport', 'https://travel.state.gov/content/travel/en/passports/have-passport/renew.html', 'Renew a US passport by mail or online.'),
  g('US', 'passport', 'lost', 'Lost or stolen', 'https://travel.state.gov/content/travel/en/passports/have-passport/lost-stolen.html', 'Report and replace a lost or stolen US passport.'),
  g('US', 'passport', 'contact', 'Passport contact', 'https://travel.state.gov/content/travel/en/contact.html', 'National Passport Information Center.'),
  g('US', 'passport', 'embassy', 'US embassies abroad', 'https://www.usembassy.gov/', 'Find the nearest US embassy or consulate.'),
  g('US', 'passport', 'emergency', 'Emergencies abroad', 'https://travel.state.gov/content/travel/en/international-travel/emergencies.html', 'Help for US citizens in an emergency overseas.'),
];

// --- Driving licence --------------------------------------------------------------------------
const DRIVING: GuidanceSeedDef[] = [
  g('UK', 'driving_licence', 'apply', 'Apply (provisional)', 'https://www.gov.uk/apply-first-provisional-driving-licence', 'Apply for your first UK provisional driving licence (DVLA).'),
  g('UK', 'driving_licence', 'renew', 'Renew your licence', 'https://www.gov.uk/renew-driving-licence', 'Renew a UK photocard driving licence.'),
  g('UK', 'driving_licence', 'lost', 'Replace lost licence', 'https://www.gov.uk/apply-online-to-replace-a-driving-licence', 'Replace a lost, stolen or damaged UK licence.'),
  g('IN', 'driving_licence', 'apply', 'Apply (Parivahan)', 'https://parivahan.gov.in/parivahan/', 'Apply for a learner / driving licence on Parivahan Sewa.'),
  g('IN', 'driving_licence', 'renew', 'Renew your licence', 'https://parivahan.gov.in/parivahan/en/content/driving-licence-0', 'Renew an Indian driving licence.'),
  g('US', 'driving_licence', 'apply', 'State DMV services', 'https://www.usa.gov/state-motor-vehicle-services', 'Driver licensing is by state — find your state DMV.'),
];

// --- Country-specific national IDs ------------------------------------------------------------
const NATIONAL_IDS: GuidanceSeedDef[] = [
  // UK
  g('UK', 'ni_number', 'apply', 'Apply for an NI number', 'https://www.gov.uk/apply-national-insurance-number', 'Apply for a UK National Insurance number.'),
  g('UK', 'ni_number', 'lost', 'Find a lost NI number', 'https://www.gov.uk/lost-national-insurance-number', 'Recover a forgotten National Insurance number.'),
  g('UK', 'nhs', 'apply', 'Register with a GP', 'https://www.nhs.uk/nhs-services/gps/how-to-register-with-a-gp-surgery/', 'Register with an NHS GP surgery.'),
  g('UK', 'nhs', 'contact', 'Find your NHS number', 'https://www.nhs.uk/nhs-services/online-services/find-nhs-number/', 'Look up your NHS number.'),
  // India
  g('IN', 'aadhaar', 'apply', 'Aadhaar enrolment', 'https://uidai.gov.in/', 'Enrol for or update Aadhaar (UIDAI).'),
  g('IN', 'aadhaar', 'renew', 'Update Aadhaar', 'https://myaadhaar.uidai.gov.in/', 'Update Aadhaar details online (myAadhaar).'),
  g('IN', 'pan', 'apply', 'Apply for PAN', 'https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html', 'Apply for a Permanent Account Number.'),
  g('IN', 'pan', 'contact', 'Income Tax portal', 'https://www.incometax.gov.in/', 'PAN services on the Income Tax e-filing portal.'),
  // US
  g('US', 'ssn', 'apply', 'Apply for an SSN', 'https://www.ssa.gov/number-card/', 'Apply for or replace a Social Security number / card.'),
];

// --- Civil documents (birth / marriage / visa & immigration) ----------------------------------
const CIVIL: GuidanceSeedDef[] = [
  g('UK', 'birth_certificate', 'apply', 'Order a birth certificate', 'https://www.gov.uk/order-copy-birth-death-marriage-certificate', 'Order a UK birth certificate copy (GRO).'),
  g('IN', 'birth_certificate', 'apply', 'Birth certificate', 'https://crsorgi.gov.in/', 'Apply for a birth certificate (Civil Registration System).'),
  g('US', 'birth_certificate', 'apply', 'Order vital records', 'https://www.cdc.gov/nchs/w2w/index.htm', 'Where to write for US birth certificates (by state).'),
  g('UK', 'marriage_certificate', 'apply', 'Order a marriage certificate', 'https://www.gov.uk/order-copy-birth-death-marriage-certificate', 'Order a UK marriage certificate copy (GRO).'),
  g('UK', 'visa_immigration', 'apply', 'UK visas & immigration', 'https://www.gov.uk/browse/visas-immigration', 'Apply, check or manage a UK visa / BRP.'),
  g('IN', 'visa_immigration', 'apply', 'Indian visa services', 'https://indianvisaonline.gov.in/', 'Indian e-Visa and visa services.'),
  g('US', 'visa_immigration', 'apply', 'US visas', 'https://travel.state.gov/content/travel/en/us-visas.html', 'US visa categories and how to apply.'),
];

// --- Finance / banking ------------------------------------------------------------------------
const FINANCE: GuidanceSeedDef[] = [
  g('UK', 'bank_accounts', 'lost', 'Report fraud (Action Fraud)', 'https://www.actionfraud.police.uk/', 'Report bank fraud or a scam in the UK.'),
  g('UK', 'bank_accounts', 'support', 'Trace lost accounts', 'https://www.mylostaccount.org.uk/', 'Find lost UK bank, building society or NS&I accounts.'),
  g('IN', 'bank_accounts', 'support', 'RBI banking complaints', 'https://cms.rbi.org.in/', 'Reserve Bank of India banking ombudsman / complaints.'),
  g('US', 'bank_accounts', 'support', 'Find unclaimed funds', 'https://www.usa.gov/unclaimed-money', 'Search for unclaimed money / lost accounts (US).'),
];

export const GUIDANCE_SEED: GuidanceSeedDef[] = [...PASSPORT, ...DRIVING, ...NATIONAL_IDS, ...CIVIL, ...FINANCE];

/** Stable id for a seed item (country + type + kind) — idempotent across re-seeds. */
export const guidanceSeedId = (s: { country: RegionCode; entityType: string; kind: GuidanceKind }): string =>
  `gd_${s.country}_${s.entityType}_${s.kind}`.toLowerCase();

/** Governed reference items for a country + type, ordered for display. Used as the fallback when the
 *  live dedapi endpoint isn't configured. `governedBy` defaults to org.anvaya.one. */
export function guidanceSeedFor(country: RegionCode, entityType: string, governedBy = 'org.anvaya.one'): GuidanceItem[] {
  return GUIDANCE_SEED
    .filter((s) => s.country === country && s.entityType === entityType)
    .map((s) => ({ id: guidanceSeedId(s), country: s.country, entityType: s.entityType, kind: s.kind, label: s.label, ...(s.url ? { url: s.url } : {}), ...(s.summary ? { summary: s.summary } : {}), governedBy, sequence: GUIDANCE_KIND_ORDER.indexOf(s.kind) }))
    .sort((a, b) => a.sequence - b.sequence);
}
