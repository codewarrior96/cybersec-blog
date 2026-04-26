import type { EvidencePrimitive, PathArgMatch } from './types'
import {
  normalizeArgs,
  normalizeCommand,
  pathArgMatches,
  pathMatches,
  stripAnsi,
} from './normalize'

function containsSubset(expected: readonly string[], actual: readonly string[]): boolean {
  return expected.every(item => actual.includes(item))
}

function containsOrderedSubsequence(expected: readonly string[], actual: readonly string[]): boolean {
  let cursor = 0

  for (const item of actual) {
    if (item === expected[cursor]) cursor += 1
    if (cursor === expected.length) return true
  }

  return expected.length === 0
}

function argsMatchWithPathArgs(
  expectedArgs: readonly string[],
  actualArgs: readonly string[],
  mode: 'subset_unordered' | 'ordered_subsequence' | 'exact_ordered',
  pathArgs: readonly PathArgMatch[] = [],
): boolean {
  const itemMatches = (expected: string, actual: string, index: number): boolean => {
    const pathArg = pathArgs.find(item => item.index === index)
    if (pathArg) return pathArgMatches(expected, actual, pathArg.pathMatch)
    return expected === actual
  }

  if (mode === 'exact_ordered') {
    return expectedArgs.length === actualArgs.length
      && expectedArgs.every((expected, index) => itemMatches(expected, actualArgs[index] ?? '', index))
  }

  if (mode === 'ordered_subsequence') {
    let cursor = 0

    for (const actual of actualArgs) {
      if (itemMatches(expectedArgs[cursor] ?? '', actual, cursor)) cursor += 1
      if (cursor === expectedArgs.length) return true
    }

    return expectedArgs.length === 0
  }

  return expectedArgs.every((expected, expectedIndex) =>
    actualArgs.some(actual => itemMatches(expected, actual, expectedIndex)),
  )
}

function matchCommandExecuted(
  expected: Extract<EvidencePrimitive, { type: 'command_executed' }>,
  actual: EvidencePrimitive,
): boolean {
  return actual.type === 'command_executed'
    && normalizeCommand(actual.command) === normalizeCommand(expected.command)
}

function matchCommandExecutedWithArgs(
  expected: Extract<EvidencePrimitive, { type: 'command_executed_with_args' }>,
  actual: EvidencePrimitive,
): boolean {
  if (actual.type !== 'command_executed_with_args') return false
  if (normalizeCommand(actual.command) !== normalizeCommand(expected.command)) return false

  const expectedArgs = normalizeArgs(expected.args)
  const actualArgs = normalizeArgs(actual.args)
  const mode = expected.argMatch ?? 'subset_unordered'

  if (mode === 'subset_unordered' && !expected.pathArgs?.length) {
    return containsSubset(expectedArgs.flags, actualArgs.flags)
      && containsSubset(expectedArgs.positionals, actualArgs.positionals)
  }

  return argsMatchWithPathArgs(
    [...expectedArgs.flags, ...expectedArgs.positionals],
    [...actualArgs.flags, ...actualArgs.positionals],
    mode,
    expected.pathArgs,
  )
}

function matchCwdReached(
  expected: Extract<EvidencePrimitive, { type: 'cwd_reached' }>,
  actual: EvidencePrimitive,
): boolean {
  return actual.type === 'cwd_reached'
    && pathMatches(expected.path, actual.path, expected.pathMatch)
}

function matchFileRead(
  expected: Extract<EvidencePrimitive, { type: 'file_read' }>,
  actual: EvidencePrimitive,
): boolean {
  return actual.type === 'file_read'
    && expected.via === actual.via
    && pathMatches(expected.path, actual.path, expected.pathMatch)
}

function matchFileCreated(
  expected: Extract<EvidencePrimitive, { type: 'file_created' }>,
  actual: EvidencePrimitive,
): boolean {
  return actual.type === 'file_created'
    && pathMatches(expected.path, actual.path, expected.pathMatch)
}

