import type { EvidencePrimitive } from '../evidence'
import { stripAnsi } from '../evidence'

export function humanize(p: EvidencePrimitive): string {
  switch (p.type) {
    case 'command_executed':
      return `run the \`${p.command}\` command`
    case 'command_executed_with_args':
      return `run \`${[p.command, ...p.args].join(' ')}\``
    case 'cwd_reached':
      return `change directory to \`${p.path}\``
    case 'file_read':
      return `read \`${p.path}\` with \`${p.via}\``
    case 'file_created':
      return `create \`${p.path}\``
    case 'file_removed':
      return `remove \`${p.path}\``
    case 'file_modified_perms':
      return `apply permissions \`${p.perms}\` to \`${p.path}\``
    case 'output_contains':
      return `produce \`${stripAnsi(p.value)}\` in the command output`
    case 'pipeline_used':
      return `chain the pipeline \`${p.commands.join(' | ')}\``
    case 'flag_submitted':
      return `submit the flag \`${p.flag}\``
    case 'security_tool_used':
      return p.target
        ? `run \`${p.tool}\` against \`${p.target}\``
        : `run the \`${p.tool}\` tool`
    case 'fact_derived':
      return p.value
        ? `derive \`${p.fact}\` as \`${p.value}\``
        : `derive \`${p.fact}\``
    case 'flag_revealed':
      return `Level ${p.level} reveal: \`${p.flag}\``
    default: {
      const exhaustive: never = p
      return exhaustive
    }
  }
}
