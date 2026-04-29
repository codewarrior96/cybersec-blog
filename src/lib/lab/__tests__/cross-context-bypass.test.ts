import { describe, expect, test } from 'vitest'

import { runCommand, syncEventIdCounter } from '@/lib/lab/engine'
import type { RevealHooks } from '@/lib/lab/engine'
import { challengeContracts } from '@/lib/lab/validation/contracts'
import { detectRevealEvent } from '@/lib/lab/reveal'
import { RingEvidenceLog } from '@/lib/lab/evidence'
import type { EvidenceEvent, EvidenceLog } from '@/lib/lab/evidence'
import { createMutableFs } from '@/lib/lab/mutation'
import { ROOT } from '@/lib/lab/filesystem'
import type { CommandContext } from '@/lib/lab/types'

interface Harness {
  ctx: CommandContext
  log: EvidenceLog
  reveal: RevealHooks
  flagRevealedFor: Set<number>
  onEvent: (e: EvidenceEvent) => void
}

function createHarness(level: number): Harness {
  // Each test starts with a fresh module counter so event ids are deterministic.
  syncEventIdCounter(0)

  let log: EvidenceLog = new RingEvidenceLog()
  const flagRevealedFor = new Set<number>()
  const ctx: CommandContext = {
    cwd: '/home/operator',
    setCwd: (path: string) => { ctx.cwd = path },
    history: [],
    mutableFs: createMutableFs(ROOT),
  }
  const unlockedLevels = new Set<number>()
  for (let i = 1; i <= level; i++) unlockedLevels.add(i)

  const reveal: RevealHooks & { startedAt?: Record<number, number> } = {
    evidenceLog: log,
    unlockedLevels,
    alreadyRevealed: new Set<number>(),
  }

  const onEvent = (event: EvidenceEvent) => {
    log = log.append(event)
    reveal.evidenceLog = log
    if (event.command === '__reveal__') {
      const lvl = Number(event.args[0])
      if (Number.isFinite(lvl)) flagRevealedFor.add(lvl)
    }
  }

  return {
    ctx,
    get log() { return log },
    reveal,
    flagRevealedFor,
    onEvent,
  } as unknown as Harness
}

describe('Cross-context bypass prevention — per-challenge start gate', () => {
  test('detectRevealEvent does NOT fire for events emitted before startedAt[1]', () => {
    const h = createHarness(1)
    // 1. User runs an L1-solving pipeline BEFORE explicitly starting Level 1.
    runCommand('cat /etc/passwd | wc -l', h.ctx, h.onEvent /* no reveal hook */)
    // 2. Now user opens the CTF tab and clicks Start — captures the cursor as
    //    "events from this point forward are mine to solve".
    const startedAtEventId = (h.log as RingEvidenceLog).nextEventId()
    // 3. Detector evaluates with startedAtEventId — must NOT consider prior events.
    const contract = challengeContracts[1]!
    const reveal = detectRevealEvent({
      level: 1,
      log: h.log,
      contract,
      expectedFlag: contract.expectedFlag!,
      levelTitle: contract.levelTitle!,
      nextLevelTitle: 'FILE PERMISSIONS',
      alreadyRevealed: new Set<number>(),
      startedAtEventId,
    })
    expect(reveal).toBeNull()
  })

  test('detectRevealEvent DOES fire for events emitted after startedAt[1]', () => {
    const h = createHarness(1)
    // 1. User explicitly starts the challenge first.
    const startedAtEventId = (h.log as RingEvidenceLog).nextEventId()
    // 2. THEN runs the L1-solving pipeline.
    runCommand('cat /etc/passwd | wc -l', h.ctx, h.onEvent)
    // 3. Detector with same startedAtEventId — should fire.
    const contract = challengeContracts[1]!
    const reveal = detectRevealEvent({
      level: 1,
      log: h.log,
      contract,
      expectedFlag: contract.expectedFlag!,
      levelTitle: contract.levelTitle!,
      nextLevelTitle: 'FILE PERMISSIONS',
      alreadyRevealed: new Set<number>(),
      startedAtEventId,
    })
    expect(reveal).not.toBeNull()
    expect(reveal!.flag).toBe('FLAG{r3con_master_l1nux}')
  })

  test('legacy migration sentinel: startedAtEventId === -1 signals already-completed, no re-fire', () => {
    const h = createHarness(1)
    // Replay the user's history: prior session events restored from localStorage.
    runCommand('cat /etc/passwd | wc -l', h.ctx, h.onEvent)
    // Sentinel value: legacy completion preserved (no fresh startedAt to track).
    const contract = challengeContracts[1]!
    const reveal = detectRevealEvent({
      level: 1,
      log: h.log,
      contract,
      expectedFlag: contract.expectedFlag!,
      levelTitle: contract.levelTitle!,
      nextLevelTitle: 'FILE PERMISSIONS',
      alreadyRevealed: new Set<number>(),
      startedAtEventId: -1,
    })
    expect(reveal).toBeNull()
  })
})
