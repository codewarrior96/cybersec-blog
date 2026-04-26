import { matchPrimitive } from './match'
import type { EvidenceEvent, EvidenceLog, EvidencePrimitive } from './types'

export const MAX_EVIDENCE_EVENTS = 200

export interface SerializedEvidenceLog {
  version: 1
  events: readonly EvidenceEvent[]
}

export class RingEvidenceLog implements EvidenceLog {
  readonly events: readonly EvidenceEvent[]

  constructor(events: readonly EvidenceEvent[] = []) {
    this.events = events.slice(-MAX_EVIDENCE_EVENTS)
  }

  append(event: EvidenceEvent): EvidenceLog {
    return new RingEvidenceLog([...this.events, event].slice(-MAX_EVIDENCE_EVENTS))
  }

  has(expected: EvidencePrimitive): boolean {
    return this.events.some(event =>
      event.primitives.some(actual => matchPrimitive(expected, actual)),
    )
  }

  hasBefore(expected: EvidencePrimitive, eventId: number): boolean {
    return this.events
      .filter(event => event.id < eventId)
      .some(event => event.primitives.some(actual => matchPrimitive(expected, actual)))
  }
}

export function serializeEvidenceLog(log: EvidenceLog): string {
  return JSON.stringify({
    version: 1,
    events: log.events.slice(-MAX_EVIDENCE_EVENTS),
  } satisfies SerializedEvidenceLog)
}

export function deserializeEvidenceLog(raw: string | null): EvidenceLog {
  if (!raw) return new RingEvidenceLog()

  try {
    const parsed = JSON.parse(raw) as Partial<SerializedEvidenceLog>

    if (parsed.version !== 1 || !Array.isArray(parsed.events)) {
      return new RingEvidenceLog()
    }

    return new RingEvidenceLog(parsed.events.slice(-MAX_EVIDENCE_EVENTS))
  } catch {
    return new RingEvidenceLog()
  }
}

export function evidenceStorageKey(scenarioId: string): string {
  return `breach-lab:evidence:${scenarioId}`
}
