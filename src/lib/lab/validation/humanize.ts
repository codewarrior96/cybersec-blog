import type { EvidencePrimitive } from '../evidence'
import { stripAnsi } from '../evidence'

export function humanize(p: EvidencePrimitive): string {
  switch (p.type) {
    case 'command_executed':
      return `\`${p.command}\` komutunu calistir`
    case 'command_executed_with_args':
      return `\`${[p.command, ...p.args].join(' ')}\` komutunu calistir`
    case 'cwd_reached':
      return `\`${p.path}\` dizinine gec`
    case 'file_read':
      return `\`${p.path}\` dosyasini \`${p.via}\` ile oku`
    case 'file_created':
      return `\`${p.path}\` dosyasini olustur`
    case 'file_removed':
      return `\`${p.path}\` dosyasini sil`
    case 'file_modified_perms':
      return `\`${p.path}\` icin \`${p.perms}\` iznini uygula`
    case 'output_contains':
      return `komut ciktisinda \`${stripAnsi(p.value)}\` degerini uret`
    case 'pipeline_used':
      return `\`${p.commands.join(' | ')}\` pipeline akisini kullan`
    case 'flag_submitted':
      return `\`${p.flag}\` bayragini gonder`
    case 'security_tool_used':
      return p.target
        ? `\`${p.tool}\` aracini \`${p.target}\` hedefi icin calistir`
        : `\`${p.tool}\` aracini calistir`
    case 'fact_derived':
      return p.value
        ? `\`${p.fact}\` bilgisini \`${p.value}\` olarak turet`
        : `\`${p.fact}\` bilgisini turet`
    default: {
      const exhaustive: never = p
      return exhaustive
    }
  }
}
