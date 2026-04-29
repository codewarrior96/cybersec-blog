import type { EvidenceLog, EvidenceEvent, EvidencePrimitive } from '../evidence'
import { RingEvidenceLog, matchPrimitive, pathMatches } from '../evidence'
import type { RequiresBeforeReadingClause, ValidationContract, ValidationResult } from './types'

function groupSatisfied(group: readonly Parameters<EvidenceLog['has']>[0][], log: EvidenceLog): boolean {
  return group.every(primitive => log.has(primitive))
}

function latestFlagSubmitEventId(log: EvidenceLog): number {
  const submits = log.events.filter(event =>
    event.primitives.some(primitive => primitive.type === 'flag_submitted'),
  )

  return submits.at(-1)?.id ?? Number.POSITIVE_INFINITY
}

function temporalClauseSatisfiedBefore(
  clause: RequiresBeforeReadingClause,
  log: EvidenceLog,
  readEventId: number,
): boolean {
  const hasBeforeOrAt = (primitive: Parameters<EvidenceLog['has']>[0]) =>
    log.hasBefore(primitive, readEventId)
    || log.events
      .filter(event => event.id === readEventId)
      .some(event => event.primitives.some(actual => matchPrimitive(primitive, actual)))

  const allOk = (clause.all ?? []).every(primitive => hasBeforeOrAt(primitive))
  const anyOf = clause.anyOf ?? []
  const anyOfOk = anyOf.length === 0 || anyOf.some(group =>
    group.every(primitive => hasBeforeOrAt(primitive)),
  )

  return allOk && anyOfOk
}

function temporalFailureExists(clause: RequiresBeforeReadingClause, log: EvidenceLog): boolean {
  const submitEventId = latestFlagSubmitEventId(log)

  const validReadBeforeSubmit = log.events
    .filter(event => event.id < submitEventId)
    .filter(event =>
      event.primitives.some(primitive =>
        primitive.type === 'file_read'
        && pathMatches(clause.target.path, primitive.path, clause.target.pathMatch),
      ),
    )
    .some(event => temporalClauseSatisfiedBefore(clause, log, event.id))

  return !validReadBeforeSubmit
}

/**
 * Build a log view that only exposes events with `id >= sinceEventId`. All
 * downstream helpers (groupSatisfied, hasBefore, temporal clauses) operate
 * on the filtered view so prior-session or cross-context evidence cannot
 * satisfy a contract evaluated under a per-challenge start gate.
 *
 * No filter / no clamp = identity (returns the original log).
 */
function filterLogSince(log: EvidenceLog, sinceEventId: number | undefined): EvidenceLog {
  if (sinceEventId === undefined) return log
  // Sentinel -1 means "legacy completion preserved, do not re-evaluate" — caller
  // should short-circuit before this point. Defensive: treat as empty log.
  if (sinceEventId < 0) return new RingEvidenceLog([])
  const filteredEvents: EvidenceEvent[] = log.events.filter(event => event.id >= sinceEventId)
  return new RingEvidenceLog(filteredEvents)
}

export function validateContract(
  contract: ValidationContract,
  log: EvidenceLog,
  sinceEventId?: number,
): ValidationResult {
  const scoped = filterLogSince(log, sinceEventId)
  const missing = contract.required.filter((primitive: EvidencePrimitive) => !scoped.has(primitive))
  const forbidden = (contract.forbidden ?? []).filter((primitive: EvidencePrimitive) => scoped.has(primitive))
  const sufficientOk = !contract.sufficient?.length
    || contract.sufficient.some(group => groupSatisfied(group, scoped))
  const temporalFailures = (contract.requiresBeforeReading ?? [])
    .filter(clause => temporalFailureExists(clause, scoped))

  return {
    passed: missing.length === 0 && forbidden.length === 0 && sufficientOk && temporalFailures.length === 0,
    missing,
    forbidden,
    temporalFailures,
    sufficientMet: sufficientOk,
  }
}
