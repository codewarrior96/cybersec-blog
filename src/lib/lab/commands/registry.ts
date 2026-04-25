import type { CommandHandler } from './types'

const registry = new Map<string, CommandHandler>()

export function registerCommand(handler: CommandHandler): void {
  const key = handler.name.toLowerCase()

  if (registry.has(key)) {
    throw new Error(`Command "${key}" is already registered`)
  }

  registry.set(key, handler)

  for (const alias of handler.aliases ?? []) {
    const aliasKey = alias.toLowerCase()

    if (registry.has(aliasKey)) {
      throw new Error(`Command "${aliasKey}" is already registered`)
    }

    registry.set(aliasKey, handler)
  }
}

export function getCommand(name: string): CommandHandler | undefined {
  return registry.get(name.toLowerCase())
}

export function registerAll(handlers: readonly CommandHandler[]): void {
  for (const handler of handlers) {
    registerCommand(handler)
  }
}
