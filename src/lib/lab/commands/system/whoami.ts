import type { CommandHandler } from '../types'

export const whoamiHandler: CommandHandler = {
  name: 'whoami',
  description: 'Print current operator identity',
  category: 'system',
  execute() {
    return { output: ['operator'], evidence: [], exitCode: 0 }
  },
}
