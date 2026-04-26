import type { CommandContext } from '../types'
import type { EvidencePrimitive } from '../evidence'

export type CommandCategory = 'fs' | 'text' | 'system' | 'net' | 'security-sim' | 'ctf'

export type SideEffect =
  | { type: 'create_file'; path: string; content: string }
  | { type: 'create_dir'; path: string }
  | { type: 'remove_node'; path: string }
  | { type: 'chmod'; path: string; perms: string }
  | { type: 'write_file'; path: string; content: string }

export interface CommandResult {
  output: string[]
  sideEffects?: SideEffect[]
  evidence?: EvidencePrimitive[]
  exitCode: number
}

/**
 * A single terminal command implementation.
 *
 * Day 1 keeps this intentionally small: handlers return terminal output and
 * optional future side effects while the legacy engine switch remains as
 * fallback. The `evidence` field records deterministic command activity for
 * the validation layer that will be wired in later phases.
 */
export interface CommandHandler {
  name: string
  aliases?: string[]
  description: string
  category: CommandCategory
  execute(args: string[], ctx: CommandContext, stdin: string): CommandResult
}
