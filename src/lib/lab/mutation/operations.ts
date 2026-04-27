import type { DirNode, FSNode } from '../types'
import type { MutableFsNode, MutationOp, MutationResult } from './types'

// Paths under these prefixes are considered root-only. The lab's operator user
// cannot mutate them; this enforces the OSCP-style "you are a low-priv user"
// model without modeling full Linux DAC semantics.
const PROTECTED_PREFIXES = ['/etc', '/usr', '/var', '/proc', '/sys', '/root', '/boot'] as const

function isProtected(path: string): boolean {
  return PROTECTED_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

function getNodeAt(state: MutableFsNode, path: string): FSNode | null {
  if (path === '/') return state
  let current: FSNode = state
  for (const segment of path.split('/').filter(Boolean)) {
    if (current.type !== 'dir') return null
    const child: FSNode | undefined = current.children[segment]
    if (!child) return null
    current = child
  }
  return current
}

function getDirAt(state: MutableFsNode, path: string): DirNode | null {
  const node = getNodeAt(state, path)
  return node?.type === 'dir' ? node : null
}

function splitParent(path: string): { parent: string; name: string } | null {
  if (!path || path === '/') return null
  const segments = path.split('/').filter(Boolean)
  const name = segments.pop()
  if (!name) return null
  return { parent: segments.length === 0 ? '/' : '/' + segments.join('/'), name }
}

function fail(error: string): MutationResult {
  return { success: false, error, affectedPaths: [] }
}

function ok(...affected: string[]): MutationResult {
  return { success: true, affectedPaths: affected }
}

// ─── chmod helper: translate symbolic / numeric modes into perm string ────────

function applyChmodMode(currentPerms: string, mode: string): string | null {
  // Numeric mode: 755, 0755, 644 …
  if (/^0?[0-7]{3}$/.test(mode)) {
    const digits = mode.length === 4 ? mode.slice(1) : mode
    const triplet = (n: number) =>
      `${(n & 4) ? 'r' : '-'}${(n & 2) ? 'w' : '-'}${(n & 1) ? 'x' : '-'}`
    const head = currentPerms.startsWith('d') ? 'd' : '-'
    return head + triplet(Number.parseInt(digits[0], 10))
                + triplet(Number.parseInt(digits[1], 10))
                + triplet(Number.parseInt(digits[2], 10))
  }

  // Symbolic mode: +x, u+x, g-w, a=r, +rx …
  const symbolic = mode.match(/^([ugoa]*)([+\-=])([rwx]+)$/)
  if (symbolic) {
    const [, scopeRaw, op, bits] = symbolic
    const scope = scopeRaw && scopeRaw.length > 0 ? scopeRaw : 'a'
    const positions: Record<'r' | 'w' | 'x', readonly number[]> = {
      r: [1, 4, 7],
      w: [2, 5, 8],
      x: [3, 6, 9],
    }
    const targetTriplets = new Set<number>()
    if (scope.includes('a') || scope.includes('u')) targetTriplets.add(0)
    if (scope.includes('a') || scope.includes('g')) targetTriplets.add(1)
    if (scope.includes('a') || scope.includes('o')) targetTriplets.add(2)
    const chars = currentPerms.split('')
    for (let i = 0; i < bits.length; i++) {
      const bit = bits[i] as 'r' | 'w' | 'x'
      positions[bit].forEach((pos, idx) => {
        if (!targetTriplets.has(idx)) return
        if (op === '+' || op === '=') chars[pos] = bit
        else if (op === '-') chars[pos] = '-'
      })
    }
    return chars.join('')
  }

  return null
}

// ─── Operation handlers ──────────────────────────────────────────────────────

function opTouch(state: MutableFsNode, path: string): MutationResult {
  if (isProtected(path)) {
    return fail(`touch: cannot touch '${path}': Permission denied`)
  }
  const split = splitParent(path)
  if (!split) return fail(`touch: invalid path '${path}'`)
  const parent = getDirAt(state, split.parent)
  if (!parent) {
    return fail(`touch: cannot touch '${path}': No such file or directory`)
  }
  if (parent.children[split.name]) {
    // touch on existing node: succeed without changes (no real timestamp tracking)
    return ok(path)
  }
  parent.children[split.name] = { type: 'file', perms: '-rw-r--r--', content: '' }
  return ok(path)
}

function opMkdir(state: MutableFsNode, path: string): MutationResult {
  if (isProtected(path)) {
    return fail(`mkdir: cannot create directory '${path}': Permission denied`)
  }
  const split = splitParent(path)
  if (!split) return fail(`mkdir: invalid path '${path}'`)
  const parent = getDirAt(state, split.parent)
  if (!parent) {
    return fail(`mkdir: cannot create directory '${path}': No such file or directory`)
  }
  if (parent.children[split.name]) {
    return fail(`mkdir: cannot create directory '${path}': File exists`)
  }
  parent.children[split.name] = { type: 'dir', perms: 'drwxr-xr-x', children: {} }
  return ok(path)
}

function opRm(state: MutableFsNode, path: string, recursive: boolean): MutationResult {
  if (isProtected(path)) {
    return fail(`rm: cannot remove '${path}': Permission denied`)
  }
  const split = splitParent(path)
  if (!split) return fail(`rm: cannot remove '${path}'`)
  const parent = getDirAt(state, split.parent)
  if (!parent) {
    return fail(`rm: cannot remove '${path}': No such file or directory`)
  }
  const target = parent.children[split.name]
  if (!target) {
    return fail(`rm: cannot remove '${path}': No such file or directory`)
  }
  if (target.type === 'dir' && Object.keys(target.children).length > 0 && !recursive) {
    return fail(`rm: cannot remove '${path}': Is a directory`)
  }
  delete parent.children[split.name]
  return ok(path)
}

function opMv(state: MutableFsNode, from: string, to: string): MutationResult {
  if (isProtected(from) || isProtected(to)) {
    return fail(`mv: protected path`)
  }
  const fromSplit = splitParent(from)
  const toSplit = splitParent(to)
  if (!fromSplit || !toSplit) return fail(`mv: invalid path`)
  const fromParent = getDirAt(state, fromSplit.parent)
  const toParent = getDirAt(state, toSplit.parent)
  if (!fromParent) return fail(`mv: cannot stat '${from}': No such file or directory`)
  if (!toParent) return fail(`mv: cannot move to '${to}': No such file or directory`)
  const target = fromParent.children[fromSplit.name]
  if (!target) return fail(`mv: cannot stat '${from}': No such file or directory`)
  delete fromParent.children[fromSplit.name]
  toParent.children[toSplit.name] = target
  return ok(from, to)
}

function opChmod(state: MutableFsNode, path: string, mode: string): MutationResult {
  if (isProtected(path)) {
    return fail(`chmod: changing permissions of '${path}': Operation not permitted`)
  }
  const node = getNodeAt(state, path)
  if (!node) {
    return fail(`chmod: cannot access '${path}': No such file or directory`)
  }
  const next = applyChmodMode(node.perms, mode)
  if (next === null) {
    return fail(`chmod: invalid mode: '${mode}'`)
  }
  ;(node as { perms: string }).perms = next
  return ok(path)
}

function opWrite(state: MutableFsNode, path: string, content: string, append: boolean): MutationResult {
  if (isProtected(path)) {
    return fail(`cannot write to '${path}': Permission denied`)
  }
  const split = splitParent(path)
  if (!split) return fail(`invalid path '${path}'`)
  const parent = getDirAt(state, split.parent)
  if (!parent) {
    return fail(`cannot write '${path}': No such file or directory`)
  }
  const existing = parent.children[split.name]
  if (existing && existing.type === 'dir') {
    return fail(`cannot write '${path}': Is a directory`)
  }
  if (existing && existing.type === 'file') {
    existing.content = append ? existing.content + content : content
  } else {
    parent.children[split.name] = { type: 'file', perms: '-rw-r--r--', content }
  }
  return ok(path)
}

export function applyOperation(state: MutableFsNode, op: MutationOp): MutationResult {
  switch (op.kind) {
    case 'touch': return opTouch(state, op.path)
    case 'mkdir': return opMkdir(state, op.path)
    case 'rm':    return opRm(state, op.path, op.recursive ?? false)
    case 'mv':    return opMv(state, op.from, op.to)
    case 'chmod': return opChmod(state, op.path, op.perms)
    case 'write': return opWrite(state, op.path, op.content, op.append ?? false)
  }
}
