export type ArgMatch = 'subset_unordered' | 'ordered_subsequence' | 'exact_ordered'

export type PathMatch = 'exact' | 'prefix' | 'glob'

export type PipelineMatch = 'exact_ordered' | 'ordered_subsequence'

export interface PathArgMatch {
  index: number
  pathMatch: PathMatch
}

export type EvidencePrimitive =
  | { type: 'command_executed'; command: string }
  | {
      type: 'command_executed_with_args'
      command: string
      args: readonly string[]
      argMatch?: ArgMatch
      pathArgs?: readonly PathArgMatch[]
    }
  | { type: 'cwd_reached'; path: string; pathMatch?: PathMatch }
  | {
      type: 'file_read'
      path: string
      via: 'cat' | 'less' | 'head' | 'tail' | 'strings' | 'grep' | 'awk' | 'wc'
      pathMatch?: PathMatch
    }
  | { type: 'file_created'; path: string; pathMatch?: PathMatch }
  | { type: 'file_removed'; path: string; pathMatch?: PathMatch }
  | { type: 'file_modified_perms'; path: string; perms: string; pathMatch?: PathMatch }
  | { type: 'output_contains'; value: string; caseSensitive?: boolean }
  | { type: 'pipeline_used'; commands: readonly string[]; pipelineMatch?: PipelineMatch }
  | { type: 'flag_submitted'; flag: string }
  | { type: 'security_tool_used'; tool: string; target?: string }
  | { type: 'fact_derived'; fact: string; value?: string; method?: string }
  | { type: 'flag_revealed'; level: number; flag: string }

export interface EvidenceEvent {
  id: number
  timestamp: number
  raw: string
  command: string
  args: readonly string[]
  cwdBefore: string
  cwdAfter: string
  output: readonly string[]
  exitCode: number
  primitives: readonly EvidencePrimitive[]
  source: 'user' | 'panel' | 'replay'
}

export interface EvidenceLog {
  readonly events: readonly EvidenceEvent[]
  append(event: EvidenceEvent): EvidenceLog
  has(expected: EvidencePrimitive): boolean
  hasBefore(expected: EvidencePrimitive, eventId: number): boolean
}
