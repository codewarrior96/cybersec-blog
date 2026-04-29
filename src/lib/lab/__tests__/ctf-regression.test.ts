import { describe, expect, test, beforeEach } from 'vitest'

import { runCommand } from '@/lib/lab/engine'
import type { RevealHooks } from '@/lib/lab/engine'
import { challengeContracts } from '@/lib/lab/validation/contracts'
import { validateContract } from '@/lib/lab/validation/contract'
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
}

function createHarness(level: number): Harness {
  let log: EvidenceLog = new RingEvidenceLog()
  const flagRevealedFor = new Set<number>()
  const ctx: CommandContext = {
    cwd: '/home/operator',
    setCwd: (path: string) => { ctx.cwd = path },
    history: [],
    mutableFs: createMutableFs(ROOT),
  }
  // Levels 1..N (the level under test, plus all earlier) considered unlocked
  const unlockedLevels = new Set<number>()
  for (let i = 1; i <= level; i++) unlockedLevels.add(i)

  const reveal: RevealHooks = {
    get evidenceLog() { return log },
    unlockedLevels,
    alreadyRevealed: new Set<number>(),
  } as unknown as RevealHooks

  // ⚠ runCommand currently reads reveal.evidenceLog by value at call-time.
  // Wrap so each command sees the up-to-date log.
  const hooksProxy: RevealHooks = {
    evidenceLog: log,
    unlockedLevels,
    alreadyRevealed: new Set<number>(),
  }

  const onEvent = (event: EvidenceEvent) => {
    log = log.append(event)
    hooksProxy.evidenceLog = log
    if (event.command === '__reveal__') {
      const lvl = Number(event.args[0])
      if (Number.isFinite(lvl)) flagRevealedFor.add(lvl)
    }
  }

  return {
    ctx,
    get log() { return log },
    reveal: hooksProxy,
    flagRevealedFor,
    onEvent,
  } as unknown as Harness & { onEvent: (e: EvidenceEvent) => void }
}

function runSequence(level: number, commands: string[]) {
  const h = createHarness(level) as Harness & { onEvent: (e: EvidenceEvent) => void }
  for (const cmd of commands) {
    runCommand(cmd, h.ctx, h.onEvent, h.reveal)
  }
  return h
}

/**
 * The reveal banner is the production "submit" — `detectRevealEvent` waives
 * the `flag_submitted` requirement on purpose. These tests mirror that
 * semantic: contract must pass except for missing `flag_submitted`, AND a
 * reveal event must fire for the level under test.
 */
function expectChallengeCompletes(level: number, log: EvidenceLog, revealed: Set<number>) {
  const contract = challengeContracts[level]
  expect(contract).toBeDefined()
  const result = validateContract(contract!, log)
  // Allow only flag_submitted to be missing (banner replaces submit).
  const blocking = result.missing.filter(p => p.type !== 'flag_submitted')
  expect(blocking).toEqual([])
  expect(result.forbidden).toEqual([])
  expect(result.temporalFailures).toEqual([])
  expect(revealed.has(level)).toBe(true)
}

describe('CTF regression — all 6 challenges via canonical command sequences', () => {
  test('L1 RECONNAISSANCE — cat /etc/passwd | wc -l reveals FLAG{r3con_master_l1nux}', () => {
    const h = runSequence(1, ['cat /etc/passwd | wc -l'])
    expectChallengeCompletes(1, h.log, h.flagRevealedFor)
  })

  test('L2 FILE PERMISSIONS — chmod +x + bash secret.sh reveals FLAG{ch4mod_p3rm1ss10ns}', () => {
    const h = runSequence(2, [
      'cd /home/operator/challenges/02-perms',
      'chmod +x secret.sh',
      'bash secret.sh',
    ])
    expectChallengeCompletes(2, h.log, h.flagRevealedFor)
  })

  test('L3 HIDDEN FILES — ls -la then cat .vault reveals FLAG{h1dden_1n_pl41n_s1ght}', () => {
    const h = runSequence(3, [
      'cd /home/operator/challenges/03-hidden',
      'ls -la',
      'cat .vault',
    ])
    expectChallengeCompletes(3, h.log, h.flagRevealedFor)
  })

  test('L4 GREP MASTER — grep "FLAG" access.log reveals FLAG{gr3p_1s_p0w3r}', () => {
    const h = runSequence(4, [
      'cd /home/operator/challenges/04-grep',
      'grep "FLAG" access.log',
    ])
    expectChallengeCompletes(4, h.log, h.flagRevealedFor)
  })

  test('L5 PRIVILEGE ESCALATION — sudo -l + find -perm -4000 + sudo find -exec cat reveals FLAG{pr1v3sc_r00t_0wn3d}', () => {
    const h = runSequence(5, [
      'cd /home/operator/challenges/05-privesc',
      'sudo -l',
      'find / -perm -4000 2>/dev/null',
      'sudo find . -exec cat /etc/hostname \\;',
    ])
    expectChallengeCompletes(5, h.log, h.flagRevealedFor)
  })

  test('L6 NETWORK ANALYSIS — ss -tulpn + grep 4444 syslog reveals FLAG{n3tw0rk_m4st3r_2024}', () => {
    const h = runSequence(6, [
      'cd /home/operator/challenges/06-network',
      'ss -tulpn',
      'grep 4444 /var/log/syslog',
    ])
    expectChallengeCompletes(6, h.log, h.flagRevealedFor)
  })
})
