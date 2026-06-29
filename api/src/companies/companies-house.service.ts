// Companies House (UK registry) integration — verify a UK organisation by name or company number,
// for org onboarding. The operator's CH REST API key is stored encrypted via ConfigStore (entered in
// the admin console, never in code). Falls back to "not configured" until the key is set.

import { Injectable } from '@nestjs/common';
import { ConfigStore } from '../settings/config-store';

export const CH_KEY = 'companies_house.api_key';
const CH_BASE = 'https://api.company-information.service.gov.uk';

export interface CompanyHit { number: string; name: string; status?: string; type?: string; address?: string }
export interface CompanyDetail extends CompanyHit { incorporatedOn?: string; sicCodes?: string[] }

interface ChSearchItem { company_number?: string; title?: string; company_status?: string; company_type?: string; address_snippet?: string }
interface ChCompany {
  company_number?: string; company_name?: string; company_status?: string; type?: string;
  date_of_creation?: string; sic_codes?: string[];
  registered_office_address?: Record<string, string>;
}

@Injectable()
export class CompaniesHouseService {
  constructor(private readonly config: ConfigStore) {}

  configured(): Promise<boolean> { return this.config.isSet(CH_KEY); }
  async setKey(key: string, by: string): Promise<void> { await this.config.set(CH_KEY, key.trim(), by); }

  private async authHeader(): Promise<string | null> {
    const key = await this.config.get(CH_KEY);
    if (!key) return null;
    return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
  }

  private addr(a?: Record<string, string>): string | undefined {
    if (!a) return undefined;
    return [a.premises, a.address_line_1, a.locality, a.postal_code, a.country].filter(Boolean).join(', ') || undefined;
  }

  /** Search UK companies by name/number. */
  async search(q: string, limit = 10): Promise<{ configured: boolean; items: CompanyHit[] }> {
    const auth = await this.authHeader();
    if (!auth) return { configured: false, items: [] };
    try {
      const res = await fetch(`${CH_BASE}/search/companies?q=${encodeURIComponent(q)}&items_per_page=${limit}`, { headers: { Authorization: auth } });
      if (!res.ok) return { configured: true, items: [] };
      const j = (await res.json()) as { items?: ChSearchItem[] };
      const items = (j.items ?? []).filter((i) => i.company_number).map((i) => ({
        number: i.company_number!, name: i.title ?? i.company_number!,
        ...(i.company_status ? { status: i.company_status } : {}),
        ...(i.company_type ? { type: i.company_type } : {}),
        ...(i.address_snippet ? { address: i.address_snippet } : {}),
      }));
      return { configured: true, items };
    } catch { return { configured: true, items: [] }; }
  }

  /** Fetch a single UK company's profile by number (the verification record). */
  async get(number: string): Promise<{ configured: boolean; company: CompanyDetail | null }> {
    const auth = await this.authHeader();
    if (!auth) return { configured: false, company: null };
    try {
      const res = await fetch(`${CH_BASE}/company/${encodeURIComponent(number)}`, { headers: { Authorization: auth } });
      if (!res.ok) return { configured: true, company: null };
      const c = (await res.json()) as ChCompany;
      const company: CompanyDetail = {
        number: c.company_number ?? number, name: c.company_name ?? '',
        ...(c.company_status ? { status: c.company_status } : {}),
        ...(c.type ? { type: c.type } : {}),
        ...(c.date_of_creation ? { incorporatedOn: c.date_of_creation } : {}),
        ...(c.sic_codes ? { sicCodes: c.sic_codes } : {}),
        ...(this.addr(c.registered_office_address) ? { address: this.addr(c.registered_office_address)! } : {}),
      };
      return { configured: true, company };
    } catch { return { configured: true, company: null }; }
  }
}
