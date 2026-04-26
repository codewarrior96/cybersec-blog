import type { PathMatch } from './types'

export interface NormalizedArgs {
  all: readonly string[]
  flags: readonly string[]
  positionals: readonly string[]
}

export function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, '')
}

export function normalizePath(path: string): string {
  if (path === '/') return '/'

  const normalized = path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')

  return normalized || '/'
}

export function normalizeCommand(command: string): string {
  return command.trim().toLowerCase()
}

export function basenameOf(path: string): string {
  const normalized = normalizePath(path)
  return normalized.split('/').filter(Boolean).at(-1) ?? normalized
}

export function pathMatches(expected: string, actual: string, mode: PathMatch = 'exact'): boolean {
  const left = normalizePath(expected)
  const right = normalizePath(actual)

  if (mode === 'exact') return left === right
  if (mode === 'prefix') return right === left || right.startsWith(`${left}/`)

  const escaped = left
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')

  return new RegExp(`^${escaped}$`).test(right)
}

export function pathArgMatches(expected: string, actual: string, mode: PathMatch): boolean {
  return pathMatches(expected, actual, mode) || basenameOf(expected) === basenameOf(actual)
}

export function normalizeArgs(args: readonly string[]): NormalizedArgs {
  const flags: string[] = []
  const positionals: string[] = []
  const all: string[] = []

  for (const rawArg of args) {
    const arg = rawArg.trim()

    if (/^-[a-zA-Z]{2,}$/.test(arg) && !arg.startsWith('--')) {
      const expanded = arg.slice(1).split('').map(flag => `-${flag}`)
      flags.push(...expanded)
      all.push(...expanded)
      continue
    }

    if (arg.startsWith('-')) {
      flags.push(arg)
      all.push(arg)
      continue
    }

    const normalized = normalizePath(arg)
    positionals.push(normalized)
    all.push(normalized)
  }

  return { all, flags, positionals }
}
