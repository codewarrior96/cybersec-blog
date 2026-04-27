import type { SerializedFSNode } from './types'

function cloneNode(node: SerializedFSNode): SerializedFSNode {
  if (node.type === 'file') {
    return { ...node }
  }

  return {
    ...node,
    children: Object.fromEntries(
      Object.entries(node.children).map(([name, child]) => [name, cloneNode(child)]),
    ),
  }
}

export function mergeScenarioWithBaseFs(
  scenarioFs: SerializedFSNode,
  baseFs: SerializedFSNode,
): SerializedFSNode {
  if (baseFs.type === 'file' || scenarioFs.type === 'file') {
    return cloneNode(scenarioFs)
  }

  const mergedChildren: Record<string, SerializedFSNode> = {}

  for (const [name, child] of Object.entries(baseFs.children)) {
    mergedChildren[name] = cloneNode(child)
  }

  for (const [name, child] of Object.entries(scenarioFs.children)) {
    const baseChild = mergedChildren[name]
    mergedChildren[name] = baseChild
      ? mergeScenarioWithBaseFs(child, baseChild)
      : cloneNode(child)
  }

  return {
    type: 'dir',
    perms: scenarioFs.perms,
    children: mergedChildren,
  }
}
