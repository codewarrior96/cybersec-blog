import { NextResponse } from 'next/server'

interface GreyNoiseCountry {
  name: string
  count: number
}

interface GreyNoiseTag {
  name: string
  count: number
}

interface GreyNoiseIP {
  ip: string
  country: string
  classification: string
  tag: string
  last_seen: string
}

interface GreyNoisePayload {
  total: number
  countries: GreyNoiseCountry[]
  tags: GreyNoiseTag[]
  ips: GreyNoiseIP[]
}

interface GNQLStatsResponse {
  count?: number
  stats?: {
    countries?: { country: string; count: number }[]
    tags?: { tag: string; count: number }[]
  }
  data?: {
    ip?: string
    country?: string
    classification?: string
    tags?: string[]
    last_seen?: string
  }[]
}

const MOCK: GreyNoisePayload = {
  total: 1247,
  countries: [
    { name: 'China',   count: 312 },
    { name: 'Russia',  count: 198 },
    { name: 'USA',     count: 156 },
    { name: 'Germany', count: 89  },
    { name: 'Brazil',  count: 67  },
  ],
  tags: [
    { name: 'scanner', count: 445 },
    { name: 'mirai',   count: 123 },
    { name: 'exploit', count: 98  },
  ],
  ips: [
    { ip: '185.220.101.x', country: 'Germany', classification: 'malicious', tag: 'tor-exit', last_seen: '2026-03-19' },
    { ip: '103.55.xx.x',   country: 'China',   classification: 'malicious', tag: 'scanner',  last_seen: '2026-03-19' },
    { ip: '45.142.xx.x',   country: 'Russia',  classification: 'malicious', tag: 'exploit',  last_seen: '2026-03-19' },
  ],
}

export async function GET() {
  const apiKey = process.env.GREYNOISE_API_KEY

  if (!apiKey) {
    return NextResponse.json(MOCK, {
      headers: { 'Cache-Control': 'public, s-maxage=300' },
    })
  }

  try {
    const res = await fetch(
      'https://api.greynoise.io/v2/experimental/gnql/stats?query=last_seen:1d&count=50',
      {
        headers: { key: apiKey },
        next: { revalidate: 300 },
      }
    )

    if (!res.ok) throw new Error(`GreyNoise API ${res.status}`)

    const raw: GNQLStatsResponse = await res.json()

    const countries: GreyNoiseCountry[] = (raw.stats?.countries ?? [])
      .slice(0, 10)
      .map(c => ({ name: c.country, count: c.count }))

    const tags: GreyNoiseTag[] = (raw.stats?.tags ?? [])
      .slice(0, 5)
      .map(t => ({ name: t.tag, count: t.count }))

    const ips: GreyNoiseIP[] = (raw.data ?? [])
      .slice(0, 5)
      .map(d => ({
        ip: d.ip ?? 'unknown',
        country: d.country ?? 'unknown',
        classification: d.classification ?? 'unknown',
        tag: d.tags?.[0] ?? 'unknown',
        last_seen: d.last_seen ?? new Date().toISOString().slice(0, 10),
      }))

    const payload: GreyNoisePayload = {
      total: raw.count ?? 0,
      countries,
      tags,
      ips,
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=300' },
    })
  } catch {
    return NextResponse.json(MOCK, {
      headers: { 'Cache-Control': 'public, s-maxage=300' },
    })
  }
}
