// Wave 3 — R-LAB-13 closure: scenario merge type-conflict silent shadow (gap-tests)
//
// Phase 2.A R-LAB-13: `mergeScenarioWithBaseFs` (scenarios/merge.ts)
// type-conflict resolution rule (L20-22):
//   if (baseFs.type === 'file' || scenarioFs.type === 'file')
//     return cloneNode(scenarioFs)
// Scenario wins silently when types diverge. A scenario author defining
// `/usr/local/bin` as a file (typo) would replace base's directory
// subtree with the file — no validation throws, ROOT corrupted at
// module load.
//
// Closure: GAP-TEST pattern. Lock current silent-shadow behavior so
// future validation refactor (throw on type conflict) flips assertions.

import { describe, it, expect } from 'vitest'
import { mergeScenarioWithBaseFs } from '@/lib/lab/scenarios/merge'
import type { SerializedFSNode } from '@/lib/lab/scenarios/types'

function mkFile(content: string, perms = '-rw-r--r--'): SerializedFSNode {
  return { type: 'file', perms, content }
}

function mkDir(children: Record<string, SerializedFSNode>, perms = 'drwxr-xr-x'): SerializedFSNode {
  return { type: 'dir', perms, children }
}

describe('R-LAB-13 — scenario merge silent shadow (Wave 3 gap-tests)', () => {
  it('T-SM-MERGE01-GAP — scenario file with same path as base dir SILENTLY shadows the dir', () => {
    // SENIOR ARCHITECT NOTE: this is the documented R-LAB-13 risk.
    // Base has `/usr/bin` as a directory; scenario defines `/usr/bin`
    // as a FILE. The merge picks scenario unconditionally (L20-22).
    // No validation throws. Lock current behavior.
    const base = mkDir({
      usr: mkDir({
        bin: mkDir({
          ls: mkFile('binary'),
          cat: mkFile('binary'),
        }),
      }),
    })
    const scenario = mkDir({
      usr: mkDir({
        bin: mkFile('typo — should be a dir'),
      }),
    })
    const merged = mergeScenarioWithBaseFs(scenario, base)
    expect(merged.type).toBe('dir')
    if (merged.type !== 'dir') return
    const usr = merged.children.usr
    expect(usr.type).toBe('dir')
    if (usr.type !== 'dir') return
    const bin = usr.children.bin
    // GAP: bin is now a FILE (silently replaced the dir tree)
    expect(bin.type).toBe('file')
    if (bin.type !== 'file') return
    expect(bin.content).toBe('typo — should be a dir')
    // Future closure: validation would throw here OR preserve base.
  })

  it('T-SM-MERGE02 — non-conflicting scenario additions are merged into base (happy path)', () => {
    const base = mkDir({
      home: mkDir({
        operator: mkDir({
          'profile.txt': mkFile('default'),
        }),
      }),
    })
    const scenario = mkDir({
      home: mkDir({
        operator: mkDir({
          'extra.txt': mkFile('scenario-specific'),
        }),
      }),
    })
    const merged = mergeScenarioWithBaseFs(scenario, base)
    expect(merged.type).toBe('dir')
    if (merged.type !== 'dir') return
    const home = merged.children.home
    if (home.type !== 'dir') return
    const operator = home.children.operator
    if (operator.type !== 'dir') return
    // Both base + scenario children present
    expect(operator.children['profile.txt']).toBeDefined()
    expect(operator.children['extra.txt']).toBeDefined()
  })

  it('T-SM-MERGE03 — scenario file overrides base file with same path (child wins)', () => {
    const base = mkDir({
      'README': mkFile('base content'),
    })
    const scenario = mkDir({
      'README': mkFile('scenario-overridden'),
    })
    const merged = mergeScenarioWithBaseFs(scenario, base)
    if (merged.type !== 'dir') return
    const readme = merged.children.README
    expect(readme.type).toBe('file')
    if (readme.type !== 'file') return
    expect(readme.content).toBe('scenario-overridden')
  })
})
