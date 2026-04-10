'use client'

import React, { ReactNode, startTransition, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath, type GeoProjection, type GeoPermissibleObjects } from 'd3-geo'
import { feature as topoFeature, mesh as topoMesh } from 'topojson-client'
import worldTopologyData from '../../../public/world-110m.json'
import AttackReportModal from '@/components/dashboard/AttackReportModal'
import CriticalAlertPanel from '@/components/dashboard/CriticalAlertPanel'
import CriticalOverlayFx from '@/components/dashboard/CriticalOverlayFx'
import type { CriticalAlertQueueItem } from '@/components/dashboard/CriticalAlertPanel'
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton'
import TelemetryStreamPanel from '@/components/dashboard/TelemetryStreamPanel'
import { THREAT_PROFILES, getThreatFamily, getThreatProfile } from '@/lib/telemetry-rules'

// ============================================================================
// TYPES & CONSTANTS 
// ============================================================================
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED'
type Protocol = 'TCP' | 'UDP' | 'ICMP' | 'HTTP' | 'DNS'
type TimelineType = 'OBSERVED' | 'CORRELATED' | 'DETECTED' | 'ALERT_OPENED' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED'

export interface TimelineEntry {
  id: string
  time: string
  desc: string
  type: TimelineType
}

export interface Incident {
  id: string
  sev: Severity
  time: string
  label: string
  source: string
  node: string
  region: string
  status: IncidentStatus
  sla: number
  events: string[]
  timeline: TimelineEntry[]
}

export interface ThreatEvent {
  id: string
  timestamp: string
  sev: Severity
  type: string
  source: string
  node: string
  region: string
  protocol: Protocol
  port: number
}

type TelemetryCaseFilter = 'ALL' | 'NO_CASE' | 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED'

const THEME = {
  border: 'border-[#1a2e1a]',
  panelBg: 'bg-[#07110a]/88',
  panelDim: 'bg-[#050c07]/94',
  panelHead: 'bg-[#08120b]',
  panelHeadDim: 'bg-[#060c08]',
  severity: {
    CRITICAL: { hex: '#f43f5e', text: 'text-rose-400', bg: 'bg-rose-500', doc: 'bg-rose-950/30' },
    HIGH: { hex: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-500', doc: 'bg-amber-950/30' },
    MEDIUM: { hex: '#22c55e', text: 'text-emerald-300', bg: 'bg-emerald-500', doc: 'bg-emerald-950/20' },
    LOW: { hex: '#86efac', text: 'text-green-300', bg: 'bg-green-500', doc: 'bg-green-950/10' },
  }
}

const REGIONS = ['US-EAST', 'UK-LON', 'JP-TYO', 'SG-SIN', 'BR-SAO', 'RU-MOW', 'CN-PEK'] as const
type RegionKey = (typeof REGIONS)[number]
const MOCK_MAP_POINTS = [
  { lat: 40.71, lng: -74.00, region: 'US-EAST' },
  { lat: 51.50, lng: -0.12, region: 'UK-LON' },
  { lat: 35.68, lng: 139.69, region: 'JP-TYO' },
  { lat: 1.35, lng: 103.81, region: 'SG-SIN' },
  { lat: -23.55, lng: -46.63, region: 'BR-SAO' },
  { lat: 55.75, lng: 37.61, region: 'RU-MOW' },
  { lat: 39.90, lng: 116.40, region: 'CN-PEK' },
]

// ============================================================================
// UTILS
// ============================================================================
const formatTime = (iso: string): string => iso.split('T')[1].substring(0, 8)
const formatDateTime = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`
}
const formatSLA = (seconds: number): string => {
  const sFloor = Math.max(0, Math.floor(seconds))
  const h = Math.floor(sFloor / 3600).toString().padStart(2, '0')
  const m = Math.floor((sFloor % 3600) / 60).toString().padStart(2, '0')
  const s = (sFloor % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

const pickWeightedIndex = (weights: number[]): number => {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return Math.floor(Math.random() * weights.length)

  let cursor = Math.random() * total
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index]
    if (cursor <= 0) return index
  }
  return weights.length - 1
}

const pickRegion = (recentEvents: ThreatEvent[], fallbackRegion?: string): RegionKey => {
  if (fallbackRegion && (REGIONS as readonly string[]).includes(fallbackRegion)) return fallbackRegion as RegionKey

  const recent = recentEvents.slice(0, 6)
  const lastRegion = recent[0]?.region ?? null
  const weights = REGIONS.map((region) => {
    const repeated = recent.filter((event) => event.region === region).length
    let score = 10 - repeated * 2
    if (region === lastRegion) score -= 4
    return Math.max(1, score)
  })

  return REGIONS[pickWeightedIndex(weights)]
}

const pickThreatProfile = (recentEvents: ThreatEvent[], fixedType?: string) => {
  if (fixedType) return getThreatProfile(fixedType)

  const recent = recentEvents.slice(0, 8)
  const lastType = recent[0]?.type ?? null
  const typeCounts = new Map<string, number>()
  const familyCounts = new Map<string, number>()

  recent.forEach((event) => {
    typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1)
    const family = getThreatFamily(event.type)
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1)
  })

  const weights = THREAT_PROFILES.map((profile) => {
    const typeCount = typeCounts.get(profile.type) ?? 0
    const familyCount = familyCounts.get(profile.family) ?? 0
    let score = 100

    if (profile.type === lastType) score -= 60
    score -= typeCount * 26
    score -= familyCount * 14

    if (recent.slice(0, 3).some((event) => event.type === profile.type)) score -= 28
    if (recent.slice(0, 2).every((event) => getThreatFamily(event.type) === profile.family)) score -= 18

    return Math.max(6, score)
  })

  return THREAT_PROFILES[pickWeightedIndex(weights)]
}

const createUniqueSignalSurface = (recentEvents: ThreatEvent[], region: string) => {
  const recentSignatures = new Set(
    recentEvents
      .slice(0, 12)
      .map((event) => `${event.source}|${event.node}|${event.region}`),
  )

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const source = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
    const nodePrefix = region === 'US-EAST' ? 'FIN' : region === 'UK-LON' ? 'OPS' : region === 'JP-TYO' ? 'EDGE' : region === 'SG-SIN' ? 'APAC' : region === 'BR-SAO' ? 'LAT' : region === 'RU-MOW' ? 'CORE' : 'CN'
    const node = `${nodePrefix}-NODE-${Math.floor(Math.random() * 999)}`
    const signature = `${source}|${node}|${region}`
    if (!recentSignatures.has(signature)) return { source, node }
  }

  return {
    source: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    node: `NODE-${Math.floor(Math.random() * 999)}`,
  }
}

const generateEvent = (
  containedNodes: string[],
  recentEvents: ThreatEvent[],
  forceMalicious?: boolean,
  fixedValues?: Partial<ThreatEvent>,
): ThreatEvent | null => {
  const profile = pickThreatProfile(recentEvents, fixedValues?.type)
  const isMalicious = forceMalicious !== undefined ? forceMalicious : Math.random() < MALICIOUS_EVENT_PROBABILITY
  const region = pickRegion(recentEvents, fixedValues?.region)
  const signalSurface = fixedValues?.source && fixedValues?.node
    ? { source: fixedValues.source, node: fixedValues.node }
    : createUniqueSignalSurface(recentEvents, region)

  if (containedNodes.includes(signalSurface.source) || containedNodes.includes(signalSurface.node)) return null

  const protocol = fixedValues?.protocol || profile.protocols[Math.floor(Math.random() * profile.protocols.length)]
  const port = fixedValues?.port || profile.ports[Math.floor(Math.random() * profile.ports.length)]

  return {
    id: `EVT-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
    timestamp: fixedValues?.timestamp || new Date().toISOString(),
    sev: fixedValues?.sev || (isMalicious ? (Math.random() < CRITICAL_EVENT_PROBABILITY ? 'CRITICAL' : 'HIGH') : (Math.random() > 0.5 ? 'MEDIUM' : 'LOW')),
    type: fixedValues?.type || profile.type,
    source: signalSurface.source,
    node: signalSurface.node,
    region,
    protocol: protocol as Protocol,
    port,
  }
}

const shouldAutoEscalateCriticalIncident = (event: ThreatEvent, pool: Incident[]): boolean => {
  if (event.sev !== 'CRITICAL') return false

  const latestCriticalOpenedAt = pool.reduce((latest, incident) => {
    if (
      incident.sev !== 'CRITICAL' ||
      incident.status === 'RESOLVED'
    ) {
      return latest
    }

    const incidentTime = new Date(incident.time).getTime()
    if (!Number.isFinite(incidentTime)) return latest
    return Math.max(latest, incidentTime)
  }, 0)

  if (latestCriticalOpenedAt > 0 && Date.now() - latestCriticalOpenedAt < CRITICAL_INCIDENT_COOLDOWN_MS) {
    return false
  }

  return !pool.some(
    (incident) =>
      incident.sev === 'CRITICAL' &&
      incident.source === event.source &&
      incident.node === event.node &&
      incident.region === event.region &&
      incident.status !== 'RESOLVED',
  )
}

// ============================================================================
// UI WRAPPER FRAME
// ============================================================================

interface FrameProps {
  title: string
  children: ReactNode
  rightAction?: ReactNode
  dim?: boolean
  className?: string
  headerClass?: string
}

