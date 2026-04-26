import type { EvidenceLog } from '../evidence'
import { pathMatches } from '../evidence'
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
  const allOk = (clause.all ?? []).every(primitive => log.hasBefore(primitive, readEventId))
  const anyOf = clause.anyOf ?? []
  const anyOfOk = anyOf.length === 0 || anyOf.some(group =>
    group.every(primitive => log.hasBefore(primitive, readEventId)),
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

export function validateContract(contract: ValidationContract, log: EvidenceLog): ValidationResult {
  const missing = contract.required.filter(primitive => !log.has(primitive))
  const forbidden = (contract.forbidden ?? []).filter(primitive => log.has(primitive))
  const sufficientOk = !contract.sufficient?.length
    || contract.sufficient.some(group => groupSatisfied(group, log))
  const temporalFailures = (contract.requiresBeforeReading ?? [])
    .filter(clause => temporalFailureExists(clause, log))

  return {
    passed: missing.length === 0 && forbidden.length === 0 && sufficientOk && temporalFailures.length === 0,
    missing,
    forbidden,
    temporalFailures,
  }
}
