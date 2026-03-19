import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AttackEventInput, LiveMetrics } from '@/lib/soc-store-memory'

interface SupabaseAttackRow {
  source_country: string | null
  attack_type: string | null
  severity: 'critical' | 'high' | 'low' | null
}

interface SupabaseIpRow {
  source_ip: string | null
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SUPABASE_ATTACK_TABLE = process.env.SUPABASE_ATTACK_EVENTS_TABLE ?? 'attack_events'

let supabaseClient: SupabaseClient | null = null

function mapAttackTypeToTag(attackType: string) {
  const value = attackType.toLowerCase()
  if (value.includes('port')) return 'scanner'
  if (value.includes('ssh')) return 'bruteforce'
  if (value.includes('sql')) return 'sqli'
  if (value.includes('rce')) return 'exploit'
  if (value.includes('ddos')) return 'botnet'
  if (value.includes('phishing')) return 'phishing'
  return 'threat'
}

function normalizeSeverity(value: string | null | undefined): 'critical' | 'high' | 'low' {
  if (value === 'critical') return 'critical'
  if (value === 'high') return 'high'
  return 'low'
}

function getSeverityWeight(value: string | null | undefined) {
  if (value === 'critical') return 4
  if (value === 'high') return 2
  return 1
}

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getSupabaseClient() {
  if (!isSupabaseAttackStoreEnabled()) return null
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return supabaseClient
}

async function fetchRowsSince<T>(
  client: SupabaseClient,
  sinceIso: string,
  columns: string,
  maxRows = 5000,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  while (rows.length < maxRows) {
    const to = from + pageSize - 1
    const { data, error } = await client
      .from(SUPABASE_ATTACK_TABLE)
      .select(columns)
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: false })
      .range(from, to)

    if (error) {
      throw new Error(`supabase read failed: ${error.message}`)
    }

    const page = (data ?? []) as T[]
    if (page.length === 0) break

    rows.push(...page)

    if (page.length < pageSize) break
    from += pageSize
  }

  if (rows.length > maxRows) {
    return rows.slice(0, maxRows)
  }

  return rows
}

export function isSupabaseAttackStoreEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
}

export async function recordAttackEventToSupabase(input: AttackEventInput): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return

  const { error } = await client.from(SUPABASE_ATTACK_TABLE).insert({
    external_id: input.externalId ?? null,
    occurred_at: input.occurredAt,
    source_ip: input.sourceIP,
    source_country: input.sourceCountry,
    target_port: input.targetPort,
    attack_type: input.type,
    severity: input.severity,
    created_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(`supabase insert failed: ${error.message}`)
  }
}

export async function getSupabaseAttackMetrics(): Promise<LiveMetrics['attack'] | null> {
  const client = getSupabaseClient()
  if (!client) return null

  const now = Date.now()
  const oneMinuteAgo = new Date(now - 60 * 1000).toISOString()
  const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000).toISOString()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  const [dayRows, minuteRows, fifteenRows] = await Promise.all([
    fetchRowsSince<SupabaseAttackRow>(client, dayAgo, 'source_country,attack_type,severity', 5000),
    fetchRowsSince<SupabaseIpRow>(client, oneMinuteAgo, 'source_ip', 2000),
    fetchRowsSince<SupabaseIpRow>(client, fifteenMinutesAgo, 'source_ip', 5000),
  ])

  if (dayRows.length === 0) {
    return {
      topCountries: [],
      topTags: [],
      attacksPerMinute: minuteRows.length,
      activeIps: new Set(fifteenRows.map((row) => row.source_ip).filter((ip): ip is string => Boolean(ip))).size,
      liveDensity: 6,
      totalLast24h: 0,
    }
  }

  const countryMap = new Map<string, number>()
  const tagMap = new Map<string, number>()
  let pressure = 0

  for (const row of dayRows) {
    const country = row.source_country?.trim() || 'Unknown'
    countryMap.set(country, (countryMap.get(country) ?? 0) + 1)

    const tag = mapAttackTypeToTag(row.attack_type ?? 'threat')
    tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)

    pressure += getSeverityWeight(normalizeSeverity(row.severity))
  }

  const topCountries = Array.from(countryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5)

  const topTags = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5)

  const attacksPerMinute = minuteRows.length
  const activeIps = new Set(fifteenRows.map((row) => row.source_ip).filter((ip): ip is string => Boolean(ip))).size
  const totalLast24h = dayRows.length

  const uniqueCountries = topCountries.length
  const liveDensity = clamp(
    6,
    Math.round(Math.sqrt(totalLast24h + 1) * 6 + uniqueCountries * 4 + attacksPerMinute * 2 + Math.min(120, pressure * 0.35)),
    100,
  )

  return {
    topCountries,
    topTags,
    attacksPerMinute,
    activeIps,
    liveDensity,
    totalLast24h,
  }
}