function matchFileRemoved(
  expected: Extract<EvidencePrimitive, { type: 'file_removed' }>,
  actual: EvidencePrimitive,
): boolean {
  return actual.type === 'file_removed'
    && pathMatches(expected.path, actual.path, expected.pathMatch)
}

function matchFileModifiedPerms(
  expected: Extract<EvidencePrimitive, { type: 'file_modified_perms' }>,
  actual: EvidencePrimitive,
): boolean {
  return actual.type === 'file_modified_perms'
    && expected.perms === actual.perms
    && pathMatches(expected.path, actual.path, expected.pathMatch)
}

function matchOutputContains(
  expected: Extract<EvidencePrimitive, { type: 'output_contains' }>,
  actual: EvidencePrimitive,
): boolean {
  if (actual.type !== 'output_contains') return false

  const expectedValue = stripAnsi(expected.value)
  const actualValue = stripAnsi(actual.value)

  if (expected.caseSensitive === false) {
    return actualValue.toLowerCase().includes(expectedValue.toLowerCase())
  }

  return actualValue.includes(expectedValue)
}

function matchPipelineUsed(
  expected: Extract<EvidencePrimitive, { type: 'pipeline_used' }>,
  actual: EvidencePrimitive,
): boolean {
  if (actual.type !== 'pipeline_used') return false

  const expectedCommands = expected.commands.map(normalizeCommand)
  const actualCommands = actual.commands.map(normalizeCommand)
  const mode = expected.pipelineMatch ?? 'exact_ordered'

  if (mode === 'ordered_subsequence') {
    return containsOrderedSubsequence(expectedCommands, actualCommands)
  }

  return expectedCommands.length === actualCommands.length
    && expectedCommands.every((cmd, index) => cmd === actualCommands[index])
}

function matchFlagSubmitted(
  expected: Extract<EvidencePrimitive, { type: 'flag_submitted' }>,
  actual: EvidencePrimitive,
): boolean {
  return actual.type === 'flag_submitted' && expected.flag === actual.flag
}

function matchSecurityToolUsed(
  expected: Extract<EvidencePrimitive, { type: 'security_tool_used' }>,
  actual: EvidencePrimitive,
): boolean {
  return actual.type === 'security_tool_used'
    && normalizeCommand(expected.tool) === normalizeCommand(actual.tool)
    && (expected.target === undefined || expected.target === actual.target)
}

function matchFactDerived(
  expected: Extract<EvidencePrimitive, { type: 'fact_derived' }>,
  actual: EvidencePrimitive,
): boolean {
  return actual.type === 'fact_derived'
    && expected.fact === actual.fact
    && (expected.value === undefined || expected.value === actual.value)
    && (expected.method === undefined || expected.method === actual.method)
}

export function matchPrimitive(expected: EvidencePrimitive, actual: EvidencePrimitive): boolean {
  switch (expected.type) {
    case 'command_executed':
      return matchCommandExecuted(expected, actual)
    case 'command_executed_with_args':
      return matchCommandExecutedWithArgs(expected, actual)
    case 'cwd_reached':
      return matchCwdReached(expected, actual)
    case 'file_read':
      return matchFileRead(expected, actual)
    case 'file_created':
      return matchFileCreated(expected, actual)
    case 'file_removed':
      return matchFileRemoved(expected, actual)
    case 'file_modified_perms':
      return matchFileModifiedPerms(expected, actual)
    case 'output_contains':
      return matchOutputContains(expected, actual)
    case 'pipeline_used':
      return matchPipelineUsed(expected, actual)
    case 'flag_submitted':
      return matchFlagSubmitted(expected, actual)
    case 'security_tool_used':
      return matchSecurityToolUsed(expected, actual)
    case 'fact_derived':
      return matchFactDerived(expected, actual)
    default: {
      const exhaustive: never = expected
      return exhaustive
    }
  }
}
