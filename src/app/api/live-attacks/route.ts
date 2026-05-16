import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { listAlerts } from '@/lib/soc-store-adapter'
import {
  normalizeToCanonicalSeverity,
  type CanonicalSeverity,
} from '@/lib/severity-taxonomy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface AttackEvent {
  id: number
  time: string
  createdAt: string
  sourceIP: string
  sourceCountry: string
  targetPort: number
  type: string
  severity: 'critical' | 'high' | 'low'
  // R-API-12 closure (Wave 5B): canonical 5-level severity for
  // cross-surface analytics. Additive — existing clients ignore
  // the field; new clients can prefer it over `severity` for
  // taxonomy-agnostic logic (e.g. mixing alerts with report rows
  // in a single dashboard widget).
  canonicalSeverity: CanonicalSeverity
}

function priorityToSeverity(priority: 'P1' | 'P2' | 'P3' | 'P4'): AttackEvent['severity'] {
  if (priority === 'P1') return 'critical'
  if (priority === 'P2') return 'high'
  return 'low'
}

function parsePortFromDescription(description: string): number {
  const match = description.match(/:(\d{1,5})\s*->/)
  if (match) {
    const port = Number(match[1])
    if (Number.isFinite(port) && port >= 1 && port <= 65535) {
      return port
    }
  }
  return 443
}

export async function GET(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response

  const result = await listAlerts({
    limit: 30,
    meUserId: guard.session?.user.id,
  })

  const latest = [...result.alerts].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )[0]

  if (!latest) {
    return NextResponse.json(null, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  }

  const createdAt = latest.createdAt
  const severity = priorityToSeverity(latest.priority)
  const event: AttackEvent = {
    id: latest.id,
    time: new Date(createdAt).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    createdAt,
    sourceIP: latest.sourceIp ?? '0.0.0.0',
    sourceCountry: latest.sourceCountry ?? 'Unknown',
    targetPort: parsePortFromDescription(latest.description),
    type: latest.attackType ?? latest.title,
    severity,
    canonicalSeverity: normalizeToCanonicalSeverity(severity),
  }

  return NextResponse.json(event, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
