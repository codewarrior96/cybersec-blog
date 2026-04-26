import type { CommandHandler } from '../types'

export const clearHandler: CommandHandler = {
  name: 'clear',
  description: 'Clear terminal output',
  category: 'system',
  execute() {
    return {
      output: ['__CLEAR__'],
      evidence: [
        { type: 'command_executed', command: 'clear' },
      ],
      exitCode: 0,
    }
  },
}
