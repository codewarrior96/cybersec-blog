import { NextRequest } from 'next/server'

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
  const encoder = new TextEncoder()
  let eventId = Date.now() % 1_000_000
  let closed = false
  let attackInterval: NodeJS.Timeout | null = null
  let heartbeatInterval: NodeJS.Timeout | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }

      const sendEvent = (name: string, payload: unknown) => {
        write(`event: ${name}\n`)
        write(`data: ${JSON.stringify(payload)}\n\n`)
      }

      const cleanup = () => {
        if (closed) return
        closed = true
        if (attackInterval) clearInterval(attackInterval)
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        try {
          controller.close()
        } catch {
          // no-op
        }
      }

      sendEvent('ready', { ok: true, ts: new Date().toISOString() })

      attackInterval = setInterval(() => {
        const burst = Math.random() < 0.2 ? rnd(2, 4) : 1
        for (let i = 0; i < burst; i += 1) {
          eventId += 1
          sendEvent('attack', makeAttack(eventId))
        }
      }, 1300)

      heartbeatInterval = setInterval(() => {
        write(`: keepalive ${Date.now()}\n\n`)
      }, 12_000)

      request.signal.addEventListener('abort', cleanup)
    },
    cancel() {
      closed = true
      if (attackInterval) clearInterval(attackInterval)
      if (heartbeatInterval) clearInterval(heartbeatInterval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
