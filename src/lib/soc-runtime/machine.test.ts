import type { AttackEvent } from '@/lib/dashboard-types'
import {
  createSocRuntimeInitialState,
  reduceSocRuntime,
  toSocRuntimeSnapshot,
} from '@/lib/soc-runtime/machine'

function buildAttack(id: number, severity: AttackEvent['severity'] = 'critical'): AttackEvent {
  return {
    id,
    time: '12:00',
    createdAt: '2026-03-31T10:00:00.000Z',
    sourceIP: '203.0.113.7',
    sourceCountry: 'TR',
    targetPort: 443,
    type: 'SQL Injection',
    severity,
  }
}

describe('soc runtime machine', () => {
  test('critical event always triggers alarm lifecycle and drains deterministically', () => {
    let state = createSocRuntimeInitialState()

    state = reduceSocRuntime(state, {
      type: 'ingest_attack',
      payload: buildAttack(1001, 'critical'),
      now: '2026-03-31T10:00:00.000Z',
    })

    let snapshot = toSocRuntimeSnapshot(state)
    expect(snapshot.alarmState).toBe('alarm_active')
    expect(snapshot.overlayActive).toBe(true)
    expect(snapshot.overlayCycle).toBe(1)
    expect(snapshot.panelOpen).toBe(true)
    expect(snapshot.criticalQueue).toHaveLength(1)

    state = reduceSocRuntime(state, {
      type: 'overlay_timeout',
      now: '2026-03-31T10:00:07.000Z',
    })

    snapshot = toSocRuntimeSnapshot(state)
    expect(snapshot.alarmState).toBe('queue_draining')
    expect(snapshot.overlayActive).toBe(false)
    expect(snapshot.panelOpen).toBe(true)

    state = reduceSocRuntime(state, {
      type: 'dismiss_incident',
      payload: 1001,
      now: '2026-03-31T10:00:10.000Z',
    })

    snapshot = toSocRuntimeSnapshot(state)
    expect(snapshot.alarmState).toBe('idle')
    expect(snapshot.criticalQueue).toHaveLength(0)
    expect(snapshot.panelOpen).toBe(false)
  })

  test('dedup prevents duplicate alarm enqueue for same critical event id', () => {
    let state = createSocRuntimeInitialState()

    state = reduceSocRuntime(state, {
      type: 'ingest_attack',
      payload: buildAttack(42, 'critical'),
      now: '2026-03-31T11:00:00.000Z',
    })
    state = reduceSocRuntime(state, {
      type: 'ingest_attack',
      payload: buildAttack(42, 'critical'),
      now: '2026-03-31T11:00:01.000Z',
    })

    const snapshot = toSocRuntimeSnapshot(state)
    expect(snapshot.attacks).toHaveLength(2)
    expect(snapshot.criticalQueue).toHaveLength(1)
    expect(snapshot.overlayCycle).toBe(1)
    expect(snapshot.alarmState).toBe('alarm_active')
  })

  test('new critical id while active must re-trigger overlay cycle', () => {
    let state = createSocRuntimeInitialState()

    state = reduceSocRuntime(state, {
      type: 'ingest_attack',
      payload: buildAttack(1, 'critical'),
      now: '2026-03-31T12:00:00.000Z',
    })
    state = reduceSocRuntime(state, {
      type: 'ingest_attack',
      payload: buildAttack(2, 'critical'),
      now: '2026-03-31T12:00:01.000Z',
    })

    const snapshot = toSocRuntimeSnapshot(state)
    expect(snapshot.criticalQueue.map((item) => item.id)).toEqual([1, 2])
    expect(snapshot.overlayCycle).toBe(2)
    expect(snapshot.overlayActive).toBe(true)
  })
})
