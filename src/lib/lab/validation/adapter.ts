import type { EvidenceLog } from '../evidence'
import { isValidFlag } from '../engine'
import { validateContract } from './contract'
import type { ValidationContract, ValidationMode, ValidationResult } from './types'

const emptyResult: ValidationResult = {
  passed: false,
  missing: [],
  forbidden: [],
  temporalFailures: [],
}

export function validateChallengeWithMode(
  mode: ValidationMode,
  flag: string,
  contract: ValidationContract | undefined,
  log: EvidenceLog,
): ValidationResult {
  if (mode === 'legacy_flag_only') {
    return { ...emptyResult, passed: isValidFlag(flag) }
  }

  if (!contract) {
    return emptyResult
  }

  const evidenceResult = validateContract(contract, log)

  if (mode === 'evidence_only') {
    return evidenceResult
  }

  return {
    ...evidenceResult,
    passed: isValidFlag(flag) && evidenceResult.passed,
  }
}
