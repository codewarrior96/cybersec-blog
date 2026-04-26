import type { CommandHandler } from '../types'

export const whoamiHandler: CommandHandler = {
  name: 'whoami',
  description: 'Print current operator identity',
  category: 'system',
  execute() {
    return {
      output: ['operator'],
      evidence: [
        { type: 'command_executed', command: 'whoami' },
      ],
      exitCode: 0,
    }
  },
}
