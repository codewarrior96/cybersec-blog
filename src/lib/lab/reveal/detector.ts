import type { EvidenceLog } from '../evidence'
import { validateContract } from '../validation/contract'
import type { ValidationContract } from '../validation/types'
import type { RevealEvent } from './types'

interface DetectInput {
  level: number
  log: EvidenceLog
  contract: ValidationContract
  expectedFlag: string
  levelTitle: string
  nextLevelTitle: string | null
  alreadyRevealed: ReadonlySet<number>
}

/**
 * Returns a RevealEvent only when:
 *  - the contract's required + sufficient + temporal constraints all pass
 *    against the current evidence log, AND
 *  - the level has not already been revealed (silent for repeat actions)
 *
 * The detector treats the contract's flag check as already-satisfied for
 * reveal purposes — the banner becomes the substitute for the explicit
 * "submit FLAG{...}" step, so we ignore the missing flag_submitted entry
 * when deciding to reveal.
 */
export function detectRevealEvent(input: DetectInput): RevealEvent | null {
  if (input.alreadyRevealed.has(input.level)) {
    return null
  }

  const result = validateContract(input.contract, input.log)

  if (result.forbidden.length > 0 || result.temporalFailures.length > 0) {
    return null
  }

  const blockingMissing = result.missing.filter(p => p.type !== 'flag_submitted')
  if (blockingMissing.length > 0) {
    return null
  }

  return {
    level: input.level,
    levelTitle: input.levelTitle,
    flag: input.expectedFlag,
    nextLevelTitle: input.nextLevelTitle,
  }
}
