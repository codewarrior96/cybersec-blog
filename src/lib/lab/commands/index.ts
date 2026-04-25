import { registerAll, getCommand, registerCommand } from './registry'
import { clearHandler } from './system/clear'
import { helpHandler } from './system/help'
import { historyHandler } from './system/history'
import { pwdHandler } from './system/pwd'
import { whoamiHandler } from './system/whoami'

registerAll([
  helpHandler,
  pwdHandler,
  whoamiHandler,
  historyHandler,
  clearHandler,
])

if (process.env.NODE_ENV !== 'production') {
  import('./__verify__')
    .then(m => m.verifyRegistry())
    .catch(err => {
      console.error('[BREACH LAB] Registry verification failed:', err)
      throw err
    })
}

export { getCommand, registerCommand, registerAll }
export type { CommandHandler, CommandResult, SideEffect, CommandCategory } from './types'
