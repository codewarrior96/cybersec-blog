import type { EvidencePrimitive, PathMatch } from '../evidence'

export type ValidationMode = 'legacy_flag_only' | 'evidence_only' | 'hybrid'

export interface RequiresBeforeReadingClause {
  target: {
    path: string
    pathMatch?: PathMatch
  }
  all?: readonly EvidencePrimitive[]
  anyOf?: readonly (readonly EvidencePrimitive[])[]
}

export interface ValidationContract {
  required: readonly EvidencePrimitive[]
  sufficient?: readonly (readonly EvidencePrimitive[])[]
  forbidden?: readonly EvidencePrimitive[]
  requiresBeforeReading?: readonly RequiresBeforeReadingClause[]
  /**
   * Flag that the auto-reveal banner should print when this contract's
   * evidence requirements are satisfied. Populated in contracts.ts when
   * Block B replaces filesystem flag.txt with contract metadata.
   */
  expectedFlag?: string
  /** Display title used in the reveal banner header for this level. */
  levelTitle?: string
}

export interface ValidationResult {
  passed: boolean
  missing: readonly EvidencePrimitive[]
  forbidden: readonly EvidencePrimitive[]
  temporalFailures: readonly RequiresBeforeReadingClause[]
  /**
   * True iff at least one `sufficient` group was satisfied (or the contract
   * has no `sufficient` clause). Surfaces the gating bit that `passed`
   * collapses, so the reveal detector can decline to fire when missing
   * primitives are only `flag_submitted` BUT no sufficient evidence path
   * has actually been walked yet.
   */
  sufficientMet: boolean
}
