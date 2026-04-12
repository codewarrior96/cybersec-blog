export type TelemetryProtocol = 'TCP' | 'UDP' | 'ICMP' | 'HTTP' | 'DNS'
export type ThreatFamily =
  | 'identity'
  | 'web'
  | 'c2'
  | 'exfil'
  | 'availability'
  | 'endpoint'
  | 'lateral'

export interface ThreatProfile {
  type: string
  family: ThreatFamily
  protocols: readonly TelemetryProtocol[]
  ports: readonly number[]
}

export interface TelemetryLike {
  id: string
  type: string
  source: string
  node: string
  region: string
}

export const THREAT_PROFILES: readonly ThreatProfile[] = [
  { type: 'Auth Bypass Attempt', family: 'identity', protocols: ['HTTP', 'TCP'], ports: [443, 8443, 22] },
  { type: 'Credential Stuffing Wave', family: 'identity', protocols: ['HTTP', 'TCP'], ports: [443, 80] },
  { type: 'Privilege Escalation Signal', family: 'identity', protocols: ['TCP'], ports: [3389, 22, 389] },
  { type: 'SQL Injection Payload', family: 'web', protocols: ['HTTP'], ports: [443, 80, 8080] },
  { type: 'API Abuse Spike', family: 'web', protocols: ['HTTP'], ports: [443, 8080] },
  { type: 'C2 Beaconing', family: 'c2', protocols: ['DNS', 'HTTP', 'TCP'], ports: [53, 443, 8080] },
  { type: 'DNS Tunneling Activity', family: 'c2', protocols: ['DNS'], ports: [53] },
  { type: 'Suspicious PowerShell Beacon', family: 'endpoint', protocols: ['HTTP', 'TCP'], ports: [443, 5985] },
  { type: 'Lateral Movement SMB', family: 'lateral', protocols: ['TCP'], ports: [445, 139] },
  { type: 'RDP Brute Force Burst', family: 'lateral', protocols: ['TCP'], ports: [3389] },
  { type: 'Large Data Exfil', family: 'exfil', protocols: ['TCP', 'HTTP'], ports: [443, 8443, 21] },
  { type: 'SYN Flood', family: 'availability', protocols: ['TCP', 'UDP'], ports: [443, 80, 53] },
]

const THREAT_PROFILE_INDEX = new Map<string, ThreatProfile>(
  THREAT_PROFILES.map((profile) => [profile.type, profile]),
)

export function getThreatProfile(type: string): ThreatProfile {
  return (
    THREAT_PROFILE_INDEX.get(type) ?? {
      type,
      family: 'endpoint',
      protocols: ['TCP'],
      ports: [443],
    }
  )
}

export function getThreatFamily(type: string): ThreatFamily {
  return getThreatProfile(type).family
}

export function countRelatedTelemetrySignals(
  pivot: TelemetryLike,
  candidates: readonly TelemetryLike[],
  linkedEventIds?: readonly string[],
): number {
  if (linkedEventIds?.length) return Math.max(linkedEventIds.length - 1, 0)

  const pivotFamily = getThreatFamily(pivot.type)
  const related = candidates.filter((candidate) => {
    if (candidate.id === pivot.id) return false
    if (candidate.source === pivot.source) return true
    if (candidate.node === pivot.node) return true
    return candidate.region === pivot.region && getThreatFamily(candidate.type) === pivotFamily
  })

  return related.length
}
