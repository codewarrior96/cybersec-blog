import type { CommandHandler } from '../types'

export const pwdHandler: CommandHandler = {
  name: 'pwd',
  description: 'Print current working directory',
  category: 'system',
  execute(_args, ctx) {
    return {
      output: [ctx.cwd],
      evidence: [
        { type: 'command_executed', command: 'pwd' },
        { type: 'cwd_reached', path: ctx.cwd },
      ],
      exitCode: 0,
    }
  },
}
