import { describe, it, expect } from 'vitest';
import { evaluateGovernanceRules, ageInYears, type GovernanceRule } from './validate';

const NOW = Date.UTC(2026, 0, 1); // 2026-01-01, fixed for deterministic age maths

describe('evaluateGovernanceRules', () => {
  it('flags a missing required field, passes when present', () => {
    const rules: GovernanceRule[] = [{ id: 'r1', ruleKind: 'required_field', config: { field: 'number', message: 'Passport number is required' } }];
    expect(evaluateGovernanceRules(rules, {}, NOW)).toEqual([
      { ruleId: 'r1', ruleKind: 'required_field', field: 'number', message: 'Passport number is required' },
    ]);
    expect(evaluateGovernanceRules(rules, { number: '123456789' }, NOW)).toEqual([]);
    expect(evaluateGovernanceRules(rules, { number: '   ' }, NOW)).toHaveLength(1); // whitespace is empty
  });

  it('enforces a minimum age from date of birth', () => {
    const rules: GovernanceRule[] = [{ id: 'r2', ruleKind: 'min_age', config: { field: 'dob', minAge: 18 } }];
    expect(evaluateGovernanceRules(rules, { dob: '2015-06-01' }, NOW)).toHaveLength(1); // ~10y
    expect(evaluateGovernanceRules(rules, { dob: '1990-06-01' }, NOW)).toEqual([]);      // adult
    expect(evaluateGovernanceRules(rules, {}, NOW)).toEqual([]);                          // no dob → not evaluated
  });

  it('validates an ID format regex and tolerates a bad pattern', () => {
    const rules: GovernanceRule[] = [{ id: 'r3', ruleKind: 'id_format', config: { field: 'pan', pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$', message: 'Invalid PAN' } }];
    expect(evaluateGovernanceRules(rules, { pan: 'ABCDE1234F' }, NOW)).toEqual([]);
    expect(evaluateGovernanceRules(rules, { pan: 'nope' }, NOW)).toHaveLength(1);
    const bad: GovernanceRule[] = [{ id: 'r4', ruleKind: 'id_format', config: { field: 'x', pattern: '([' } }];
    expect(evaluateGovernanceRules(bad, { x: 'anything' }, NOW)).toEqual([]); // bad regex never throws/blocks
  });

  it('combines multiple rules and ignores unknown kinds', () => {
    const rules: GovernanceRule[] = [
      { id: 'a', ruleKind: 'required_field', config: { field: 'number' } },
      { id: 'b', ruleKind: 'min_age', config: { minAge: 16 } },
      { id: 'c', ruleKind: 'note', config: { text: 'fyi' } },
    ];
    const issues = evaluateGovernanceRules(rules, { dob: '2020-01-01' }, NOW);
    expect(issues.map((i) => i.ruleId).sort()).toEqual(['a', 'b']);
  });

  it('ageInYears computes whole years', () => {
    expect(ageInYears(new Date('2000-01-01'), NOW)).toBe(26);
  });
});