const Frame = ({ title, children, rightAction, dim = false, className = '', headerClass = '' }: FrameProps) => (
  <section className={`flex flex-col border ${THEME.border} ${dim ? THEME.panelDim : THEME.panelBg} overflow-hidden ${className}`}>
    <header className={`flex items-center justify-between border-b ${THEME.border} px-3 py-1.5 ${dim ? THEME.panelHeadDim : THEME.panelHead} ${headerClass}`}>
      <h2 className={`font-bold uppercase tracking-[0.2em] text-[9px] ${dim ? 'text-[#5f7d68]' : 'text-[#66ff9f]/90'}`}>{title}</h2>
      {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
    </header>
    <div className="flex-1 overflow-hidden p-3 flex flex-col relative">
      {children}
    </div>
  </section>
)

// ============================================================================
// MEMOIZED SUB-COMPONENTS
// ============================================================================

/** Demo: yeni telemetry olayı üretim aralığı (SLA sayacı da buna göre azalır) */
const TELEMETRY_SIM_INTERVAL_MS = 18000
const CRITICAL_ALERT_GRACE_PERIOD_MS = 60000
const INITIAL_BACKGROUND_EVENT_COUNT = 1
const MALICIOUS_EVENT_PROBABILITY = 0.06
const CRITICAL_EVENT_PROBABILITY = 0.03
const CRITICAL_INCIDENT_COOLDOWN_MS = 180000
const TELEMETRY_EMISSION_PROBABILITY = 0.35

/** Live Telemetry Stream: ekranın geri kalanını sınırsız doldurmasın; içeride kaydır */
const TELEMETRY_PANEL_HEIGHT_CLASS = 'h-[min(74vh,840px)] md:h-[min(60vh,700px)] xl:h-[min(560px,48vh)]'
const GLOBE_TARGET_FPS = 24
const GLOBE_FRAME_MS = 1000 / GLOBE_TARGET_FPS


const REGION_LABELS: Record<string, string> = {
  'US-EAST': 'United States',
  'UK-LON': 'United Kingdom',
  'JP-TYO': 'Japan',
  'SG-SIN': 'Singapore',
  'BR-SAO': 'Brazil',
  'RU-MOW': 'Russia',
  'CN-PEK': 'China',
}

const REGION_SEVERITY_RANK: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
}

const REGION_HEAT_COLOR: Record<Severity, { glow: string; core: string }> = {
  CRITICAL: { glow: '#ff6b8b', core: '#ffe2ea' },
  HIGH: { glow: '#f6b73d', core: '#ffefcb' },
  MEDIUM: { glow: '#5fd9ff', core: '#dbf7ff' },
  LOW: { glow: '#3ba8ff', core: '#d8ecff' },
}


type MapIncident = { id: string; region: RegionKey; sev: Severity; source: string }
type SampledRoutePoint = { lat: number; lng: number; t: number }
type SampledRoute = {
  id: string
  points: SampledRoutePoint[]
  sev?: Severity
  focused?: boolean
  selected?: boolean
  liftRatio: number
}

type MapFocusSignal = {
  id: string
  sev: Severity
  region: RegionKey
  source: string
  sourceRegion: RegionKey
  node: string
  label: string
  protocol: Protocol
  port: number
  timestamp: string
  incidentId: string | null
  caseStatus: IncidentStatus | 'NO_CASE'
}

type WorldTopologyObject = {
  type: string
  geometries: unknown[]
}

type WorldTopology = {
  type: 'Topology'
  objects: {
    countries: WorldTopologyObject
    land: WorldTopologyObject
  }
  arcs: unknown[]
  bbox?: number[]
}

interface SimulationBootstrap {
  startedAt: number
  events: ThreatEvent[]
  incidents: Incident[]
}

const STATIC_WORLD_TOPOLOGY = worldTopologyData as unknown as WorldTopology

const cloneTimelineEntry = (entry: TimelineEntry): TimelineEntry => ({ ...entry })

const cloneIncident = (incident: Incident): Incident => ({
  ...incident,
  events: [...incident.events],
  timeline: incident.timeline.map(cloneTimelineEntry),
})

const createSimulationBootstrap = (): SimulationBootstrap => {
  const startedAt = Date.now()
  const t0 = new Date(startedAt - 18 * 60 * 1000).toISOString()
  const t1 = new Date(startedAt - 12 * 60 * 1000).toISOString()
  const t2 = new Date(startedAt - 6 * 60 * 1000).toISOString()

  const seedEventsRaw = [
    generateEvent([], [], true, { timestamp: t2, sev: 'HIGH', type: 'Large Data Exfil', source: '10.0.4.15', node: 'FIN-DB-01', region: 'US-EAST' }),
  ]
  const seedEvents = seedEventsRaw.filter((event): event is ThreatEvent => event !== null)

  const curatedBackgroundSeedRaw = [
    generateEvent([], seedEvents, true, { timestamp: t1, sev: 'MEDIUM', type: 'DNS Tunneling Activity', region: 'UK-LON' }),
    generateEvent([], seedEvents, false, { timestamp: t0, sev: 'LOW', type: 'Credential Stuffing Wave', region: 'JP-TYO' }),
  ]
  const curatedBackgroundSeed = curatedBackgroundSeedRaw.filter((event): event is ThreatEvent => event !== null)

  const backgroundEventsRaw = Array.from({ length: INITIAL_BACKGROUND_EVENT_COUNT }, (_, index) =>
    generateEvent([], [...seedEvents, ...curatedBackgroundSeed.slice(0, index)], false),
  )
  const backgroundEvents = backgroundEventsRaw.filter((event): event is ThreatEvent => event !== null)

  const initialIncident: Incident = {
    id: 'INC-9921',
    sev: 'HIGH',
    time: t2,
    label: 'Large Data Exfil',
    source: '10.0.4.15',
    node: 'FIN-DB-01',
    region: 'US-EAST',
    status: 'OPEN',
    sla: 862,
    events: seedEvents.map((event) => event.id),
    timeline: [
      { id: 't-1', time: t0, desc: 'Sensitive finance node entered elevated watch mode after suspicious identity activity', type: 'OBSERVED' },
      { id: 't-2', time: t1, desc: 'Outbound staging behavior correlated with prior access anomaly', type: 'CORRELATED' },
      { id: 't-3', time: t2, desc: 'Large outbound data movement confirmed', type: 'DETECTED' },
      { id: 't-4', time: t2, desc: 'Automatic incident elevated', type: 'ALERT_OPENED' },
    ],
  }

  return {
    startedAt,
    events: [...seedEvents, ...curatedBackgroundSeed, ...backgroundEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    incidents: [initialIncident],
  }
}

const INITIAL_SIMULATION_BOOTSTRAP = createSimulationBootstrap()

const LABEL_OFFSETS: Record<RegionKey, { dx: number; dy: number }> = {
  'US-EAST': { dx: 0, dy: 0 },
  'UK-LON': { dx: 0, dy: -4 },
  'JP-TYO': { dx: -4, dy: 14 },
  'SG-SIN': { dx: -2, dy: 20 },
  'BR-SAO': { dx: 0, dy: -2 },
  'RU-MOW': { dx: 0, dy: -10 },
  'CN-PEK': { dx: -3, dy: -12 },
}
const AMBIENT_ROUTE_EDGES: Array<[RegionKey, RegionKey]> = [
  ['US-EAST', 'UK-LON'],
  ['US-EAST', 'BR-SAO'],
  ['US-EAST', 'JP-TYO'],
  ['US-EAST', 'SG-SIN'],
  ['UK-LON', 'RU-MOW'],
  ['UK-LON', 'CN-PEK'],
  ['UK-LON', 'BR-SAO'],
  ['JP-TYO', 'CN-PEK'],
  ['JP-TYO', 'SG-SIN'],
  ['SG-SIN', 'CN-PEK'],
  ['RU-MOW', 'CN-PEK'],
  ['BR-SAO', 'SG-SIN'],
]

const deriveSourceRegion = (source: string, targetRegion: RegionKey): RegionKey => {
  const candidates = REGIONS.filter((region) => region !== targetRegion)
  const hash = source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return candidates[hash % candidates.length]
}

const buildGreatCircleSamples = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  steps: number,
): SampledRoutePoint[] => {
  const interpolate = geoInterpolate([from.lng, from.lat], [to.lng, to.lat])
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps
    const [lng, lat] = interpolate(t)
    return { lat, lng, t }
  })
}


