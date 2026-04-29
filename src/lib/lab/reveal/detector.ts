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
  /**
   * Per-challenge start gate cursor. When provided, the detector evaluates
   * the contract only against events with `id >= startedAtEventId`, blocking
   * cross-context auto-complete (e.g. running L1-solving commands in a
   * Curriculum lesson before opening the CTF tab).
   *
   * Sentinel -1 = legacy migration: the level is already completed via
   * pre-startGate localStorage. Detector skips re-firing the banner.
   * Undefined = legacy behavior, validates against the entire log (preserved
   * for code paths that don't yet thread the gate through).
   */
  startedAtEventId?: number
}

/**
 * Returns a RevealEvent only when:
 *  - the contract's required + sufficient + temporal constraints all pass
 *    against the (optionally gated) evidence log, AND
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

  // Legacy migration sentinel: completed before per-challenge gate existed.
  // Suppress re-fire so existing users do not see banners on first reload
  // after the deploy.
  if (input.startedAtEventId === -1) {
    return null
  }

  const result = validateContract(input.contract, input.log, input.startedAtEventId)

  if (result.forbidden.length > 0 || result.temporalFailures.length > 0) {
    return null
  }

  const blockingMissing = result.missing.filter(p => p.type !== 'flag_submitted')
  if (blockingMissing.length > 0) {
    return null
  }

  // No sufficient path satisfied yet — user has not actually walked any
  // canonical solution. Without this gate the detector would fire on first
  // arbitrary command for any contract whose `required` is empty (e.g. L1).
  if (!result.sufficientMet) {
    return null
  }

  return {
    level: input.level,
    levelTitle: input.levelTitle,
    flag: input.expectedFlag,
    nextLevelTitle: input.nextLevelTitle,
  }
}
