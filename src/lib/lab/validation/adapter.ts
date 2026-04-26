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

  const augmentedLog = log.append({
    id: Number.MAX_SAFE_INTEGER,
    timestamp: Date.now(),
    raw: `submit ${flag}`,
    command: 'submit',
    args: [flag],
    cwdBefore: '/ctf-panel',
    cwdAfter: '/ctf-panel',
    output: [],
    exitCode: 0,
    primitives: [{ type: 'flag_submitted', flag }],
    source: 'panel',
  })

  const evidenceResult = validateContract(contract, augmentedLog)

  if (mode === 'evidence_only') {
    return evidenceResult
  }

  return {
    ...evidenceResult,
    passed: isValidFlag(flag) && evidenceResult.passed,
  }
}
