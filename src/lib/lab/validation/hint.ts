import type { EvidenceLog, EvidencePrimitive } from '../evidence'

export interface EvidenceCondition {
  all?: readonly EvidencePrimitive[]
  anyOf?: readonly (readonly EvidencePrimitive[])[]
  none?: readonly EvidencePrimitive[]
}

export interface EvidenceAwareHint {
  id: string
  text: string
  showWhen: EvidenceCondition
}

export function conditionMatches(condition: EvidenceCondition, log: EvidenceLog): boolean {
  const allOk = (condition.all ?? []).every(primitive => log.has(primitive))
  const anyOf = condition.anyOf ?? []
  const anyOfOk = anyOf.length === 0 || anyOf.some(group => group.every(primitive => log.has(primitive)))
  const noneOk = (condition.none ?? []).every(primitive => !log.has(primitive))

  return allOk && anyOfOk && noneOk
}
