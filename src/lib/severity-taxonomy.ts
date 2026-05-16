/**
 * R-API-12 closure (Wave 5B): canonical severity taxonomy.
 *
 * Three parallel severity taxonomies live in-tree:
 *   1. reports (UPPERCASE 4-level): LOW | MEDIUM | HIGH | CRITICAL
 *      — src/app/api/reports/route.ts ALLOWED_SEVERITIES
 *   2. attack-events (lowercase 3-level): critical | high | low
 *      — src/lib/soc-types.ts AttackSeverity
 *   3. dashboard (UPPERCASE 4-level): CRITICAL | HIGH | MEDIUM | LOW
 *      — src/components/dashboard/TelemetryStreamPanel.tsx Severity
 *
 * Without a single normalizer, cross-surface analytics (e.g.
 * "show all 'high' items across reports + attacks") requires per-
 * caller mapping. This helper flattens the three taxonomies into a
 * single 5-level canonical form for shared logic — call sites keep
 * their display-time taxonomies but funnel through the canonical
 * form for analytics, sorting, and logging.
 *
 * SENIOR ARCHITECT NOTE: 5-level canonical (critical/high/medium/
 * low/info) is a superset that loses no information when mapping
 * back to any of the 3 in-tree taxonomies. The 'info' bucket
 * accommodates telemetry-noise events (heartbeats, low-priority
 * scans) that should not be coerced into 'low' — keeping the
 * floor distinct improves filterability downstream. Lowercase
 * canonical matches the existing attack-events taxonomy + CVSS
 * qualitative ratings convention (interoperable with NVD CVE
 * data feeding /api/cves).
 *
 * REJECTED ALTERNATIVE: 4-level canonical mirroring the reports
 * taxonomy. Rejected — drops the 'info' bucket needed for
 * telemetry low-priority events; would force per-caller mapping
 * for callers that need that level (live-attacks, dashboard).
 *
 * REJECTED ALTERNATIVE: extend existing `normalizeSeverity()` in
 * soc-attack-utils.ts. Rejected — that helper returns AttackSeverity
 * (3-level) and is consumed by supabase-attack-metrics.ts; widening
 * its return type would silently change downstream behavior. New
 * module keeps existing call sites untouched.
 */

export type CanonicalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/** Frozen list of canonical severities in priority order (highest first).
 * Useful for sort/iteration callers; freezing prevents accidental mutation. */
export const CANONICAL_SEVERITIES: readonly CanonicalSeverity[] = Object.freeze([
  'critical',
  'high',
  'medium',
  'low',
  'info',
] as const)

/**
 * Strict canonical-severity parser. Returns null for input that
 * cannot be confidently mapped to a canonical level. Use this when
 * the caller needs to distinguish "unknown" from a legitimate
 * 'info' input (e.g. POST-body validation).
 *
 * Accepted inputs (case-insensitive after .trim()):
 *   - 'critical', 'crit' → 'critical'
 *   - 'high'             → 'high'
 *   - 'medium', 'med'    → 'medium'
 *   - 'low'              → 'low'
 *   - 'info', 'informational' → 'info'
 */
export function parseCanonicalSeverity(input: unknown): CanonicalSeverity | null {
  if (typeof input !== 'string') return null
  const lower = input.trim().toLowerCase()
  if (!lower) return null
  if (lower === 'critical' || lower === 'crit') return 'critical'
  if (lower === 'high') return 'high'
  if (lower === 'medium' || lower === 'med') return 'medium'
  if (lower === 'low') return 'low'
  if (lower === 'info' || lower === 'informational') return 'info'
  return null
}

/**
 * Lenient canonical-severity normalizer. Returns 'info' as the
 * floor fallback for unknown/empty input — never throws. Use this
 * when the caller needs a guaranteed canonical value (e.g.
 * analytics aggregation, log emission).
 */
export function normalizeToCanonicalSeverity(input: unknown): CanonicalSeverity {
  return parseCanonicalSeverity(input) ?? 'info'
}

/**
 * Numeric weight for canonical severity. Used for sorting (highest
 * first) and pressure/risk scoring across surfaces. Critical=5 …
 * info=1 mirrors the 5-level structure 1-to-1.
 */
export function canonicalSeverityWeight(severity: CanonicalSeverity): number {
  switch (severity) {
    case 'critical':
      return 5
    case 'high':
      return 4
    case 'medium':
      return 3
    case 'low':
      return 2
    case 'info':
      return 1
  }
}

/**
 * Maps canonical severity back to the reports UPPERCASE 4-level
 * taxonomy. The 'info' canonical bucket collapses to 'LOW' (reports
 * has no 'INFO' bucket — least-severe legitimate value matches the
 * semantic intent of telemetry noise).
 */
export function canonicalToReportSeverity(
  severity: CanonicalSeverity,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (severity) {
    case 'critical':
      return 'CRITICAL'
    case 'high':
      return 'HIGH'
    case 'medium':
      return 'MEDIUM'
    case 'low':
      return 'LOW'
    case 'info':
      return 'LOW'
  }
}
