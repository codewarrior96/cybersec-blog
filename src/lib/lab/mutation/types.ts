import type { DirNode } from '../types'

/**
 * Mutable filesystem node. Structurally identical to DirNode but used here as
 * the in-memory, session-scoped working copy that mutation operations modify
 * in place.
 */
export type MutableFsNode = DirNode

export type MutationOp =
  | { kind: 'touch'; path: string }
  | { kind: 'mkdir'; path: string; recursive?: boolean }
  | { kind: 'rm'; path: string; recursive?: boolean }
  | { kind: 'mv'; from: string; to: string }
  | { kind: 'chmod'; path: string; perms: string }
  | { kind: 'write'; path: string; content: string; append?: boolean }

export interface MutationResult {
  success: boolean
  error?: string
  affectedPaths: readonly string[]
}
