import { ROOT } from '../filesystem'
import type { DirNode, FSNode } from '../types'
import { applyOperation } from './operations'
import type { MutableFsNode, MutationOp, MutationResult } from './types'

let currentMutableFs: MutableFsNode | null = null

function deepCloneFs(node: FSNode): FSNode {
  if (node.type === 'file') {
    return { type: 'file', perms: node.perms, content: node.content }
  }
  const children: Record<string, FSNode> = {}
  for (const [name, child] of Object.entries(node.children)) {
    children[name] = deepCloneFs(child)
  }
  return { type: 'dir', perms: node.perms, children }
}

/** Create a fresh mutable copy from any DirNode snapshot. */
export function createMutableFs(snapshot: DirNode): MutableFsNode {
  const cloned = deepCloneFs(snapshot)
  if (cloned.type !== 'dir') {
    throw new Error('createMutableFs expects a DirNode root')
  }
  return cloned
}

/** Returns the module-level singleton, initializing from ROOT on first call. */
export function initMutableFs(): MutableFsNode {
  if (!currentMutableFs) {
    currentMutableFs = createMutableFs(ROOT)
  }
  return currentMutableFs
}

/** Drop the singleton so the next initMutableFs() rebuilds from ROOT. */
export function resetMutableFs(): void {
  currentMutableFs = null
}

export function getMutableNode(state: MutableFsNode, path: string): FSNode | null {
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

export function applyMutation(state: MutableFsNode, op: MutationOp): MutationResult {
  return applyOperation(state, op)
}
