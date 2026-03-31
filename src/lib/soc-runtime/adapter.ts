import type { AttackEvent, WorkflowMetrics } from '@/lib/dashboard-types'

interface AlertsApiResponse {
  alerts?: unknown[]
  total?: number
  activeTotal?: number
}

interface CvesApiResponse {
  cves?: Array<{ score?: number | null; severity?: string | null }>
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

export async function fetchLiveAttack(): Promise<AttackEvent | null> {
  try {
    const response = await fetch('/api/live-attacks', { cache: 'no-store' })
    if (!response.ok) return null
    const attack = (await response.json()) as AttackEvent
    if (!attack || typeof attack.id !== 'number') return null
    return attack
  } catch {
    return null
  }
}