const GlobalMapPanel = React.memo(({ mapIncidents, mapFilter, selectedSignal, onMapClick, onClearFocus }: {
  mapIncidents: MapIncident[]
  mapFilter: string | null
  selectedSignal: MapFocusSignal | null
  onMapClick: (r: string) => void
  onClearFocus: () => void
}) => {
  const fallbackIncidents: MapIncident[] = useMemo(() => ([
    { id: 'demo-1', sev: 'HIGH', region: 'US-EAST', source: 'RU-MOW' },
    { id: 'demo-2', sev: 'CRITICAL', region: 'CN-PEK', source: 'US-EAST' },
    { id: 'demo-3', sev: 'HIGH', region: 'RU-MOW', source: 'UK-LON' },
    { id: 'demo-4', sev: 'MEDIUM', region: 'BR-SAO', source: 'US-EAST' },
  ]), [])

  const incidentsForRender = useMemo(() => {
    if (mapIncidents.length > 0) return mapIncidents
    if (mapFilter) return []
    return fallbackIncidents
  }, [fallbackIncidents, mapFilter, mapIncidents])

  const regionStats = useMemo(() => {
    const next = new Map<RegionKey, { count: number; sev: Severity }>()
    for (const incident of incidentsForRender) {
      const existing = next.get(incident.region)
      if (!existing) {
        next.set(incident.region, { count: 1, sev: incident.sev })
        continue
      }
      next.set(incident.region, {
        count: existing.count + 1,
        sev: REGION_SEVERITY_RANK[incident.sev] > REGION_SEVERITY_RANK[existing.sev] ? incident.sev : existing.sev,
      })
    }
    return next
  }, [incidentsForRender])

  const severityMix = useMemo(() => {
    const base: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    incidentsForRender.forEach((incident) => {
      base[incident.sev] += 1
    })
    return base
  }, [incidentsForRender])

  const totalIncidents = incidentsForRender.length

  const focusSignal = useMemo<MapFocusSignal | null>(() => {
    if (!selectedSignal) return null
    if (mapFilter && selectedSignal.region !== mapFilter) return null
    return selectedSignal
  }, [mapFilter, selectedSignal])

  const focusRegion = useMemo<RegionKey | null>(() => {
    if (mapFilter && (REGIONS as readonly string[]).includes(mapFilter)) return mapFilter as RegionKey
    if (focusSignal) return focusSignal.region
    return null
  }, [focusSignal, mapFilter])

  const focusRegionStats = useMemo(() => {
    if (!focusRegion) return null
    return regionStats.get(focusRegion) ?? { count: 0, sev: 'LOW' as Severity }
  }, [focusRegion, regionStats])

  const focusIncidentSet = useMemo(() => {
    if (!focusRegion) return incidentsForRender
    return incidentsForRender.filter((incident) => incident.region === focusRegion)
  }, [focusRegion, incidentsForRender])

  const focusCriticalCount = useMemo(
    () => focusIncidentSet.filter((incident) => incident.sev === 'CRITICAL').length,
    [focusIncidentSet],
  )

  const focusSeverityMix = useMemo(() => {
    const base: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    focusIncidentSet.forEach((incident) => {
      base[incident.sev] += 1
    })
    return base
  }, [focusIncidentSet])

  const focusActivityRatio = useMemo(() => {
    if (!focusRegion) return 100
    if (focusIncidentSet.length === 0 || totalIncidents === 0) return 0
    return Math.round((focusIncidentSet.length / totalIncidents) * 100)
  }, [focusIncidentSet.length, focusRegion, totalIncidents])

  const legendSeverityMix = useMemo(
    () => (focusRegion ? focusSeverityMix : severityMix),
    [focusRegion, focusSeverityMix, severityMix],
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [globeSize, setGlobeSize] = useState({ width: 960, height: 520 })
  const [globeAngles, setGlobeAngles] = useState({ lon: 22, lat: -10 })
  const targetAnglesRef = useRef({ lon: 22, lat: -10 })
  const spinOffsetRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number | null>(null)
  const frameBudgetRef = useRef(0)

  const normalizeDegrees = useCallback((angle: number) => {
    let next = angle
    while (next > 180) next -= 360
    while (next < -180) next += 360
    return next
  }, [])

  const shortestDegreeDelta = useCallback((from: number, to: number) => {
    return normalizeDegrees(to - from)
  }, [normalizeDegrees])

  const regionCoords = useMemo(
    () =>
      MOCK_MAP_POINTS.reduce((acc, point) => {
        acc[point.region as RegionKey] = { lat: point.lat, lng: point.lng }
        return acc
      }, {} as Record<RegionKey, { lat: number; lng: number }>),
    [],
  )

  const worldTopology = STATIC_WORLD_TOPOLOGY
  const landFeature = useMemo(() => {
    const topo = worldTopology as unknown as Parameters<typeof topoFeature>[0]
    const landObject = worldTopology.objects.land as unknown as Parameters<typeof topoFeature>[1]
    return topoFeature(topo, landObject) as GeoPermissibleObjects
  }, [worldTopology])

  const borderMesh = useMemo(() => {
    const topo = worldTopology as unknown as Parameters<typeof topoMesh>[0]
    const countriesObject = worldTopology.objects.countries as unknown as Parameters<typeof topoMesh>[1]
    return topoMesh(topo, countriesObject) as GeoPermissibleObjects
  }, [worldTopology])

  const globeGeometry = useMemo(() => {
    const width = globeSize.width
    const height = globeSize.height
    const radius = Math.min(width * 0.23, height * 0.4)
    const cx = width * 0.5
    const cy = height * 0.52
    return { width, height, radius, cx, cy }
  }, [globeSize.height, globeSize.width])

  const projection = useMemo<GeoProjection>(() => {
    return geoOrthographic()
      .translate([globeGeometry.cx, globeGeometry.cy])
      .scale(globeGeometry.radius)
      .rotate([globeAngles.lon, globeAngles.lat])
      .clipAngle(90)
      .precision(0.6)
  }, [globeAngles.lat, globeAngles.lon, globeGeometry.cx, globeGeometry.cy, globeGeometry.radius])

  const pathBuilder = useMemo(() => geoPath(projection), [projection])
  const landPath = useMemo(() => pathBuilder(landFeature), [landFeature, pathBuilder])
  const borderPath = useMemo(() => pathBuilder(borderMesh), [borderMesh, pathBuilder])
  const graticulePath = useMemo(() => pathBuilder(geoGraticule10()), [pathBuilder])

  const visibleCenter = useMemo<[number, number]>(() => [-globeAngles.lon, -globeAngles.lat], [globeAngles.lat, globeAngles.lon])

  const isVisibleOnGlobe = useCallback((lat: number, lng: number) => {
    return geoDistance([lng, lat], visibleCenter) <= Math.PI / 2
  }, [visibleCenter])

  const projectPoint = useCallback((lat: number, lng: number) => {
    const point = projection([lng, lat])
    if (!point) return null
    return { x: point[0], y: point[1] }
  }, [projection])

  const nodeData = useMemo(() => {
    return MOCK_MAP_POINTS.map((point) => {
      const region = point.region as RegionKey
      const stats = regionStats.get(region)
      const count = stats?.count ?? 0
      const sev = stats?.sev ?? 'LOW'
      const projected = projectPoint(point.lat, point.lng)
      const visible = isVisibleOnGlobe(point.lat, point.lng)
      return {
        ...point,
        region,
        count,
        sev,
        focused: Boolean(focusRegion && region === focusRegion),
        selectedTarget: Boolean(focusSignal && region === focusSignal.region),
        selectedSource: Boolean(focusSignal && region === focusSignal.sourceRegion),
        x: projected?.x ?? -999,
        y: projected?.y ?? -999,
        visible,
      }
    })
  }, [focusRegion, focusSignal, isVisibleOnGlobe, projectPoint, regionStats])

  const projectSampledRoute = useCallback((route: SampledRoute) => {
    const baseLift = globeGeometry.radius * route.liftRatio
    const segments: string[] = []
    let currentSegment: { x: number; y: number }[] = []

    const flushSegment = () => {
      if (currentSegment.length < 2) {
        currentSegment = []
        return
      }

      const path = currentSegment.reduce((acc, point, index) => {
        const prefix = index === 0 ? 'M' : 'L'
        return `${acc}${index === 0 ? '' : ' '}${prefix} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
      }, '')

      segments.push(path)
      currentSegment = []
    }

    route.points.forEach((point) => {
      if (!isVisibleOnGlobe(point.lat, point.lng)) {
        flushSegment()
        return
      }

      const projected = projectPoint(point.lat, point.lng)
      if (!projected) {
        flushSegment()
        return
      }

      const radialX = projected.x - globeGeometry.cx
      const radialY = projected.y - globeGeometry.cy
      const radialLength = Math.hypot(radialX, radialY) || 1
      const orbitalLift = Math.pow(Math.sin(Math.PI * point.t), 1.35) * baseLift

      currentSegment.push({
        x: projected.x + (radialX / radialLength) * orbitalLift,
        y: projected.y + (radialY / radialLength) * orbitalLift,
      })
    })

    flushSegment()
    return segments
  }, [globeGeometry.cx, globeGeometry.cy, globeGeometry.radius, isVisibleOnGlobe, projectPoint])

  const sampledActiveRoutes = useMemo<SampledRoute[]>(
    () =>
      incidentsForRender.slice(0, 10).flatMap((incident, index) => {
        const target = regionCoords[incident.region]
        if (!target) return []
        const sourceRegion = deriveSourceRegion(incident.source, incident.region)
        const source = regionCoords[sourceRegion]
        if (!source) return []

        const angularDistance = geoDistance([source.lng, source.lat], [target.lng, target.lat])
        const steps = Math.max(36, Math.ceil(angularDistance * 30))

        return [{
          id: `${incident.id}-${index}`,
          points: buildGreatCircleSamples(source, target, steps),
          sev: incident.sev,
          focused: Boolean(focusRegion && incident.region === focusRegion),
          liftRatio: incident.sev === 'CRITICAL' ? 0.055 : incident.sev === 'HIGH' ? 0.045 : 0.034,
        }]
      }),
    [focusRegion, incidentsForRender, regionCoords],
  )

  const selectedSignalRoute = useMemo<SampledRoute | null>(() => {
    if (!focusSignal) return null
    const source = regionCoords[focusSignal.sourceRegion]
    const target = regionCoords[focusSignal.region]
    if (!source || !target) return null

    const angularDistance = geoDistance([source.lng, source.lat], [target.lng, target.lat])
    const steps = Math.max(46, Math.ceil(angularDistance * 36))

    return {
      id: `selected-${focusSignal.id}`,
      points: buildGreatCircleSamples(source, target, steps),
      sev: focusSignal.sev,
      focused: true,
      selected: true,
      liftRatio: focusSignal.sev === 'CRITICAL' ? 0.072 : focusSignal.sev === 'HIGH' ? 0.062 : 0.05,
    }
  }, [focusSignal, regionCoords])

  const activeArcs = useMemo(
    () =>
      sampledActiveRoutes.flatMap((route) => {
        const paths = projectSampledRoute(route)
        if (!paths.length || !route.sev) return []
        return paths.map((path, segmentIndex) => ({
          id: `${route.id}-${segmentIndex}`,
          d: path,
          sev: route.sev,
          focused: route.focused ?? false,
          selected: route.selected ?? false,
        }))
      }),
    [projectSampledRoute, sampledActiveRoutes],
  )

  const selectedArcs = useMemo(
    () =>
      selectedSignalRoute
        ? projectSampledRoute(selectedSignalRoute).map((path, segmentIndex) => ({
            id: `${selectedSignalRoute.id}-${segmentIndex}`,
            d: path,
            sev: selectedSignalRoute.sev ?? 'MEDIUM',
          }))
        : [],
    [projectSampledRoute, selectedSignalRoute],
  )

  const sampledAmbientRoutes = useMemo<SampledRoute[]>(
    () =>
      AMBIENT_ROUTE_EDGES.flatMap(([from, to], index) => {
        const source = regionCoords[from]
        const target = regionCoords[to]
        if (!source || !target) return []

        const angularDistance = geoDistance([source.lng, source.lat], [target.lng, target.lat])
        const steps = Math.max(28, Math.ceil(angularDistance * 24))

        return [{
          id: `ambient-${index}`,
          points: buildGreatCircleSamples(source, target, steps),
          liftRatio: 0.02,
        }]
      }),
    [regionCoords],
  )

  const ambientArcs = useMemo(
    () =>
      sampledAmbientRoutes.flatMap((route) => {
        const paths = projectSampledRoute(route)
        if (!paths.length) return []
        return paths.map((path, segmentIndex) => ({
          id: `${route.id}-${segmentIndex}`,
          d: path,
        }))
      }),
    [projectSampledRoute, sampledAmbientRoutes],
  )

  const visibleNodes = useMemo(
    () => nodeData.filter((node) => node.visible || node.focused),
    [nodeData],
  )

  const focusNode = useMemo(
    () => visibleNodes.find((node) => node.region === focusRegion || node.selectedTarget) ?? null,
    [focusRegion, visibleNodes],
  )

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const width = Math.max(320, Math.round(entry.contentRect.width))
      const height = Math.max(280, Math.round(entry.contentRect.height))
      setGlobeSize((current) => (current.width === width && current.height === height ? current : { width, height }))
    })
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!focusRegion && !focusSignal) {
      targetAnglesRef.current = { lon: 22, lat: -10 }
      return
    }
    const targetRegion = focusSignal?.region ?? focusRegion
    if (!targetRegion) return
    const coords = regionCoords[targetRegion]
    if (!coords) return
    targetAnglesRef.current = {
      lon: normalizeDegrees(-coords.lng),
      lat: Math.max(-22, Math.min(22, -coords.lat * 0.35)),
    }
  }, [focusRegion, focusSignal, normalizeDegrees, regionCoords])

  useEffect(() => {
    lastFrameRef.current = null
    frameBudgetRef.current = 0

    const animate = (timestamp: number) => {
      const previousTimestamp = lastFrameRef.current ?? timestamp
      const delta = Math.min(48, timestamp - previousTimestamp)
      lastFrameRef.current = timestamp
      frameBudgetRef.current += delta

      if (frameBudgetRef.current < GLOBE_FRAME_MS) {
        animationFrameRef.current = window.requestAnimationFrame(animate)
        return
      }

      const renderDelta = frameBudgetRef.current
      frameBudgetRef.current = 0

      const spinVelocity = focusSignal ? -0.01 : focusRegion ? -0.012 : -0.018
      spinOffsetRef.current = normalizeDegrees(spinOffsetRef.current + spinVelocity * renderDelta)

      startTransition(() => {
        setGlobeAngles((current) => {
          const target = targetAnglesRef.current
          const driftedTargetLon = normalizeDegrees(target.lon + spinOffsetRef.current)
          const lonBlend = 1 - Math.pow(focusSignal ? 0.76 : focusRegion ? 0.78 : 0.86, renderDelta / 16.67)
          const latBlend = 1 - Math.pow(0.84, renderDelta / 16.67)

          return {
            lon: normalizeDegrees(current.lon + shortestDegreeDelta(current.lon, driftedTargetLon) * lonBlend),
            lat: current.lat + (target.lat - current.lat) * latBlend,
          }
        })
      })

      animationFrameRef.current = window.requestAnimationFrame(animate)
    }

    animationFrameRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
      lastFrameRef.current = null
      frameBudgetRef.current = 0
    }
  }, [focusRegion, focusSignal, normalizeDegrees, shortestDegreeDelta])

  return (
    <section className="flex-none h-[clamp(280px,42vh,620px)] sm:h-[clamp(320px,48vh,620px)] xl:h-[clamp(320px,52vh,620px)] border border-[#1a2e1a] bg-transparent overflow-hidden shadow-2xl">
      <div ref={containerRef} className="relative h-full overflow-hidden bg-[#03110d]">
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-2 bg-gradient-to-b from-[#091409]/96 to-transparent border-b border-[#1c3a22]/55 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e640] shadow-[0_0_7px_rgba(0,230,64,0.85)]" />
          <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-slate-200">Global Threat Map</span>
          <span className="ml-auto text-[8px] font-mono text-[#7effb2]/85">TOTAL INCIDENTS {totalIncidents}</span>
        </div>

        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(24,132,90,0.2),rgba(3,8,8,0.96)_55%,rgba(1,3,3,1))]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,22,14,0.2),rgba(2,9,8,0.88))]" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(80,255,176,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(80,255,176,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="absolute inset-x-[-8%] top-[-12%] h-[78%] rounded-full bg-[radial-gradient(circle,rgba(57,255,193,0.14),rgba(57,255,193,0)_68%)] blur-3xl" />
          <div className="absolute left-[14%] top-[18%] h-[64%] w-[56%] rounded-full border border-[#54f8b02f] orbital-ring orbital-ring-a" />
          <div className="absolute left-[16%] top-[25%] h-[50%] w-[52%] rounded-full border border-[#1bd8ff1f] orbital-ring orbital-ring-b" />
          <div className="absolute left-[5%] top-[51%] h-[1px] w-[90%] bg-gradient-to-r from-transparent via-[#8cffd84f] to-transparent opacity-55 scanline-slow" />
          <div className="absolute inset-0 opacity-55 map-starfield" />
        </div>

        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${globeGeometry.width} ${globeGeometry.height}`} preserveAspectRatio="xMidYMid meet" aria-label="3D threat globe">
          <defs>
            <radialGradient id="globeOceanGradient" cx="34%" cy="22%" r="86%">
              <stop offset="0%" stopColor="#8dffea" stopOpacity="0.9" />
              <stop offset="18%" stopColor="#4dd7b8" stopOpacity="0.76" />
              <stop offset="42%" stopColor="#137762" stopOpacity="0.94" />
              <stop offset="72%" stopColor="#08261e" stopOpacity="1" />
              <stop offset="100%" stopColor="#030d0a" stopOpacity="1" />
            </radialGradient>
            <radialGradient id="globeHighlightGradient" cx="28%" cy="18%" r="56%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="34%" stopColor="#d7fff4" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="globeShadowGradient" cx="72%" cy="68%" r="62%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
            </radialGradient>
            <radialGradient id="globeLandGradient" cx="38%" cy="26%" r="78%">
              <stop offset="0%" stopColor="#f4fffb" stopOpacity="0.98" />
              <stop offset="16%" stopColor="#a8ffe2" stopOpacity="0.94" />
              <stop offset="48%" stopColor="#3fd3aa" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#0d5f49" stopOpacity="0.82" />
            </radialGradient>
            <radialGradient id="globeLandGlow" cx="42%" cy="28%" r="74%">
              <stop offset="0%" stopColor="#c9fff2" stopOpacity="0.34" />
              <stop offset="50%" stopColor="#5fffd0" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#5fffd0" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="globeLandSpecGradient" cx="28%" cy="18%" r="58%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
              <stop offset="20%" stopColor="#dffff6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <filter id="globeAtmosphereBlur" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
            <filter id="landGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
            <clipPath id="globeClip">
              <circle cx={globeGeometry.cx} cy={globeGeometry.cy} r={globeGeometry.radius} />
            </clipPath>
          </defs>

          <circle cx={globeGeometry.cx} cy={globeGeometry.cy} r={globeGeometry.radius + 22} fill="#2bffbe18" filter="url(#globeAtmosphereBlur)" />
          <circle cx={globeGeometry.cx} cy={globeGeometry.cy} r={globeGeometry.radius + 12} fill="#76ffdb12" filter="url(#globeAtmosphereBlur)" />
          <circle cx={globeGeometry.cx} cy={globeGeometry.cy} r={globeGeometry.radius + 6} fill="none" stroke="#7effd0aa" strokeWidth="1.2" opacity="0.46" />
          <circle cx={globeGeometry.cx} cy={globeGeometry.cy} r={globeGeometry.radius} fill="url(#globeOceanGradient)" stroke="#a8ffe866" strokeWidth="1.1" />

          <g clipPath="url(#globeClip)">
            <rect x={globeGeometry.cx - globeGeometry.radius} y={globeGeometry.cy - globeGeometry.radius} width={globeGeometry.radius * 2} height={globeGeometry.radius * 2} fill="#03110d" />
            {graticulePath && <path d={graticulePath} fill="none" stroke="#8cf7df" strokeOpacity="0.12" strokeWidth="0.6" />}
            {landPath && <path d={landPath} fill="url(#globeLandGlow)" opacity="0.9" filter="url(#landGlow)" />}
            {landPath && <path d={landPath} fill="url(#globeLandGradient)" fillOpacity="0.88" stroke="#ecfff7" strokeOpacity="0.4" strokeWidth="0.72" />}
            {landPath && <path d={landPath} fill="url(#globeLandSpecGradient)" fillOpacity="0.72" />}
            {borderPath && <path d={borderPath} fill="none" stroke="#dffff4" strokeOpacity="0.16" strokeWidth="0.34" />}
            {landPath && <path d={landPath} fill="none" stroke="#f7fffb" strokeOpacity="0.2" strokeWidth="1.15" />}
            <circle cx={globeGeometry.cx} cy={globeGeometry.cy} r={globeGeometry.radius} fill="url(#globeHighlightGradient)" />
            <circle cx={globeGeometry.cx} cy={globeGeometry.cy} r={globeGeometry.radius} fill="url(#globeShadowGradient)" />

            {ambientArcs.map((route, index) => (
              <path
                key={route.id}
                d={route.d}
                fill="none"
                stroke="#6bffd5"
                strokeOpacity={focusRegion ? 0.05 : 0.14}
                strokeWidth="0.95"
                strokeDasharray="6 18"
                strokeLinecap="round"
              />
            ))}

            {activeArcs.map((route, index) => {
              const routeColor = route.sev === 'CRITICAL' ? '#ff7d9f' : route.sev === 'HIGH' ? '#ffc252' : route.sev === 'MEDIUM' ? '#54ffd4' : '#b7fff1'
              const routeGlow = route.sev === 'CRITICAL' ? '#ff4c7f' : route.sev === 'HIGH' ? '#ffb235' : '#00ffb7'
              return (
                <g key={route.id}>
                  <path
                    d={route.d}
                    fill="none"
                    stroke={routeGlow}
                    strokeOpacity={route.selected ? 0.5 : route.focused ? 0.28 : 0.14}
                    strokeWidth={route.selected ? (route.sev === 'CRITICAL' ? 6.2 : 5.1) : route.sev === 'CRITICAL' ? 4.4 : 3.1}
                    strokeLinecap="round"
                    filter="url(#globeAtmosphereBlur)"
                  />
                  <path
                    d={route.d}
                    fill="none"
                    stroke={routeColor}
                    strokeOpacity={route.selected ? 1 : focusRegion ? (route.focused ? 0.94 : 0.22) : 0.7}
                    strokeWidth={route.selected ? (route.sev === 'CRITICAL' ? 2.9 : 2.2) : route.sev === 'CRITICAL' ? 2.1 : 1.45}
                    strokeDasharray={route.selected ? undefined : route.sev === 'CRITICAL' ? '14 18' : '10 16'}
                    strokeLinecap="round"
                  />
                </g>
              )
            })}

            {selectedArcs.map((route, index) => {
              const routeColor = route.sev === 'CRITICAL' ? '#ffd5e0' : route.sev === 'HIGH' ? '#ffe5a8' : '#d7fff5'
              const routeGlow = route.sev === 'CRITICAL' ? '#ff5d8d' : route.sev === 'HIGH' ? '#ffc657' : '#6dffdb'
              return (
                <g key={route.id}>
                  <path
                    d={route.d}
                    fill="none"
                    stroke={routeGlow}
                    strokeOpacity={0.55}
                    strokeWidth={route.sev === 'CRITICAL' ? 7.6 : 6}
                    strokeLinecap="round"
                    filter="url(#globeAtmosphereBlur)"
                  />
                  <path
                    d={route.d}
                    fill="none"
                    stroke={routeColor}
                    strokeOpacity={0.98}
                    strokeWidth={route.sev === 'CRITICAL' ? 3.2 : 2.6}
                    strokeLinecap="round"
                  />
                </g>
              )
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 z-10">
          {visibleNodes.map((node, index) => {
            const labelOffset = LABEL_OFFSETS[node.region]
            const isFocusLabel = Boolean((focusRegion && node.region === focusRegion) || node.selectedTarget)
            const isSourceLabel = Boolean(node.selectedSource)
            const isHot = node.count > 0 || node.selectedTarget || node.selectedSource
            const tone = REGION_HEAT_COLOR[node.sev]
            const left = `${(node.x / globeGeometry.width) * 100}%`
            const top = `${(node.y / globeGeometry.height) * 100}%`
            return (
              <button
                key={node.region}
                type="button"
                onClick={() => onMapClick(node.region)}
                className="pointer-events-auto absolute group"
                style={{
                  left,
                  top,
                  transform: `translate(-50%, -50%) translate(${labelOffset.dx}px, ${labelOffset.dy}px)`,
                }}
              >
                <span
                  className={`absolute left-1/2 top-1/2 rounded-full ${isHot ? 'map-node-pulse' : ''} ${node.selectedTarget ? 'map-node-selected' : ''}`}
                  style={{
                    width: isFocusLabel ? 42 : isSourceLabel ? 32 : isHot ? 26 : 16,
                    height: isFocusLabel ? 42 : isSourceLabel ? 32 : isHot ? 26 : 16,
                    background: `radial-gradient(circle, ${(node.selectedTarget || isSourceLabel) ? '#e8fff7aa' : `${tone.glow}66`} 0%, ${tone.glow}18 58%, transparent 72%)`,
                    transform: 'translate(-50%, -50%)',
                    opacity: isFocusLabel ? 0.92 : isSourceLabel ? 0.82 : isHot ? 0.72 : 0.4,
                    animationDelay: `${index * 0.18}s`,
                  }}
                />
                <span
                  className="absolute left-1/2 top-1/2 rounded-full border border-[#dffff2] shadow-[0_0_18px_rgba(34,255,176,0.24)]"
                  style={{
                    width: isFocusLabel ? 12 : isSourceLabel ? 10 : isHot ? 9 : 7,
                    height: isFocusLabel ? 12 : isSourceLabel ? 10 : isHot ? 9 : 7,
                    backgroundColor: node.selectedTarget ? '#f8fff9' : isSourceLabel ? '#ffe0bf' : isHot ? tone.core : '#d7f7e9',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                <span
                  className={`absolute text-[9px] font-bold uppercase tracking-[0.24em] ${isFocusLabel ? 'text-[#f4fff8]' : isSourceLabel ? 'text-[#ffe2bf]' : 'text-[#b6ffe0]'} drop-shadow-[0_0_12px_rgba(6,14,11,0.95)] transition-opacity duration-300`}
                  style={{
                    left: isFocusLabel ? 18 : 14,
                    top: -7,
                    opacity: focusRegion ? (isFocusLabel || isSourceLabel ? 1 : 0.45) : 0.94,
                    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
                  }}
                >
                  {REGION_LABELS[node.region] ?? node.region}
                </span>
              </button>
            )
          })}
        </div>

        {focusRegion && (
          <div className="absolute right-2 top-12 z-20 w-[min(210px,calc(100%-16px))] rounded-xl border border-[#2d5e42] bg-[linear-gradient(180deg,rgba(6,24,18,0.94),rgba(3,12,10,0.92))] p-3 shadow-[0_0_36px_rgba(24,255,159,0.12)] backdrop-blur-md sm:right-3 sm:top-14 sm:w-[min(240px,calc(100%-24px))] md:right-4 md:top-16 md:w-[min(260px,calc(100%-32px))]">
            <div className="mb-2 flex items-start justify-between border-b border-[#214634] pb-2">
              <div className="min-w-0">
                <p className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#97ffd1]">Threat Focus</p>
                <p className="truncate pt-1 text-sm font-semibold text-slate-100">{REGION_LABELS[focusRegion] ?? focusRegion}</p>
              </div>
              <span
                className="rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.22em]"
                style={{
                  color: focusRegionStats ? REGION_HEAT_COLOR[focusRegionStats.sev].core : '#ddfff1',
                  borderColor: focusRegionStats ? `${REGION_HEAT_COLOR[focusRegionStats.sev].glow}88` : '#2f6046',
                  backgroundColor: focusRegionStats ? `${REGION_HEAT_COLOR[focusRegionStats.sev].glow}18` : '#0a1813',
                }}
              >
                {focusRegionStats?.sev ?? 'LOW'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="rounded-lg border border-[#224531] bg-[#071511]/85 px-2 py-2">
                <p className="uppercase text-slate-500">Incidents</p>
                <p className="pt-1 text-lg font-semibold text-[#a7ffd1]">{focusIncidentSet.length}</p>
              </div>
              <div className="rounded-lg border border-[#224531] bg-[#071511]/85 px-2 py-2">
                <p className="uppercase text-slate-500">Critical</p>
                <p className="pt-1 text-lg font-semibold text-rose-300">{focusCriticalCount}</p>
              </div>
              <div className="rounded-lg border border-[#224531] bg-[#071511]/85 px-2 py-2">
                <p className="uppercase text-slate-500">Coverage</p>
                <p className="pt-1 text-lg font-semibold text-[#98ffe0]">{focusActivityRatio}%</p>
              </div>
              <div className="rounded-lg border border-[#224531] bg-[#071511]/85 px-2 py-2">
                <p className="uppercase text-slate-500">Marker</p>
                <p className="pt-1 text-lg font-semibold text-[#dfffee]">{focusNode ? 'LOCK' : 'SCAN'}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-[9px] font-mono">
              {focusSignal && (
                <div className="rounded-lg border border-[#224531] bg-[#071511]/85 px-2 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[7px] font-bold uppercase tracking-[0.22em] text-[#8eb99a]">Selected Signal</p>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.2em]"
                      style={{
                        color: REGION_HEAT_COLOR[focusSignal.sev].core,
                        borderColor: `${REGION_HEAT_COLOR[focusSignal.sev].glow}88`,
                        backgroundColor: `${REGION_HEAT_COLOR[focusSignal.sev].glow}18`,
                      }}
                    >
                      {focusSignal.caseStatus === 'NO_CASE' ? 'NO CASE' : focusSignal.caseStatus}
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-200">
                    <div className="font-semibold text-[#effff8]">{focusSignal.label}</div>
                    <div className="mt-1 text-slate-400">{formatTime(focusSignal.timestamp)} | {focusSignal.protocol}/{focusSignal.port}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-slate-300">
                    <div className="rounded-md border border-[#1b3428] bg-[#08120e] px-2 py-1.5">
                      <div className="uppercase tracking-[0.2em] text-[#62806f]">Source</div>
                      <div className="mt-1 font-mono text-[#b9ffd4]">{focusSignal.source}</div>
                    </div>
                    <div className="rounded-md border border-[#1b3428] bg-[#08120e] px-2 py-1.5">
                      <div className="uppercase tracking-[0.2em] text-[#62806f]">Node</div>
                      <div className="mt-1 font-mono text-slate-200">{focusSignal.node}</div>
                    </div>
                  </div>
                </div>
              )}
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((sev) => {
                const count = focusSeverityMix[sev]
                const ratio = focusIncidentSet.length > 0 ? Math.round((count / focusIncidentSet.length) * 100) : 0
                const barColor = sev === 'CRITICAL' ? '#f43f5e' : sev === 'HIGH' ? '#f59e0b' : sev === 'MEDIUM' ? '#22c55e' : '#86efac'
                return (
                  <div key={sev}>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="tracking-widest">{sev}</span>
                      <span className="tabular-nums text-slate-500">{count}</span>
                    </div>
                    <div className="mt-1 h-[4px] overflow-hidden rounded-full border border-[#173124] bg-[#04100b]">
                      <div className="h-full rounded-full" style={{ width: `${count > 0 ? Math.max(8, ratio) : 0}%`, backgroundColor: barColor }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              onClick={onClearFocus}
              className="mt-3 w-full rounded-lg border border-[#2e6a4a] bg-[#0b2017] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.24em] text-[#a8ffd4] transition-colors duration-200 hover:bg-[#103022]"
            >
              Focus Temizle
            </button>
          </div>
        )}

        <div className="absolute bottom-2 left-2 z-20 flex max-w-[calc(100%-16px)] flex-wrap items-center gap-1.5 rounded-full border border-[#204028] bg-[#08130b]/92 px-2.5 py-1.5 text-[8px] font-mono shadow-[0_0_18px_rgba(36,255,170,0.08)] sm:bottom-3 sm:left-3 sm:max-w-[calc(100%-24px)] sm:gap-2 sm:px-3">
          <span className="rounded-full border border-[#2a4b31] bg-[#09190d] px-2 py-0.5 text-[#9dc5a9]">
            {focusRegion ? 'FOCUS MIX' : 'GLOBAL MIX'}
          </span>
          <span className="text-rose-300">CRIT {legendSeverityMix.CRITICAL}</span>
          <span className="text-amber-300">HIGH {legendSeverityMix.HIGH}</span>
          <span className="text-emerald-300">MED {legendSeverityMix.MEDIUM}</span>
          <span className="text-green-300">LOW {legendSeverityMix.LOW}</span>
        </div>

        <style jsx>{`
          .map-starfield {
            background-image:
              radial-gradient(circle at 12% 26%, rgba(137, 255, 218, 0.7) 0 1px, transparent 1.2px),
              radial-gradient(circle at 64% 18%, rgba(77, 255, 188, 0.52) 0 1px, transparent 1.4px),
              radial-gradient(circle at 78% 62%, rgba(133, 255, 233, 0.48) 0 1px, transparent 1.2px),
              radial-gradient(circle at 28% 70%, rgba(68, 255, 181, 0.4) 0 1px, transparent 1.2px),
              radial-gradient(circle at 90% 28%, rgba(132, 247, 255, 0.38) 0 1px, transparent 1.2px);
            animation: starfield-drift 22s linear infinite;
          }

          .orbital-ring {
            box-shadow: inset 0 0 0 1px rgba(73, 255, 179, 0.04), 0 0 40px rgba(45, 255, 173, 0.05);
          }

          .orbital-ring-a {
            animation: orbit-ring-spin 18s linear infinite;
          }

          .orbital-ring-b {
            animation: orbit-ring-spin-reverse 24s linear infinite;
          }

          .scanline-slow {
            animation: scanline-slow 8s ease-in-out infinite;
          }

          .map-node-pulse {
            animation: map-node-pulse 3.4s ease-in-out infinite;
          }

          @keyframes orbit-ring-spin {
            from { transform: rotate(0deg); opacity: 0.34; }
            50% { opacity: 0.58; }
            to { transform: rotate(360deg); opacity: 0.34; }
          }

          @keyframes orbit-ring-spin-reverse {
            from { transform: rotate(360deg) scale(1.02); opacity: 0.22; }
            50% { opacity: 0.4; }
            to { transform: rotate(0deg) scale(1.02); opacity: 0.22; }
          }

          @keyframes starfield-drift {
            from { transform: translate3d(0, 0, 0) scale(1); }
            50% { transform: translate3d(-1.5%, 1.2%, 0) scale(1.015); }
            to { transform: translate3d(0, 0, 0) scale(1); }
          }

          @keyframes scanline-slow {
            0%, 100% { opacity: 0.16; transform: translateY(-8px); }
            50% { opacity: 0.42; transform: translateY(10px); }
          }

          @keyframes map-node-pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(0.82); opacity: 0.22; }
            50% { transform: translate(-50%, -50%) scale(1.08); opacity: 0.72; }
          }

        `}</style>
      </div>
    </section>
  )
})

GlobalMapPanel.displayName = 'GlobalMapPanel'






const TriageQueuePanel = React.memo(({ visibleIncidents, activeIncidentId, mapFilter, onIncidentSelect, onIncidentReportOpen }: { visibleIncidents: Incident[], activeIncidentId: string | null, mapFilter: string | null, onIncidentSelect: (id: string) => void, onIncidentReportOpen: (incident: Incident) => void }) => (
  <Frame title={`Triage Queue ${mapFilter ? `[${mapFilter}]` : ''}`} className="flex-1 min-h-0 border-[#1a2e1a]">
    <div className="flex flex-col gap-2 overflow-auto custom-scrollbar -m-3 p-3">
      {visibleIncidents.map((inc) => {
        const isActive = activeIncidentId === inc.id
        const destination = REGION_LABELS[inc.region] ?? inc.region
        const threatTag = inc.sev === 'CRITICAL' ? 'Web Threat' : inc.sev === 'HIGH' ? 'Intrusion' : inc.sev === 'MEDIUM' ? 'Recon' : 'Signal'
        const levelText = inc.sev === 'CRITICAL' || inc.sev === 'HIGH' ? 'High' : 'Low'
        const tone = inc.sev === 'CRITICAL'
          ? {
              border: 'border-rose-500/60',
              glow: 'shadow-[0_0_14px_rgba(244,63,94,0.16)]',
              iconBg: 'bg-rose-500/15',
              iconText: 'text-rose-300',
              arrow: 'text-rose-300',
              badgeBg: 'bg-rose-500',
              badgeText: 'text-white',
              title: 'text-rose-100',
              source: 'text-rose-300',
            }
          : inc.sev === 'HIGH'
            ? {
                border: 'border-amber-500/55',
                glow: 'shadow-[0_0_14px_rgba(245,158,11,0.14)]',
                iconBg: 'bg-amber-500/16',
                iconText: 'text-amber-200',
                arrow: 'text-amber-300',
                badgeBg: 'bg-amber-500',
                badgeText: 'text-white',
                title: 'text-slate-100',
                source: 'text-amber-200',
              }
            : {
                border: 'border-emerald-500/55',
                glow: 'shadow-[0_0_14px_rgba(16,185,129,0.14)]',
                iconBg: 'bg-emerald-500/16',
                iconText: 'text-emerald-200',
                arrow: 'text-emerald-300',
                badgeBg: 'bg-emerald-500',
                badgeText: 'text-[#041008]',
                title: 'text-slate-100',
                source: 'text-emerald-200',
              }

        return (
          <button
            key={inc.id}
            onClick={() => {
              onIncidentSelect(inc.id)
              onIncidentReportOpen(inc)
            }}
            className={`group relative overflow-hidden rounded border bg-[#08150c] text-left transition-colors cursor-crosshair hover:bg-[#0d2013] ${
              isActive ? `${tone.border} ${tone.glow}` : 'border-[#214029]'
            }`}
          >
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-white/0 via-white/[0.03] to-white/0" />
            <div className="relative p-2.5">
              <div className="mb-2 flex items-start justify-between">
                <span className="text-[8px] font-mono tracking-wider text-[#8bad95]">{formatDateTime(inc.time)}</span>
                <span
                  className={`px-2 py-[2px] text-[8px] font-mono font-bold uppercase tracking-wide ${tone.badgeText} ${tone.badgeBg}`}
                  style={{ clipPath: 'polygon(8% 0, 100% 0, 92% 100%, 0% 100%)' }}
                >
                  {threatTag}
                </span>
              </div>

              <div className="flex gap-2.5">
                <div className={`h-12 w-12 shrink-0 rounded border border-white/15 ${tone.iconBg} flex flex-col items-center justify-center`}>
                  <span className={`text-[12px] leading-none ${tone.iconText}`}>!</span>
                  <span className="mt-1 text-[8px] font-mono text-[#d7f5e3]">{levelText}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13px] font-semibold leading-tight ${tone.title}`}>{inc.label}</p>
                  <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1 text-[8px] font-mono">
                    <div className="min-w-0">
                      <p className="uppercase tracking-widest text-slate-500">Source</p>
                      <p className={`truncate mt-0.5 ${tone.source}`}>{inc.source}</p>
                    </div>
                    <span className={`px-1 text-[13px] ${tone.arrow}`}>→</span>
                    <div className="min-w-0 text-right">
                      <p className="uppercase tracking-widest text-slate-500">Destination</p>
                      <p className="truncate mt-0.5 text-[#d7f5e3]">{destination}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[8px] font-mono">
                    <span className="text-[#7e9f87]">{inc.id}</span>
                    {inc.status === 'CONTAINED' ? (
                      <span className="text-emerald-400">CONTAINED</span>
                    ) : (
                      <span className={inc.sla < 900 ? 'text-rose-400 animate-[pulse_2s_ease-in-out_infinite]' : 'text-slate-400'}>
                        T-{formatSLA(inc.sla)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </button>
        )
      })}
      {visibleIncidents.length === 0 && (
        <div className="text-[9px] font-mono text-slate-600 text-center uppercase mt-10">Queue Empty</div>
      )}
    </div>
  </Frame>
))
TriageQueuePanel.displayName = 'TriageQueuePanel'

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

export default function DashboardLayout() {
  // Storage State
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [events, setEvents] = useState<ThreatEvent[]>([])
  const [containedNodes, setContainedNodes] = useState<string[]>([])
  const incidentsRef = useRef<Incident[]>([])
  const eventsRef = useRef<ThreatEvent[]>([])
  const [isBootstrapped, setIsBootstrapped] = useState(false)

  // View State
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [mapFilter, setMapFilter] = useState<string | null>(null)
  const [criticalPanelOpen, setCriticalPanelOpen] = useState(false)
  const [criticalOverlayActive, setCriticalOverlayActive] = useState(false)
  const [criticalOverlayCycle, setCriticalOverlayCycle] = useState(0)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<Incident | null>(null)
  const [acknowledgedCriticalIds, setAcknowledgedCriticalIds] = useState<Set<string>>(new Set())
  const seenCriticalIdsRef = useRef<Set<string>>(new Set())
  const criticalOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    incidentsRef.current = incidents
  }, [incidents])

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    return () => {
      if (criticalOverlayTimeoutRef.current) clearTimeout(criticalOverlayTimeoutRef.current)
    }
  }, [])

  const stopCriticalOverlay = useCallback((): void => {
    if (criticalOverlayTimeoutRef.current) {
      clearTimeout(criticalOverlayTimeoutRef.current)
      criticalOverlayTimeoutRef.current = null
    }
    setCriticalOverlayActive(false)
  }, [])

  // Simulation Tick
  useEffect(() => {
    const simulationStartedAt = INITIAL_SIMULATION_BOOTSTRAP.startedAt

    setEvents([...INITIAL_SIMULATION_BOOTSTRAP.events])
    setIncidents(INITIAL_SIMULATION_BOOTSTRAP.incidents.map(cloneIncident))
    eventsRef.current = [...INITIAL_SIMULATION_BOOTSTRAP.events]
    setIsBootstrapped(true)
    
    // Core Simulator
    const interval = setInterval(() => {
      setContainedNodes(currentContained => {
         const shouldEmitEvent = Math.random() < TELEMETRY_EMISSION_PROBABILITY
         const newEvent = shouldEmitEvent ? generateEvent(currentContained, eventsRef.current) : null
         if (newEvent) {
           setEvents(prev => {
             const next = [newEvent, ...prev].slice(0, 16)
             eventsRef.current = next
             return next
           })
            
            const canEscalateToCriticalIncident = Date.now() - simulationStartedAt >= CRITICAL_ALERT_GRACE_PERIOD_MS
            if (canEscalateToCriticalIncident && shouldAutoEscalateCriticalIncident(newEvent, incidentsRef.current)) {
               setIncidents(prev => {
                 if (prev.length > 4) return prev
                 const nextIncident: Incident = {
                   id: `INC-${Math.floor(Math.random() * 90000) + 10000}`,
                   sev: 'CRITICAL',
                   time: new Date().toISOString(),
                   label: newEvent.type + ' Detected',
                   source: newEvent.source,
                   node: newEvent.node,
                   region: newEvent.region,
                   status: 'OPEN',
                   sla: 3600,
                   events: [newEvent.id],
                   timeline: [
                     { id: `tla-${Date.now()}-1`, time: new Date().toISOString(), desc: `Telemetry event observed: ${newEvent.type}`, type: 'OBSERVED' },
                     { id: `tla-${Date.now()}-2`, time: new Date().toISOString(), desc: `System auto-escalated to incident`, type: 'ALERT_OPENED' }
                   ]
                 }
                 const next = [nextIncident, ...prev]
                 incidentsRef.current = next
                 return next
              })
           }
         }
         return currentContained
      })

      setIncidents(prev => prev.map(inc => {
        if (inc.status === 'OPEN' || inc.status === 'INVESTIGATING') {
          return { ...inc, sla: Math.max(0, inc.sla - (TELEMETRY_SIM_INTERVAL_MS / 1000)) }
        }
        return inc
      }))
      
    }, TELEMETRY_SIM_INTERVAL_MS)
    
    return () => clearInterval(interval)
  }, [])

  // ==========================================================================
  // VIEW HANDLERS (SEPARATED FROM MUTATIONS)
  // ==========================================================================
  
  const handleSelectIncident = useCallback((id: string): void => {
    setActiveIncidentId(id)
    setSelectedEventId(null)
  }, [])

  const handleSelectEvent = useCallback((id: string): void => {
    setSelectedEventId(id)
    setActiveIncidentId(null)
  }, [])

  const handleMapClick = useCallback((region: string): void => {
    setSelectedEventId((currentSelectedEventId) => {
      if (!currentSelectedEventId) return currentSelectedEventId
      const selectedEvent = events.find((event) => event.id === currentSelectedEventId)
      if (!selectedEvent || selectedEvent.region === region) return currentSelectedEventId
      return null
    })
    setMapFilter(prev => prev === region ? null : region)
  }, [events])

  const handleClearMapFocus = useCallback((): void => {
    setMapFilter(null)
    setSelectedEventId(null)
    setActiveIncidentId(null)
  }, [])

  const buildIncidentFromEvent = useCallback((event: ThreatEvent, initialStatus: IncidentStatus = 'OPEN'): Incident => ({
    id: `INC-${Math.floor(Math.random() * 90000) + 10000}`,
    sev: event.sev,
    time: new Date().toISOString(),
    label: event.type,
    source: event.source,
    node: event.node,
    region: event.region,
    status: initialStatus,
    sla: 3600,
    events: [event.id],
    timeline: [
      { id: `tp-1-${Date.now()}`, time: event.timestamp, desc: `Threat telemetry observed: ${event.type}`, type: 'OBSERVED' },
      { id: `tp-2-${Date.now()}`, time: new Date().toISOString(), desc: 'Signal promoted into an analyst-owned case', type: 'ALERT_OPENED' },
      ...(initialStatus === 'INVESTIGATING'
        ? [{ id: `tp-3-${Date.now()}`, time: new Date().toISOString(), desc: 'Investigation started immediately', type: 'INVESTIGATING' as TimelineType }]
        : []),
    ],
  }), [])

  const findIncidentForEvent = useCallback((event: ThreatEvent, pool: Incident[]): Incident | undefined => {
    const linked = pool.find((incident) => incident.events.includes(event.id))
    if (linked) return linked
    return pool.find(
      (incident) =>
        incident.source === event.source &&
        incident.node === event.node &&
        incident.region === event.region &&
        incident.status !== 'RESOLVED',
    )
  }, [])

  const ensureIncidentForEvent = useCallback((event: ThreatEvent, initialStatus: IncidentStatus = 'OPEN'): Incident => {
    const existing = findIncidentForEvent(event, incidentsRef.current)
    if (existing) return existing
    const created = buildIncidentFromEvent(event, initialStatus)
    incidentsRef.current = [created, ...incidentsRef.current]
    setIncidents((prev) => [created, ...prev])
    return created
  }, [buildIncidentFromEvent, findIncidentForEvent])

  // ==========================================================================
  // ACTION HANDLERS (MUTATIONS)
  // ==========================================================================
  
  const handleInvestigate = useCallback((id: string): void => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id && inc.status !== 'INVESTIGATING' && inc.status !== 'RESOLVED') {
        return { 
          ...inc, 
          status: 'INVESTIGATING',
          timeline: [...inc.timeline, { id: `tl-inv-${Date.now()}`, time: new Date().toISOString(), desc: 'Analyst formally initiated investigation', type: 'INVESTIGATING' }]
        }
      }
      return inc
    }))
  }, [])

  const handleIsolate = useCallback((id: string, node: string, source: string): void => {
    setContainedNodes(prev => Array.from(new Set([...prev, node, source])))
    
    setEvents(prev => {
      const systemEvent: ThreatEvent = {
        id: `EVT-SYS-${Date.now()}`,
        timestamp: new Date().toISOString(),
        sev: 'CRITICAL',
        type: 'ISOLATION PROTOCOL ENGAGED',
        source: 'SYSTEM',
        node: node,
        region: 'GLOBAL',
        protocol: 'TCP',
        port: 0
      }
      const next: ThreatEvent[] = [systemEvent, ...prev].slice(0, 16)
      eventsRef.current = next
      return next
    })

    setIncidents(prev => prev.map(inc => inc.id === id ? { 
      ...inc, 
      status: 'CONTAINED',
      timeline: [...inc.timeline, { id: `tl-iso-${Date.now()}`, time: new Date().toISOString(), desc: 'Network isolation and containment deployed', type: 'CONTAINED' }]
    } : inc))
  }, [])

  const handleResolve = useCallback((id: string): void => {
    const incident = incidentsRef.current.find((candidate) => candidate.id === id)
    if (!incident || incident.status === 'RESOLVED') return

    const nextIncidents = incidentsRef.current.map((candidate) =>
      candidate.id === id
        ? {
            ...candidate,
            status: 'RESOLVED' as IncidentStatus,
            timeline: [
              ...candidate.timeline,
              { id: `tl-res-${Date.now()}`, time: new Date().toISOString(), desc: 'Incident closed after analyst review and action validation', type: 'RESOLVED' as TimelineType },
            ],
          }
        : candidate,
    )

    incidentsRef.current = nextIncidents
    setIncidents(nextIncidents)
    setEvents((prev) => {
      const next = prev.filter((event) => !incident.events.includes(event.id))
      eventsRef.current = next
      return next
    })
    setActiveIncidentId((prev) => (prev === id ? null : prev))
    setSelectedEventId((prev) => (incident.events.includes(prev ?? '') ? null : prev))
  }, [])

  const handleTelemetryPromote = useCallback((event: ThreatEvent): void => {
    const incident = ensureIncidentForEvent(event, 'OPEN')
    setSelectedEventId(null)
    setActiveIncidentId(incident.id)
  }, [ensureIncidentForEvent])

  const handleTelemetryInvestigate = useCallback((event: ThreatEvent): void => {
    const incident = ensureIncidentForEvent(event, 'INVESTIGATING')
    if (incident.status === 'OPEN') {
      handleInvestigate(incident.id)
    }
    setSelectedEventId(null)
    setActiveIncidentId(incident.id)
  }, [ensureIncidentForEvent, handleInvestigate])

  const handleTelemetryContain = useCallback((event: ThreatEvent): void => {
    const incident = ensureIncidentForEvent(event, 'INVESTIGATING')
    if (incident.status !== 'CONTAINED' && incident.status !== 'RESOLVED') {
      handleIsolate(incident.id, incident.node, incident.source)
    }
    setSelectedEventId(null)
    setActiveIncidentId(incident.id)
  }, [ensureIncidentForEvent, handleIsolate])

  const handleTelemetryResolve = useCallback((event: ThreatEvent): void => {
    const incident = ensureIncidentForEvent(event, 'INVESTIGATING')
    if (incident.status !== 'RESOLVED') {
      handleResolve(incident.id)
    }
    setSelectedEventId(null)
  }, [ensureIncidentForEvent, handleResolve])

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================
  
  const activeIncidents = useMemo(() => {
    return incidents.filter(i => i.status !== 'RESOLVED')
  }, [incidents])

  const criticalQueue = useMemo(() => {
    return activeIncidents.filter(
      (incident) => incident.sev === 'CRITICAL' && !acknowledgedCriticalIds.has(incident.id),
    )
  }, [acknowledgedCriticalIds, activeIncidents])

  const visibleIncidents = useMemo(() => {
    let filtered = activeIncidents
    if (mapFilter) filtered = filtered.filter(i => i.region === mapFilter)
    return filtered
  }, [activeIncidents, mapFilter])

  useEffect(() => {
    if (criticalQueue.length === 0) {
      setCriticalPanelOpen(false)
      return
    }

    const queueIds = new Set(criticalQueue.map((incident) => incident.id))
    seenCriticalIdsRef.current.forEach((id) => {
      if (!queueIds.has(id)) seenCriticalIdsRef.current.delete(id)
    })

    const newCriticals = criticalQueue.filter((incident) => !seenCriticalIdsRef.current.has(incident.id))
    if (newCriticals.length === 0) return

    newCriticals.forEach((incident) => seenCriticalIdsRef.current.add(incident.id))
    setCriticalPanelOpen(true)
    setCriticalOverlayCycle((prev) => prev + 1)
    setCriticalOverlayActive(true)

    if (criticalOverlayTimeoutRef.current) clearTimeout(criticalOverlayTimeoutRef.current)
    criticalOverlayTimeoutRef.current = setTimeout(() => {
      setCriticalOverlayActive(false)
    }, 7000)
  }, [criticalQueue])

  const handleDismissCriticalAlert = useCallback((id: string): void => {
    stopCriticalOverlay()
    setAcknowledgedCriticalIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    setCriticalPanelOpen(criticalQueue.some((incident) => incident.id !== id))
  }, [criticalQueue, stopCriticalOverlay])

  const handleCloseCriticalPanel = useCallback((): void => {
    stopCriticalOverlay()
    setCriticalPanelOpen(false)
  }, [stopCriticalOverlay])

  const handleOpenIncidentReport = useCallback((incident: Incident): void => {
    setSelectedEventId(null)
    setActiveIncidentId(incident.id)
    setReportTarget(incident)
    setReportModalOpen(true)
  }, [])

  const handleTelemetryReport = useCallback((event: ThreatEvent): void => {
    const incident = ensureIncidentForEvent(event)
    handleOpenIncidentReport(incident)
  }, [ensureIncidentForEvent, handleOpenIncidentReport])

  const handleOpenCriticalReport = useCallback((queueItem: CriticalAlertQueueItem): void => {
    const incident = criticalQueue.find((item) => item.id === queueItem.id)
    if (!incident) return

    stopCriticalOverlay()
    handleOpenIncidentReport(incident)
    setAcknowledgedCriticalIds((prev) => {
      const next = new Set(prev)
      next.add(incident.id)
      return next
    })
    setCriticalPanelOpen(criticalQueue.some((item) => item.id !== incident.id))
  }, [criticalQueue, handleOpenIncidentReport, stopCriticalOverlay])

  const handleCloseReportModal = useCallback((): void => {
    setReportModalOpen(false)
    setReportTarget(null)
  }, [])

  // Stable map-only incidents: strip SLA so the map doesn't re-render every 1.5s tick
  const mapIncidentsRef = useRef<MapIncident[]>([])
  const mapIncidents = useMemo(() => {
    const next = activeIncidents
      .filter((incident) => (REGIONS as readonly string[]).includes(incident.region))
      .map(({ id, sev, region, source }) => ({ id, sev, region: region as RegionKey, source }))
    const prev = mapIncidentsRef.current
    if (
      prev.length === next.length &&
      next.every((n, i) => n.id === prev[i]?.id && n.sev === prev[i]?.sev && n.region === prev[i]?.region)
    ) {
      return prev
    }
    mapIncidentsRef.current = next
    return next
  }, [activeIncidents])

  const visibleEvents = useMemo(() => {
    let filtered = events
    if (mapFilter) filtered = filtered.filter(e => e.region === mapFilter)
    return filtered
  }, [events, mapFilter])

  const incidentByEventId = useMemo(() => {
    const linked = new Map<string, Incident>()
    incidents.forEach((incident) => {
      incident.events.forEach((eventId) => {
        if (!linked.has(eventId)) linked.set(eventId, incident)
      })
    })
    return linked
  }, [incidents])

  const selectedTelemetrySignal = useMemo<MapFocusSignal | null>(() => {
    if (!selectedEventId) return null
    const selectedEvent = events.find((event) => event.id === selectedEventId)
    if (!selectedEvent || !(REGIONS as readonly string[]).includes(selectedEvent.region)) return null

    const linkedIncident = incidentByEventId.get(selectedEvent.id) ?? null
    const region = selectedEvent.region as RegionKey

    return {
      id: selectedEvent.id,
      sev: selectedEvent.sev,
      region,
      source: selectedEvent.source,
      sourceRegion: deriveSourceRegion(selectedEvent.source, region),
      node: selectedEvent.node,
      label: selectedEvent.type,
      protocol: selectedEvent.protocol,
      port: selectedEvent.port,
      timestamp: selectedEvent.timestamp,
      incidentId: linkedIncident?.id ?? null,
      caseStatus: linkedIncident?.status ?? 'NO_CASE',
    }
  }, [incidentByEventId, selectedEventId, events])

  if (!isBootstrapped) {
    return <DashboardSkeleton />
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-[#000102] text-slate-300 font-sans selection:bg-emerald-900/60 selection:text-emerald-50 flex flex-col">
      {criticalOverlayActive && (
        <CriticalOverlayFx cycle={criticalOverlayCycle} />
      )}
      <CriticalAlertPanel
        queue={criticalQueue}
        open={criticalPanelOpen}
        onReport={handleOpenCriticalReport}
        onDismiss={handleDismissCriticalAlert}
        onClose={handleCloseCriticalPanel}
      />
      <AttackReportModal
        incident={reportTarget}
        open={reportModalOpen}
        onClose={handleCloseReportModal}
      />
      <div className="mx-auto flex w-full max-w-[2400px] flex-1 gap-2 p-2 overflow-hidden items-stretch">

        {/* ========================================================= */}
        {/* CENTER COLUMN: HIGH-FREQUENCY DOMAINS                     */}
        {/* ========================================================= */}
        <main className="flex-1 flex flex-col gap-2 min-w-0 h-full">
          <GlobalMapPanel
             mapIncidents={mapIncidents}
             mapFilter={mapFilter}
             selectedSignal={selectedTelemetrySignal}
             onMapClick={handleMapClick}
             onClearFocus={handleClearMapFocus}
          />
          <Frame
             title={`Live Telemetry Stream ${mapFilter ? `[FILTER: ${mapFilter}]` : ''}`}
             className={`flex-none min-h-0 ${TELEMETRY_PANEL_HEIGHT_CLASS} border-[#1a2e1a]`}
             headerClass="bg-[#08120b]"
          >
            <TelemetryStreamPanel
              visibleEvents={visibleEvents}
              selectedEventId={selectedEventId}
              mapFilter={mapFilter}
              incidentByEventId={incidentByEventId}
              onEventSelect={handleSelectEvent}
              onPromote={handleTelemetryPromote}
              onReport={handleTelemetryReport}
              onInvestigate={handleTelemetryInvestigate}
              onContain={handleTelemetryContain}
              onResolve={handleTelemetryResolve}
              formatTime={formatTime}
              regionLabels={REGION_LABELS}
            />
          </Frame>
        </main>

      </div>
    </div>
  )
}


