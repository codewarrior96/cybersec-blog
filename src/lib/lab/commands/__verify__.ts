import { getCommand } from './registry'
import type { CommandContext } from '../types'

export function verifyRegistry(): void {
  const expectedCommands = ['help', 'pwd', 'whoami', 'history', 'clear'] as const

  for (const command of expectedCommands) {
    if (!getCommand(command)) {
      throw new Error(`Command registry verification failed: "${command}" is missing`)
    }
  }

  const ctx: CommandContext = {
    cwd: '/home/operator',
    setCwd() {},
    history: [],
  }

  const clearResult = getCommand('clear')?.execute([], ctx, '')

  if (!clearResult || clearResult.output[0] !== '__CLEAR__') {
    throw new Error('Command registry verification failed: clear sentinel changed')
  }

  const pwdResult = getCommand('pwd')?.execute([], ctx, '')

  if (!pwdResult?.evidence || pwdResult.evidence.length !== 2) {
    throw new Error('Command registry verification failed: pwd evidence length changed')
  }

  if (pwdResult.evidence[0]?.type !== 'command_executed') {
    throw new Error('Command registry verification failed: pwd first evidence primitive changed')
  }

  if (pwdResult.evidence[1]?.type !== 'cwd_reached') {
    throw new Error('Command registry verification failed: pwd second evidence primitive changed')
  }
}
