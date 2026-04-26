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
}

export interface ValidationResult {
  passed: boolean
  missing: readonly EvidencePrimitive[]
  forbidden: readonly EvidencePrimitive[]
  temporalFailures: readonly RequiresBeforeReadingClause[]
}
