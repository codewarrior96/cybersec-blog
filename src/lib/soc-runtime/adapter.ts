import type { AttackEvent, WorkflowMetrics } from '@/lib/dashboard-types'

interface AlertsApiResponse {
  alerts?: AlertApiItem[]
  total?: number
  activeTotal?: number
}

interface CvesApiResponse {
  cves?: Array<{ score?: number | null; severity?: string | null }>
}

interface AlertApiItem {
  id: number
  title: string
  description: string
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  sourceIp: string | null
  sourceCountry: string | null
  attackType: string | null
  createdAt: string
}

function priorityToSeverity(priority: AlertApiItem['priority']): AttackEvent['severity'] {
  if (priority === 'P1') return 'critical'
  if (priority === 'P2') return 'high'
  return 'low'
}

function parsePortFromDescription(description: string): number {
  const firstMatch = description.match(/:(\d{1,5})\s*->/)
  if (firstMatch) {
    const parsed = Number(firstMatch[1])
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535) {
      return parsed
    }
  }

  const secondMatch = description.match(/port\s+(\d{1,5})/i)
  if (secondMatch) {
    const parsed = Number(secondMatch[1])
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535) {
      return parsed
    }
  }

  return 443
}

function toAttackEvent(alert: AlertApiItem): AttackEvent {
  const createdAt = alert.createdAt || new Date().toISOString()

  return {
    id: alert.id,
    time: new Date(createdAt).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    createdAt,
    sourceIP: alert.sourceIp ?? '0.0.0.0',
    sourceCountry: alert.sourceCountry ?? 'Unknown',
    targetPort: parsePortFromDescription(alert.description ?? ''),
    type: alert.attackType ?? alert.title ?? 'Unknown attack',
    severity: priorityToSeverity(alert.priority),
  }
}

export async function fetchLiveMetrics(): Promise<WorkflowMetrics | null> {
  try {
    const response = await fetch('/api/metrics/live', { cache: 'no-store' })
    if (!response.ok) return null
    return (await response.json()) as WorkflowMetrics
  } catch {
    return null
  }
}

export async function fetchAlertSummary(): Promise<{ total: number; activeTotal: number } | null> {
  try {
    const response = await fetch('/api/alerts?limit=1', { cache: 'no-store' })
    if (!response.ok) return null
    const payload = (await response.json()) as AlertsApiResponse
    const total = payload.total ?? payload.alerts?.length ?? 0
    const activeTotal = payload.activeTotal ?? total
    return { total, activeTotal }
  } catch {
    return null
  }
}

export async function fetchCriticalCveCount(): Promise<number | null> {
  try {
    const response = await fetch('/api/cves?days=1', { cache: 'no-store' })
    if (!response.ok) return null
    const payload = (await response.json()) as CvesApiResponse
    const count = (payload.cves ?? []).filter((item) => {
      const score = typeof item.score === 'number' ? item.score : null
      if (score !== null) return score >= 9
      return item.severity?.toUpperCase() === 'CRITICAL'
    }).length
    return count
  } catch {
    return null
  }
}

export async function fetchRecentAlertAttacks(limit = 20): Promise<AttackEvent[]> {
  try {
    const response = await fetch(`/api/alerts?limit=${limit}`, { cache: 'no-store' })
    if (!response.ok) return []
    const payload = (await response.json()) as AlertsApiResponse
    const alerts = payload.alerts ?? []
    return alerts.map(toAttackEvent)
  } catch {
    return []
  }
}
