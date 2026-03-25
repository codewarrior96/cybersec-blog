import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { recordAttackEvent } from '@/lib/soc-store-adapter'

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
}

const ATTACK_TYPES = [
  'SSH Brute Force',
  'Port Scan',
  'SQL Injection',
  'RCE Attempt',
  'DDoS',
  'Phishing',
] as const

const COUNTRIES = [
  'China',
  'Russia',
  'USA',
  'Germany',
  'Brazil',
  'Iran',
  'Netherlands',
  'Turkey',
  'India',
  'Singapore',
] as const

const PORTS = [22, 80, 443, 3306, 5432, 6379, 8080, 8443]

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function makeAttack(id: number): AttackEvent {
  const type = ATTACK_TYPES[rnd(0, ATTACK_TYPES.length - 1)]
  const country = COUNTRIES[rnd(0, COUNTRIES.length - 1)]
  const r = Math.random()
  const severity: AttackEvent['severity'] =
    r < 0.17 ? 'critical' : r < 0.58 ? 'high' : 'low'

  const createdAt = new Date().toISOString()
  const now = new Date(createdAt)
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  return {
    id,
    time,
    createdAt,
    sourceIP: `${rnd(1, 223)}.${rnd(0, 255)}.${rnd(0, 255)}.${rnd(1, 254)}`,
    sourceCountry: country,
    targetPort: PORTS[rnd(0, PORTS.length - 1)],
    type,
    severity,
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response

  const eventId = Date.now() % 1_000_000
  const attack = makeAttack(eventId)

  void recordAttackEvent({
    externalId: attack.id,
    occurredAt: attack.createdAt,
    sourceIP: attack.sourceIP,
    sourceCountry: attack.sourceCountry,
    targetPort: attack.targetPort,
    type: attack.type,
    severity: attack.severity,
  }).catch(() => {})

  return new Response(JSON.stringify(attack), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
