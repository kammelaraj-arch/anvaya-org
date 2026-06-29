// Pure governance-rule evaluation — used by the dedapi /validate-profile endpoint. Kept free of NestJS
// and the DB so it is fully unit-testable. Given the governed rules for a country+type and a draft
// payload, it returns the issues that block (or warn on) a profile/record save.

export interface GovernanceRule {
  id: string;
  ruleKind: string; // required_field | min_age | id_format | note
  config: Record<string, unknown>;
  description?: string | null;
}
export interface ValidateIssue { ruleId: string; ruleKind: string; field?: string; message: string }

/** Age in whole years between a date-of-birth and `now`. */
export function ageInYears(dob: Date, now: number): number {
  return Math.floor((now - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

/** Evaluate the governed rules against a draft payload. `now` is injected for deterministic tests. */
export function evaluateGovernanceRules(rules: GovernanceRule[], payload: Record<string, unknown>, now: number = Date.now()): ValidateIssue[] {
  const issues: ValidateIssue[] = [];
  for (const r of rules) {
    const cfg = r.config ?? {};
    if (r.ruleKind === 'required_field') {
      const field = String(cfg.field ?? '');
      const val = field ? payload[field] : undefined;
      if (field && (val === undefined || val === null || String(val).trim() === '')) {
        issues.push({ ruleId: r.id, ruleKind: r.ruleKind, field, message: String(cfg.message ?? `${field} is required`) });
      }
    } else if (r.ruleKind === 'min_age') {
      const minAge = Number(cfg.minAge ?? 0);
      const dobField = String(cfg.field ?? 'dob');
      const raw = payload[dobField];
      const dob = raw ? new Date(String(raw)) : null;
      if (minAge > 0 && dob && !Number.isNaN(dob.getTime()) && ageInYears(dob, now) < minAge) {
        issues.push({ ruleId: r.id, ruleKind: r.ruleKind, field: dobField, message: String(cfg.message ?? `Must be at least ${minAge}`) });
      }
    } else if (r.ruleKind === 'id_format') {
      const field = String(cfg.field ?? '');
      const pattern = String(cfg.pattern ?? '');
      const val = field ? String(payload[field] ?? '') : '';
      if (field && pattern && val) {
        try {
          if (!new RegExp(pattern).test(val)) {
            issues.push({ ruleId: r.id, ruleKind: r.ruleKind, field, message: String(cfg.message ?? `${field} has an invalid format`) });
          }
        } catch { /* a bad admin-entered regex never fails the request */ }
      }
    }
  }
  return issues;
}
