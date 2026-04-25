import type { CommandHandler } from '../types'

export const historyHandler: CommandHandler = {
  name: 'history',
  description: 'Show command history',
  category: 'system',
  execute(_args, ctx) {
    return {
      output: ctx.history.map((h, i) => `  ${String(i + 1).padStart(4)}  ${h}`),
      evidence: [],
      exitCode: 0,
    }
  },
}
