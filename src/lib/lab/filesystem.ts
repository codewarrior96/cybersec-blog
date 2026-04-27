import baseScenario from '@/content/scenarios/_base.json'
import scenario01 from '@/content/scenarios/01-recon.json'
import scenario02 from '@/content/scenarios/02-perms.json'
import scenario03 from '@/content/scenarios/03-hidden.json'
import scenario04 from '@/content/scenarios/04-grep.json'
import scenario05 from '@/content/scenarios/05-privesc.json'
import scenario06 from '@/content/scenarios/06-network.json'

import { mergeScenarioWithBaseFs } from '@/lib/lab/scenarios/merge'
import type { Scenario } from '@/lib/lab/scenarios/types'
import type { DirNode, FSNode } from './types'

// ─── Virtual Filesystem Tree ──────────────────────────────────────────────────
// ROOT is composed at compile time by merging the shared base filesystem
// (_base.json) with each of the 6 BREACH LAB challenge scenarios.
// The hardcoded tree previously inlined here now lives in
// src/content/scenarios/*.json so scenarios can evolve independently of
// engine code. Public API (ROOT + path utilities) is preserved.

const SCENARIOS: readonly Scenario[] = [
  scenario01 as Scenario,
  scenario02 as Scenario,
  scenario03 as Scenario,
  scenario04 as Scenario,
  scenario05 as Scenario,
  scenario06 as Scenario,
]

const mergedFs = SCENARIOS.reduce(
  (acc, scenario) => mergeScenarioWithBaseFs(scenario.initialFs, acc),
  (baseScenario as Scenario).initialFs,
)

export const ROOT: DirNode = mergedFs as unknown as DirNode

// ─── Path Utilities ───────────────────────────────────────────────────────────

export function resolvePath(cwd: string, target: string): string {
  const expanded = target.replace(/^~/, '/home/operator')
  if (expanded.startsWith('/')) return normalizePath(expanded)
  const parts = cwd === '/' ? [] : cwd.split('/').filter(Boolean)
  for (const segment of expanded.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return '/' + parts.join('/')
}

function normalizePath(path: string): string {
  const parts: string[] = []
  for (const segment of path.split('/').filter(Boolean)) {
    if (segment === '..') parts.pop()
    else if (segment !== '.') parts.push(segment)
  }
  return '/' + parts.join('/')
}

export function getNode(path: string): FSNode | null {
  if (path === '/') return ROOT
  let current: FSNode = ROOT
  for (const segment of path.split('/').filter(Boolean)) {
    if (current.type !== 'dir') return null
    const child: FSNode | undefined = current.children[segment]
    if (!child) return null
    current = child
  }
  return current
}

export function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? '/'
}

export function colorEntry(name: string, node: FSNode): string {
  if (node.type === 'dir')              return `\x1b[1;34m${name}/\x1b[0m`
  if (node.perms.includes('x'))         return `\x1b[1;32m${name}*\x1b[0m`
  if (name.startsWith('.'))             return `\x1b[90m${name}\x1b[0m`
  return name
}
