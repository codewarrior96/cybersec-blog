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
}
