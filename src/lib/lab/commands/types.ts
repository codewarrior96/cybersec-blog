import type { CommandContext } from '../types'

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
  evidence?: unknown[]
  exitCode: number
}

/**
 * A single terminal command implementation.
 *
 * Day 1 keeps this intentionally small: handlers return terminal output and
 * optional future side effects while the legacy engine switch remains as
 * fallback. The `evidence` field is a placeholder for Day 2, where it will be
 * narrowed from `unknown[]` to the EvidencePrimitive model.
 */
export interface CommandHandler {
  name: string
  aliases?: string[]
  description: string
  category: CommandCategory
  execute(args: string[], ctx: CommandContext, stdin: string): CommandResult
}
