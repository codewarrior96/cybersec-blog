// R-API-12 closure (Wave 5B): canonical severity-taxonomy unit tests.
//
// Validates the 5-level canonical normalizer against all 3 in-tree
// taxonomies (reports UPPERCASE 4-level, attack-events lowercase
// 3-level, dashboard UPPERCASE 4-level) plus edge cases.
//
// SENIOR ARCHITECT NOTE: pure unit tests — no mocks required.
// severity-taxonomy.ts has no I/O, no env reads, no time dependence.
// Tests assert the canonical mapping, weight ordering, and
// back-mapping invariants.
//
// REJECTED ALTERNATIVE: parametrize via it.each. Rejected — explicit
// named cases produce more diagnostic test-failure output and let
// the suite serve as documentation of accepted inputs.

import {
  CANONICAL_SEVERITIES,
  canonicalSeverityWeight,
  canonicalToReportSeverity,
  normalizeToCanonicalSeverity,
  parseCanonicalSeverity,
  type CanonicalSeverity,
} from './severity-taxonomy'

describe('severity-taxonomy (R-API-12 closure)', () => {
  // ─── T-ST01: strict parse — happy-path canonical inputs ────────────────────

  it('T-ST01 — parseCanonicalSeverity accepts the canonical 5 levels (case-insensitive)', () => {
    expect(parseCanonicalSeverity('critical')).toBe('critical')
    expect(parseCanonicalSeverity('CRITICAL')).toBe('critical')
    expect(parseCanonicalSeverity('  Critical  ')).toBe('critical')
    expect(parseCanonicalSeverity('high')).toBe('high')
    expect(parseCanonicalSeverity('HIGH')).toBe('high')
    expect(parseCanonicalSeverity('medium')).toBe('medium')
    expect(parseCanonicalSeverity('MEDIUM')).toBe('medium')
    expect(parseCanonicalSeverity('low')).toBe('low')
    expect(parseCanonicalSeverity('LOW')).toBe('low')
    expect(parseCanonicalSeverity('info')).toBe('info')
    expect(parseCanonicalSeverity('INFO')).toBe('info')
  })

  // ─── T-ST02: strict parse — alias inputs ───────────────────────────────────

  it('T-ST02 — parseCanonicalSeverity maps common aliases (crit, med, informational)', () => {
    expect(parseCanonicalSeverity('crit')).toBe('critical')
    expect(parseCanonicalSeverity('CRIT')).toBe('critical')
    expect(parseCanonicalSeverity('med')).toBe('medium')
    expect(parseCanonicalSeverity('MED')).toBe('medium')
    expect(parseCanonicalSeverity('informational')).toBe('info')
    expect(parseCanonicalSeverity('Informational')).toBe('info')
  })

  // ─── T-ST03: strict parse — null/undefined/empty/unknown → null ────────────

  it('T-ST03 — parseCanonicalSeverity returns null for null/undefined/empty/unknown input', () => {
    expect(parseCanonicalSeverity(null)).toBeNull()
    expect(parseCanonicalSeverity(undefined)).toBeNull()
    expect(parseCanonicalSeverity('')).toBeNull()
    expect(parseCanonicalSeverity('   ')).toBeNull()
    expect(parseCanonicalSeverity('FOOBAR')).toBeNull()
    expect(parseCanonicalSeverity('P1')).toBeNull() // alert priority, not severity
    expect(parseCanonicalSeverity(42)).toBeNull() // non-string
    expect(parseCanonicalSeverity({})).toBeNull() // non-string
  })

  // ─── T-ST04: lenient normalize — fallback to 'info' ────────────────────────

  it('T-ST04 — normalizeToCanonicalSeverity falls back to "info" for unknown input', () => {
    // Same inputs as T-ST03 but the lenient variant returns 'info', not null
    expect(normalizeToCanonicalSeverity(null)).toBe('info')
    expect(normalizeToCanonicalSeverity(undefined)).toBe('info')
    expect(normalizeToCanonicalSeverity('')).toBe('info')
    expect(normalizeToCanonicalSeverity('   ')).toBe('info')
    expect(normalizeToCanonicalSeverity('FOOBAR')).toBe('info')
    expect(normalizeToCanonicalSeverity('P1')).toBe('info')
    expect(normalizeToCanonicalSeverity(42)).toBe('info')
    // Valid inputs still map correctly
    expect(normalizeToCanonicalSeverity('critical')).toBe('critical')
    expect(normalizeToCanonicalSeverity('HIGH')).toBe('high')
  })

  // ─── T-ST05: weight ordering ──────────────────────────────────────────────

  it('T-ST05 — canonicalSeverityWeight returns 5,4,3,2,1 in priority order', () => {
    expect(canonicalSeverityWeight('critical')).toBe(5)
    expect(canonicalSeverityWeight('high')).toBe(4)
    expect(canonicalSeverityWeight('medium')).toBe(3)
    expect(canonicalSeverityWeight('low')).toBe(2)
    expect(canonicalSeverityWeight('info')).toBe(1)

    // Sorting invariant: descending weight matches the priority-order array
    const sevs: CanonicalSeverity[] = ['low', 'critical', 'info', 'high', 'medium']
    const sorted = [...sevs].sort((a, b) => canonicalSeverityWeight(b) - canonicalSeverityWeight(a))
    expect(sorted).toEqual(['critical', 'high', 'medium', 'low', 'info'])
  })

  // ─── T-ST06: CANONICAL_SEVERITIES ordering + immutability ──────────────────

  it('T-ST06 — CANONICAL_SEVERITIES is frozen, in priority order, and contains all 5 levels', () => {
    expect(CANONICAL_SEVERITIES).toEqual(['critical', 'high', 'medium', 'low', 'info'])
    expect(Object.isFrozen(CANONICAL_SEVERITIES)).toBe(true)
    // Sanity: the array length matches the canonical taxonomy size
    expect(CANONICAL_SEVERITIES).toHaveLength(5)
  })

  // ─── T-ST07: reports back-mapping ─────────────────────────────────────────

  it('T-ST07 — canonicalToReportSeverity maps all 5 canonical levels to reports 4-level enum', () => {
    expect(canonicalToReportSeverity('critical')).toBe('CRITICAL')
    expect(canonicalToReportSeverity('high')).toBe('HIGH')
    expect(canonicalToReportSeverity('medium')).toBe('MEDIUM')
    expect(canonicalToReportSeverity('low')).toBe('LOW')
    // 'info' collapses to 'LOW' (reports has no 'INFO' bucket)
    expect(canonicalToReportSeverity('info')).toBe('LOW')
  })

  // ─── T-ST08: round-trip from each in-tree taxonomy → canonical ────────────

  it('T-ST08 — all 3 in-tree taxonomies round-trip through normalizeToCanonicalSeverity', () => {
    // Reports taxonomy: UPPERCASE 4-level
    expect(normalizeToCanonicalSeverity('CRITICAL')).toBe('critical')
    expect(normalizeToCanonicalSeverity('HIGH')).toBe('high')
    expect(normalizeToCanonicalSeverity('MEDIUM')).toBe('medium')
    expect(normalizeToCanonicalSeverity('LOW')).toBe('low')

    // attack-events / AttackSeverity: lowercase 3-level
    expect(normalizeToCanonicalSeverity('critical')).toBe('critical')
    expect(normalizeToCanonicalSeverity('high')).toBe('high')
    expect(normalizeToCanonicalSeverity('low')).toBe('low')

    // dashboard Severity: UPPERCASE 4-level (same as reports)
    expect(normalizeToCanonicalSeverity('CRITICAL')).toBe('critical')
    expect(normalizeToCanonicalSeverity('HIGH')).toBe('high')
    expect(normalizeToCanonicalSeverity('MEDIUM')).toBe('medium')
    expect(normalizeToCanonicalSeverity('LOW')).toBe('low')
  })
})
