import type { AttackEvent, WorkflowMetrics } from '@/lib/dashboard-types'
import type {
  AlarmQueueState,
  AlarmTransition,
  AlarmTransitionReason,
  CriticalIncident,
  SocRuntimeSnapshot,
} from '@/lib/soc-runtime/types'

const MAX_ATTACK_HISTORY = 15
const MAX_TRANSITION_HISTORY = 40

interface InternalState {
  alarmState: AlarmQueueState
  overlayActive: boolean
  overlayCycle: number
  panelOpen: boolean
  reportModalOpen: boolean
  criticalQueue: CriticalIncident[]
  reportTarget: CriticalIncident | null
  attacks: AttackEvent[]
  metrics: WorkflowMetrics | null
  alertCount: number
  cveCount: number
  demoMode: boolean
  transitions: AlarmTransition[]
  seenCriticalIds: Set<number>
}

export type SocRuntimeAction =
  | { type: 'set_metrics'; payload: WorkflowMetrics }
  | { type: 'set_alert_count'; payload: number }
  | { type: 'set_cve_count'; payload: number }
  | { type: 'set_demo_mode'; payload: boolean }
  | { type: 'ingest_attack'; payload: AttackEvent; now: string }
  | { type: 'overlay_timeout'; now: string }
  | { type: 'dismiss_incident'; payload: number; now: string }
  | { type: 'close_panel'; now: string }
  | { type: 'open_report'; payload: number }
  | { type: 'close_report' }
  | { type: 'manual_reset'; now: string }

function transition(
  state: InternalState,
  to: AlarmQueueState,
  reason: AlarmTransitionReason,
  at: string,
): InternalState {
  if (state.alarmState === to) return state
  const entry: AlarmTransition = {
    from: state.alarmState,
    to,
    at,
    reason,
  }
  return {
    ...state,
    alarmState: to,
    transitions: [...state.transitions, entry].slice(-MAX_TRANSITION_HISTORY),
  }
}

function toCriticalIncident(attack: AttackEvent, now: string): CriticalIncident {
  return {
    ...attack,
    detectedAt: now,
  }
}

function withQueue(state: InternalState, queue: CriticalIncident[], now: string): InternalState {
  if (queue.length > 0) {
    return {
      ...state,
      criticalQueue: queue,
      panelOpen: true,
    }
  }

  if (state.alarmState === 'alarm_active') {
    return {
      ...state,
      criticalQueue: queue,
      panelOpen: false,
    }
  }

  const next = transition(state, 'idle', 'queue_drained', now)
  return {
    ...next,
    criticalQueue: queue,
    panelOpen: false,
    reportModalOpen: false,
    reportTarget: null,
  }
}

export function createSocRuntimeInitialState(demoMode = false): InternalState {
  return {
    alarmState: 'idle',
    overlayActive: false,
    overlayCycle: 0,
    panelOpen: false,
    reportModalOpen: false,
    criticalQueue: [],
    reportTarget: null,
    attacks: [],
    metrics: null,
    alertCount: 0,
    cveCount: 0,
    demoMode,
    transitions: [],
    seenCriticalIds: new Set<number>(),
  }
}

export function reduceSocRuntime(state: InternalState, action: SocRuntimeAction): InternalState {
  switch (action.type) {
    case 'set_metrics':
      return { ...state, metrics: action.payload }
    case 'set_alert_count':
      return { ...state, alertCount: action.payload }
    case 'set_cve_count':
      return { ...state, cveCount: action.payload }
    case 'set_demo_mode':
      return { ...state, demoMode: action.payload }
    case 'ingest_attack': {
      const attack = action.payload
      const attacks = [...state.attacks, attack].slice(-MAX_ATTACK_HISTORY)

      if (attack.severity !== 'critical') {
        return { ...state, attacks }
      }

      if (state.seenCriticalIds.has(attack.id)) {
        return { ...state, attacks }
      }

      const seenCriticalIds = new Set(state.seenCriticalIds)
      seenCriticalIds.add(attack.id)

      const incident = toCriticalIncident(attack, action.now)
      const criticalQueue = [...state.criticalQueue, incident]

      let next = {
        ...state,
        attacks,
        seenCriticalIds,
        criticalQueue,
        panelOpen: true,
        overlayActive: true,
        overlayCycle: state.overlayCycle + 1,
      }

      if (state.alarmState !== 'alarm_active') {
        next = transition(next, 'alarm_active', 'critical_ingest', action.now)
      }

      return next
    }
    case 'overlay_timeout': {
      if (state.alarmState !== 'alarm_active') return state
      const nextState = state.criticalQueue.length > 0 ? 'queue_draining' : 'idle'
      const next = transition(state, nextState, 'overlay_timeout', action.now)
      return {
        ...next,
        overlayActive: false,
        panelOpen: state.criticalQueue.length > 0,
      }
    }
    case 'dismiss_incident': {
      const queue = state.criticalQueue.filter((item) => item.id !== action.payload)
      return withQueue(state, queue, action.now)
    }
    case 'close_panel': {
      const next = transition(state, state.alarmState, 'panel_closed', action.now)
      return {
        ...next,
        panelOpen: false,
      }
    }
    case 'open_report': {
      const incident = state.criticalQueue.find((item) => item.id === action.payload) ?? null
      return {
        ...state,
        reportTarget: incident,
        reportModalOpen: incident !== null,
      }
    }
    case 'close_report':
      return {
        ...state,
        reportModalOpen: false,
        reportTarget: null,
      }
    case 'manual_reset': {
      const next = transition(state, 'idle', 'manual_reset', action.now)
      return {
        ...next,
        overlayActive: false,
        panelOpen: false,
        reportModalOpen: false,
        criticalQueue: [],
        reportTarget: null,
      }
    }
    default:
      return state
  }
}

export function toSocRuntimeSnapshot(state: InternalState): SocRuntimeSnapshot {
  return {
    alarmState: state.alarmState,
    overlayActive: state.overlayActive,
    overlayCycle: state.overlayCycle,
    panelOpen: state.panelOpen,
    reportModalOpen: state.reportModalOpen,
    criticalQueue: state.criticalQueue,
    reportTarget: state.reportTarget,
    attacks: state.attacks,
    metrics: state.metrics,
    alertCount: state.alertCount,
    cveCount: state.cveCount,
    demoMode: state.demoMode,
    transitions: state.transitions,
  }
}

