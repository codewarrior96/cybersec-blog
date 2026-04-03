'use client'

import React, { ReactNode, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { geoCentroid, geoEquirectangular, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { feature as topoFeature, mesh as topoMesh } from 'topojson-client'

// ============================================================================
// TYPES & CONSTANTS 
// ============================================================================
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'FALSE_POSITIVE'
type Protocol = 'TCP' | 'UDP' | 'ICMP' | 'HTTP' | 'DNS'
type TimelineType = 'OBSERVED' | 'CORRELATED' | 'DETECTED' | 'ALERT_OPENED' | 'INVESTIGATING' | 'CONTAINED' | 'DISMISSED'

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

type TelemetryCaseFilter = 'ALL' | 'NO_CASE' | 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'FALSE_POSITIVE'

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

const generateEvent = (containedNodes: string[], forceMalicious?: boolean, fixedValues?: Partial<ThreatEvent>): ThreatEvent | null => {
  const isMalicious = forceMalicious !== undefined ? forceMalicious : Math.random() > 0.8
  const region = fixedValues?.region || REGIONS[Math.floor(Math.random() * REGIONS.length)]
  const source = fixedValues?.source || `192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`
  const node = fixedValues?.node || `NODE-${Math.floor(Math.random()*999)}`
  
  if (containedNodes.includes(source) || containedNodes.includes(node)) return null;

  return {
    id: `EVT-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
    timestamp: fixedValues?.timestamp || new Date().toISOString(),
    sev: fixedValues?.sev || (isMalicious ? (Math.random() > 0.9 ? 'CRITICAL' : 'HIGH') : (Math.random() > 0.5 ? 'MEDIUM' : 'LOW')),
    type: fixedValues?.type || ['SYN Flood', 'SQL Injection Payload', 'C2 Beaconing', 'Auth Bypass', 'Large Data Exfil'][Math.floor(Math.random()*5)],
    source,
    node,
    region,
    protocol: fixedValues?.protocol || ['TCP', 'UDP', 'HTTP', 'DNS'][Math.floor(Math.random()*4)] as Protocol,
    port: fixedValues?.port || [443, 53, 80, 22, 3389][Math.floor(Math.random()*5)],
  }
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
const TELEMETRY_SIM_INTERVAL_MS = 4500

/** Live Telemetry Stream: ekranın geri kalanını sınırsız doldurmasın; içeride kaydır */
const TELEMETRY_PANEL_HEIGHT_CLASS = 'h-[min(420px,36vh)]'

const MAP_VIEWBOX_WIDTH = 1000
const MAP_VIEWBOX_HEIGHT = 500
const MAP_VIEWPORT_INSET = { top: 0, right: 0, bottom: 0, left: 0 }
const MAP_CONTENT_Y_OFFSET = 0

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

const ATTACK_COLOR_TONE: Record<Severity, { fill: string; stroke: string }> = {
  CRITICAL: { fill: '#6d2338', stroke: '#ff6c92' },
  HIGH: { fill: '#665026', stroke: '#ffd46b' },
  MEDIUM: { fill: '#21586f', stroke: '#72e8ff' },
  LOW: { fill: '#2a4869', stroke: '#89beff' },
}

const CONTEXT_CONTINENT_TONE = {
  fill: '#173127',
  stroke: '#4f9b76',
  fillOpacity: 0.26,
  strokeOpacity: 0.56,
  strokeWidth: 0.64,
}

const REGION_CLICK_RADIUS: Record<RegionKey, number> = {
  'US-EAST': 190,
  'UK-LON': 135,
  'JP-TYO': 170,
  'SG-SIN': 120,
  'BR-SAO': 190,
  'RU-MOW': 360,
  'CN-PEK': 230,
}

const toMapPoint = (lat: number, lng: number) => ({
  x: ((lng + 180) / 360) * MAP_VIEWBOX_WIDTH,
  y: ((90 - lat) / 180) * MAP_VIEWBOX_HEIGHT,
})

type MapIncident = { id: string; region: RegionKey; sev: Severity; source: string }

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
  bbox?: [number, number, number, number]
}

const FLOW_ROUTE_LIMIT = 6
const ALWAYS_VISIBLE_LABEL_REGIONS: readonly RegionKey[] = REGIONS
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

const COUNTRY_REGION_MAP: Partial<Record<string, RegionKey>> = {
  '840': 'US-EAST', // United States of America
  '124': 'US-EAST', // Canada
  '484': 'US-EAST', // Mexico
  '826': 'UK-LON',  // United Kingdom
  '250': 'UK-LON',  // France
  '276': 'UK-LON',  // Germany
  '528': 'UK-LON',  // Netherlands
  '392': 'JP-TYO',  // Japan
  '410': 'JP-TYO',  // South Korea
  '643': 'RU-MOW',  // Russia
  '804': 'RU-MOW',  // Ukraine
  '156': 'CN-PEK',  // China
  '496': 'CN-PEK',  // Mongolia
  '076': 'BR-SAO',  // Brazil
  '032': 'BR-SAO',  // Argentina
  '152': 'BR-SAO',  // Chile
  '170': 'BR-SAO',  // Colombia
  '604': 'BR-SAO',  // Peru
  '360': 'SG-SIN',  // Indonesia
  '458': 'SG-SIN',  // Malaysia proxy for Singapore at 110m resolution
  '704': 'SG-SIN',  // Vietnam
  '764': 'SG-SIN',  // Thailand
  '702': 'SG-SIN',  // Singapore
}

const resolveCountryRegion = (countryId: string): RegionKey | null => {
  const numeric = countryId.replace(/\D/g, '')
  if (!numeric) return null
  const normalized = numeric.padStart(3, '0')
  return COUNTRY_REGION_MAP[normalized] ?? null
}

const trimUnitedStatesEdgeFragments = (featureItem: Feature<Geometry>, countryId: string): Feature<Geometry> => {
  const normalizedCountryId = countryId.replace(/\D/g, '').padStart(3, '0')
  if (normalizedCountryId !== '840') return featureItem
  const geometry = featureItem.geometry
  if (!geometry || geometry.type !== 'MultiPolygon') return featureItem

  const polygons = geometry.coordinates as number[][][][]
  const filteredPolygons = polygons.filter((polygon) => {
    let minLon = Infinity
    let maxLon = -Infinity
    let minLat = Infinity
    let maxLat = -Infinity

    polygon.forEach((ring) => {
      ring.forEach(([lon, lat]) => {
        minLon = Math.min(minLon, lon)
        maxLon = Math.max(maxLon, lon)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
      })
    })

    const centerLon = (minLon + maxLon) / 2
    const centerLat = (minLat + maxLat) / 2
    // Keep only contiguous US bounds; remove Alaska/Hawaii/outlying fragments.
    const isContinentalUS = centerLon >= -130 && centerLon <= -65 && centerLat >= 22 && centerLat <= 52
    return isContinentalUS
  })

  // Safety fallback: if filtering removed everything, keep original geometry.
  if (filteredPolygons.length === 0) return featureItem
  if (filteredPolygons.length === polygons.length) return featureItem
  return {
    ...featureItem,
    geometry: {
      ...geometry,
      coordinates: filteredPolygons,
    } as Geometry,
  }
}

const deriveSourceRegion = (source: string, targetRegion: RegionKey): RegionKey => {
  const candidates = REGIONS.filter((region) => region !== targetRegion)
  const hash = source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return candidates[hash % candidates.length]
}

const buildArcPath = (sx: number, sy: number, tx: number, ty: number) => {
  const midX = (sx + tx) / 2
  const midY = (sy + ty) / 2
  const distance = Math.hypot(tx - sx, ty - sy)
  const lift = Math.min(120, Math.max(28, distance * 0.18))
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} Q ${midX.toFixed(2)} ${(midY - lift).toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)}`
}

const GlobalMapPanel = React.memo(({ mapIncidents, mapFilter, onMapClick, onClearFocus }: {
  mapIncidents: MapIncident[]
  mapFilter: string | null
  onMapClick: (r: string) => void
  onClearFocus: () => void
}) => {
  const [worldTopology, setWorldTopology] = useState<WorldTopology | null>(null)

  useEffect(() => {
    let isMounted = true
    const loadWorldTopology = async () => {
      try {
        const response = await fetch('/world-110m.json')
        if (!response.ok) return
        const data = await response.json() as WorldTopology
        if (!isMounted) return
        if (data?.type !== 'Topology' || !data?.objects?.countries || !data?.objects?.land) return
        setWorldTopology(data)
      } catch {
        // Keep map operational with incident overlays even if topology fetch fails.
      }
    }
    void loadWorldTopology()
    return () => {
      isMounted = false
    }
  }, [])

  const mapProjection = useMemo(
    () =>
      geoEquirectangular()
        .scale(MAP_VIEWBOX_WIDTH / (2 * Math.PI))
        .translate([MAP_VIEWBOX_WIDTH / 2, MAP_VIEWBOX_HEIGHT / 2]),
    [],
  )
  const mapPathBuilder = useMemo(() => geoPath(mapProjection), [mapProjection])

  const fallbackIncidents: MapIncident[] = useMemo(() => ([
    { id: 'demo-1', sev: 'HIGH', region: 'US-EAST', source: 'RU-MOW' },
    { id: 'demo-2', sev: 'CRITICAL', region: 'CN-PEK', source: 'US-EAST' },
    { id: 'demo-3', sev: 'HIGH', region: 'RU-MOW', source: 'UK-LON' },
    { id: 'demo-4', sev: 'MEDIUM', region: 'BR-SAO', source: 'US-EAST' },
  ]), [])

  const incidentsForRender = useMemo(() => {
    if (mapIncidents.length > 0) return mapIncidents
    // Do not inject demo/fallback incidents while a region filter is active.
    // Otherwise clicking a region with no live incidents repaints unrelated countries.
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

  const focusRegion = useMemo<RegionKey | null>(() => {
    if (mapFilter && (REGIONS as readonly string[]).includes(mapFilter)) return mapFilter as RegionKey
    return null
  }, [mapFilter])

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

  const landPath = useMemo(() => {
    if (!worldTopology) return null
    const topo = worldTopology as unknown as Parameters<typeof topoFeature>[0]
    const landObject = worldTopology.objects.land as unknown as Parameters<typeof topoFeature>[1]
    const landFeature = topoFeature(topo, landObject)
    return mapPathBuilder(landFeature as GeoPermissibleObjects)
  }, [mapPathBuilder, worldTopology])

  const countryBoundaryPath = useMemo(() => {
    if (!worldTopology) return null
    const topo = worldTopology as unknown as Parameters<typeof topoMesh>[0]
    const countriesObject = worldTopology.objects.countries as unknown as Parameters<typeof topoMesh>[1]
    const borderMesh = topoMesh(topo, countriesObject)
    return mapPathBuilder(borderMesh as GeoPermissibleObjects)
  }, [mapPathBuilder, worldTopology])

  const countryShapes = useMemo(() => {
    if (!worldTopology) return [] as Array<{
      id: string
      d: string
      region: RegionKey | null
      sev: Severity
      count: number
      focused: boolean
      interactive: boolean
      isAmericas: boolean
    }>
    const topo = worldTopology as unknown as Parameters<typeof topoFeature>[0]
    const countriesObject = worldTopology.objects.countries as unknown as Parameters<typeof topoFeature>[1]
    const countries = topoFeature(topo, countriesObject) as FeatureCollection<Geometry>

    return countries.features
      .map((featureItem: Feature<Geometry>, index) => {
        const countryId = String((featureItem as { id?: string | number }).id ?? '')
        const normalizedFeature = trimUnitedStatesEdgeFragments(featureItem, countryId)
        const d = mapPathBuilder(normalizedFeature as GeoPermissibleObjects)
        if (!d) return null
        const [centroidLon, centroidLat] = geoCentroid(normalizedFeature as GeoPermissibleObjects)
        const isAmericas =
          Number.isFinite(centroidLon) &&
          Number.isFinite(centroidLat) &&
          centroidLon >= -170 &&
          centroidLon <= -30 &&
          centroidLat >= -60 &&
          centroidLat <= 85
        const mappedRegion = resolveCountryRegion(countryId)
        const stats = mappedRegion ? regionStats.get(mappedRegion) : undefined
        const count = stats?.count ?? 0
        const sev = stats?.sev ?? 'LOW'
        const focused = Boolean(mappedRegion && focusRegion && mappedRegion === focusRegion)
        return {
          id: `country-${countryId || index}`,
          d,
          region: mappedRegion,
          sev,
          count,
          focused,
          interactive: Boolean(mappedRegion),
          isAmericas,
        }
      })
      .filter((shape): shape is {
        id: string
        d: string
        region: RegionKey | null
        sev: Severity
        count: number
        focused: boolean
        interactive: boolean
        isAmericas: boolean
      } => Boolean(shape))
  }, [focusRegion, mapPathBuilder, regionStats, worldTopology])

  const nodeData = useMemo(() => {
    return MOCK_MAP_POINTS.map(point => {
      const xy = toMapPoint(point.lat, point.lng)
      const region = point.region as RegionKey
      const stats = regionStats.get(region)
      const count = stats?.count ?? 0
      const sev = stats?.sev ?? 'LOW'
      const focused = Boolean(focusRegion && region === focusRegion)
      return {
        ...point,
        region,
        x: xy.x,
        y: xy.y,
        count,
        sev,
        focused,
      }
    })
  }, [focusRegion, regionStats])

  const visibleLabelRegions = useMemo(
    () => new Set<RegionKey>(ALWAYS_VISIBLE_LABEL_REGIONS),
    [],
  )

  const regionAnchorMap = useMemo(() => {
    const anchorMap = new Map<RegionKey, { x: number; y: number }>()
    nodeData.forEach((node) => {
      anchorMap.set(node.region, { x: node.x, y: node.y + MAP_CONTENT_Y_OFFSET })
    })
    return anchorMap
  }, [nodeData])

  const isCountryClickAllowed = useCallback((region: RegionKey, event: React.MouseEvent<SVGPathElement>) => {
    const svgElement = event.currentTarget.ownerSVGElement
    if (!svgElement) return true

    const rect = svgElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return true

    const clickX = ((event.clientX - rect.left) / rect.width) * MAP_VIEWBOX_WIDTH
    const clickY = ((event.clientY - rect.top) / rect.height) * MAP_VIEWBOX_HEIGHT - MAP_CONTENT_Y_OFFSET
    const anchor = regionAnchorMap.get(region)
    if (!anchor) return true

    const allowedRadius = REGION_CLICK_RADIUS[region] ?? 180
    const distance = Math.hypot(clickX - anchor.x, clickY - anchor.y)
    return distance <= allowedRadius
  }, [regionAnchorMap])

  const flowRoutes = useMemo(() => {
    return incidentsForRender
      .slice(0, FLOW_ROUTE_LIMIT)
      .map((incident, index) => {
        const targetPoint = MOCK_MAP_POINTS.find((point) => point.region === incident.region)
        if (!targetPoint) return null
        const sourceRegion = deriveSourceRegion(incident.source, incident.region)
        const sourcePoint = MOCK_MAP_POINTS.find((point) => point.region === sourceRegion)
        if (!sourcePoint) return null
        const sourceXY = toMapPoint(sourcePoint.lat, sourcePoint.lng)
        const targetXY = toMapPoint(targetPoint.lat, targetPoint.lng)
        return {
          id: `flow-${incident.id}-${index}`,
          pathId: `flow-path-${index}`,
          d: buildArcPath(sourceXY.x, sourceXY.y, targetXY.x, targetXY.y),
          critical: incident.sev === 'CRITICAL',
          focused: Boolean(focusRegion && incident.region === focusRegion),
          from: sourceRegion,
          to: incident.region,
        }
      })
      .filter((route): route is {
        id: string
        pathId: string
        d: string
        critical: boolean
        focused: boolean
        from: RegionKey
        to: RegionKey
      } => Boolean(route))
  }, [focusRegion, incidentsForRender])

  const ambientRoutes = useMemo(() => {
    return AMBIENT_ROUTE_EDGES
      .map(([from, to], index) => {
        const sourcePoint = MOCK_MAP_POINTS.find((point) => point.region === from)
        const targetPoint = MOCK_MAP_POINTS.find((point) => point.region === to)
        if (!sourcePoint || !targetPoint) return null
        const sourceXY = toMapPoint(sourcePoint.lat, sourcePoint.lng)
        const targetXY = toMapPoint(targetPoint.lat, targetPoint.lng)
        return {
          id: `ambient-${from}-${to}-${index}`,
          d: buildArcPath(sourceXY.x, sourceXY.y, targetXY.x, targetXY.y),
        }
      })
      .filter((route): route is { id: string; d: string } => Boolean(route))
  }, [])

  const focusCardGeometry = useMemo(() => {
    if (!focusRegion) return null
    const anchor = nodeData.find((node) => node.region === focusRegion)
    if (!anchor) return null

    const cardWidth = 248
    const cardHeight = 188
    const gap = 12
    const openRight = anchor.x < MAP_VIEWBOX_WIDTH * 0.68
    const xRaw = openRight ? anchor.x + gap : anchor.x - cardWidth - gap
    const x = Math.max(10, Math.min(MAP_VIEWBOX_WIDTH - cardWidth - 10, xRaw))
    const y = Math.max(12, Math.min(MAP_VIEWBOX_HEIGHT - cardHeight - 12, anchor.y - cardHeight / 2))

    return {
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      anchorX: anchor.x,
      anchorY: anchor.y,
      openRight,
    }
  }, [focusRegion, nodeData])

  const focusOverlayGeometry = useMemo(() => {
    if (!focusCardGeometry) return null
    return {
      ...focusCardGeometry,
      y: focusCardGeometry.y + MAP_CONTENT_Y_OFFSET,
      anchorY: focusCardGeometry.anchorY + MAP_CONTENT_Y_OFFSET,
    }
  }, [focusCardGeometry])

  return (
    <section className="flex-none h-[52vh] border border-[#1a2e1a] bg-transparent overflow-hidden shadow-2xl">
      <div className="relative h-full">
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-2 bg-gradient-to-b from-[#091409]/96 to-transparent border-b border-[#1c3a22]/55 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e640] shadow-[0_0_7px_rgba(0,230,64,0.85)]" />
          <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-slate-200">Global Threat Map</span>
          <span className="ml-auto text-[8px] font-mono text-[#7effb2]/85">TOTAL INCIDENTS {totalIncidents}</span>
        </div>

        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`} preserveAspectRatio="none" aria-label="Global threat heat map">
          <defs>
            <pattern id="worldMatrixPattern" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="1.1" cy="1.1" r="0.62" fill="#7df0c7" fillOpacity="0.56" />
              <circle cx="4.6" cy="3.8" r="0.52" fill="#9afdd9" fillOpacity="0.26" />
              <circle cx="3.1" cy="5.1" r="0.36" fill="#9afdd9" fillOpacity="0.18" />
            </pattern>
            <pattern id="worldOceanPattern" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="0.42" fill="#6fd7c4" fillOpacity="0.2" />
              <circle cx="6.8" cy="5.4" r="0.36" fill="#6fd7c4" fillOpacity="0.12" />
              <circle cx="4.1" cy="8.2" r="0.3" fill="#8bf1db" fillOpacity="0.1" />
            </pattern>
            <linearGradient id="worldScanGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6bf8c0" stopOpacity="0" />
              <stop offset="45%" stopColor="#8affd1" stopOpacity="0.28" />
              <stop offset="55%" stopColor="#8affd1" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#6bf8c0" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="worldBaseGlow" cx="50%" cy="46%" r="70%">
              <stop offset="0%" stopColor="#1f5f80" stopOpacity="0.52" />
              <stop offset="60%" stopColor="#10324a" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#02060b" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="worldVignette" cx="50%" cy="42%" r="72%">
              <stop offset="65%" stopColor="#00000000" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.14" />
            </radialGradient>
            <clipPath id="mapViewportClip">
              <rect
                x={MAP_VIEWPORT_INSET.left}
                y={MAP_VIEWPORT_INSET.top}
                width={MAP_VIEWBOX_WIDTH - MAP_VIEWPORT_INSET.left - MAP_VIEWPORT_INSET.right}
                height={MAP_VIEWBOX_HEIGHT - MAP_VIEWPORT_INSET.top - MAP_VIEWPORT_INSET.bottom}
                rx="3"
              />
            </clipPath>
          </defs>

          <g clipPath="url(#mapViewportClip)" transform={`translate(0 ${MAP_CONTENT_Y_OFFSET})`}>
            <rect x="0" y="0" width={MAP_VIEWBOX_WIDTH} height={MAP_VIEWBOX_HEIGHT} fill="#071a2a" />
            <rect x="0" y="0" width={MAP_VIEWBOX_WIDTH} height={MAP_VIEWBOX_HEIGHT} fill="url(#worldBaseGlow)" />
            <rect x="0" y="0" width={MAP_VIEWBOX_WIDTH} height={MAP_VIEWBOX_HEIGHT} fill="url(#worldOceanPattern)" opacity="0.24" />

          {landPath && (
            <>
              <path d={landPath} fill="#0a1927" opacity="0.98" />
            </>
          )}

          {countryShapes.map((country) => {
            const americaContextZone = focusRegion === 'US-EAST' && country.isAmericas && !country.focused
            const isFocusTarget = country.focused
            const dimUnfocused = Boolean(focusRegion) && !isFocusTarget && !americaContextZone
            const effectiveSeverity: Severity = country.focused ? (focusRegionStats?.sev ?? country.sev) : country.sev
            const tone = ATTACK_COLOR_TONE[effectiveSeverity]
            const hasActivity = country.count > 0 || country.focused
            const idleFill = country.interactive || americaContextZone ? '#112a3a' : '#0d2231'
            const fillColor = isFocusTarget
              ? tone.fill
              : americaContextZone
                ? CONTEXT_CONTINENT_TONE.fill
                : hasActivity
                  ? tone.fill
                  : idleFill
            const strokeColor = isFocusTarget
              ? tone.stroke
              : americaContextZone
                ? CONTEXT_CONTINENT_TONE.stroke
              : hasActivity
                ? tone.stroke
                : (country.interactive ? '#4a92a8' : '#27485d')
            return (
              <path
                key={country.id}
                d={country.d}
                fill={fillColor}
                fillOpacity={
                  isFocusTarget
                    ? 0.84
                    : americaContextZone
                      ? CONTEXT_CONTINENT_TONE.fillOpacity
                    : dimUnfocused
                      ? 0.18
                      : hasActivity
                        ? 0.44
                        : 0.32
                }
                stroke={dimUnfocused ? '#132839' : strokeColor}
                strokeOpacity={isFocusTarget ? 0.98 : americaContextZone ? CONTEXT_CONTINENT_TONE.strokeOpacity : dimUnfocused ? 0.34 : hasActivity ? 0.76 : 0.58}
                strokeWidth={isFocusTarget ? 1.18 : americaContextZone ? CONTEXT_CONTINENT_TONE.strokeWidth : dimUnfocused ? 0.42 : hasActivity ? 0.74 : 0.52}
                className={`${country.interactive ? 'cursor-crosshair' : 'cursor-default'} transition-colors duration-200`}
                onClick={(event) => {
                  if (!country.region) return
                  if (!isCountryClickAllowed(country.region, event)) return
                  onMapClick(country.region)
                }}
              />
            )
          })}

          {countryBoundaryPath && (
            <path
              d={countryBoundaryPath}
              fill="none"
              stroke="#5aa8be"
              strokeWidth="0.68"
              strokeOpacity="0.75"
              pointerEvents="none"
            />
          )}

          {landPath && (
            <g pointerEvents="none">
              <path d={landPath} fill="url(#worldMatrixPattern)" opacity={focusRegion ? 0.34 : 0.48} className="matrix-drift" />
              <path d={landPath} fill="url(#worldScanGradient)" opacity={focusRegion ? 0.25 : 0.34} className="scan-sweep" />
              <path d={landPath} fill="none" stroke="#9cfed8" strokeOpacity={focusRegion ? 0.32 : 0.4} strokeWidth="0.62" />
            </g>
          )}

          <g fill="none" strokeLinecap="round" pointerEvents="none">
            {ambientRoutes.map((route, index) => (
              <path
                key={route.id}
                d={route.d}
                stroke="#9cf87a"
                strokeWidth="0.8"
                strokeDasharray="3 12"
                opacity={focusRegion ? 0.08 : 0.18}
                className="ambient-flow"
                style={{ animationDelay: `${index * 0.24}s` }}
              />
            ))}
          </g>

          <g fill="none" strokeLinecap="round" pointerEvents="none">
            {flowRoutes.map((route, index) => (
              <g key={route.id}>
                <path id={route.pathId} d={route.d} fill="none" stroke="transparent" />
                <path
                  d={route.d}
                  stroke={route.critical ? '#ff6f90' : '#b9fb72'}
                  strokeWidth={route.critical ? 1.85 : 1.35}
                  strokeDasharray={route.critical ? '6 9' : '4 10'}
                  opacity={focusRegion ? (route.focused ? 0.96 : 0.25) : (route.focused ? 0.9 : 0.58)}
                  className="hybrid-flow"
                  style={{ animationDuration: route.critical ? '8s' : '10s', animationDelay: `${index * 0.5}s` }}
                />
                <circle r={route.critical ? 2.1 : 1.78} fill={route.critical ? '#ffd4df' : '#e9ffc6'} opacity={0.86}>
                  <animateMotion dur={route.critical ? '4.1s' : '5.4s'} begin={`${index * 0.35}s`} repeatCount="indefinite" rotate="auto">
                    <mpath href={`#${route.pathId}`} />
                  </animateMotion>
                </circle>
              </g>
            ))}
          </g>

          <g pointerEvents="none">
            {nodeData
              .filter((node) => node.count > 0)
              .map((node) => {
                const color = REGION_HEAT_COLOR[node.sev]
                const baseRadius = Math.min(42, 14 + node.count * 6)
                return (
                  <g key={`heat-${node.region}`}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={baseRadius}
                      fill={color.glow}
                      opacity={focusRegion ? (node.focused ? (node.sev === 'CRITICAL' ? 0.24 : 0.18) : 0.06) : (node.sev === 'CRITICAL' ? 0.28 : 0.18)}
                      className="hybrid-pulse"
                    />
                    <circle cx={node.x} cy={node.y} r={Math.max(3.4, baseRadius * 0.32)} fill={color.glow} opacity={0.28} />
                  </g>
                )
              })}
          </g>

          <g>
            {nodeData.map((node) => {
              const color = REGION_HEAT_COLOR[node.sev]
              const isHot = node.count > 0
              const radius = isHot ? 4.3 : 2.5
              const showLabel = visibleLabelRegions.has(node.region)
              const labelOffset = LABEL_OFFSETS[node.region]
              const alignLabelLeft = node.x + labelOffset.dx > MAP_VIEWBOX_WIDTH - 170
              const labelX = (alignLabelLeft ? node.x - 9 : node.x + 9) + labelOffset.dx
              const labelY = node.y - 9 + labelOffset.dy
              const labelAnchor: 'start' | 'end' = alignLabelLeft ? 'end' : 'start'
              const isFocusLabel = Boolean(focusRegion && node.region === focusRegion)
              const isNonFocusLabel = Boolean(focusRegion && node.region !== focusRegion)
              return (
                <g key={node.region} onClick={() => onMapClick(node.region)} className="cursor-crosshair">
                  {node.focused && (
                    <circle cx={node.x} cy={node.y} r={radius + 6} fill="none" stroke="#8be9ff88" strokeWidth="1.2" />
                  )}
                  <circle cx={node.x} cy={node.y} r={radius} fill={isHot ? color.core : '#4f6678'} stroke="#06111b" strokeWidth="1.1" />
                  {showLabel && (
                    <>
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor={labelAnchor}
                        fill={isFocusLabel ? '#f0fff8' : isNonFocusLabel ? '#b8ddc8' : '#d9f4ff'}
                        stroke="#051019"
                        strokeOpacity={isFocusLabel ? 0.96 : isNonFocusLabel ? 0.62 : 0.88}
                        strokeWidth={isFocusLabel ? '2.3' : '2.1'}
                        paintOrder="stroke"
                        fontSize={isFocusLabel ? '10.3' : '9.7'}
                        fontWeight={isFocusLabel ? '700' : '600'}
                        opacity={focusRegion ? (isFocusLabel ? 1 : 0.54) : 0.98}
                        letterSpacing="0.35"
                        fontFamily={'"JetBrains Mono", "SFMono-Regular", Consolas, monospace'}
                      >
                        {REGION_LABELS[node.region] ?? node.region}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </g>
          </g>

          {focusRegion && focusOverlayGeometry && (
            <g>
              <line
                x1={focusOverlayGeometry.anchorX}
                y1={focusOverlayGeometry.anchorY}
                x2={focusOverlayGeometry.openRight ? focusOverlayGeometry.x : focusOverlayGeometry.x + focusOverlayGeometry.width}
                y2={focusOverlayGeometry.y + focusOverlayGeometry.height / 2}
                stroke={focusRegionStats ? REGION_HEAT_COLOR[focusRegionStats.sev].glow : '#59f59a'}
                strokeOpacity="0.62"
                strokeWidth="1.1"
                strokeDasharray="4 3"
              />
              <circle cx={focusOverlayGeometry.anchorX} cy={focusOverlayGeometry.anchorY} r="2.6" fill="#d4ffe6" />
              <foreignObject x={focusOverlayGeometry.x} y={focusOverlayGeometry.y} width={focusOverlayGeometry.width} height={focusOverlayGeometry.height}>
                <div className="h-full w-full rounded-md border border-[#2b4a30] bg-gradient-to-b from-[#0c1f10]/95 via-[#0a180e]/95 to-[#08130b]/95 p-2.5 shadow-[0_0_25px_rgba(0,230,64,0.18)] backdrop-blur-[1px]">
                  <div className="mb-2 flex items-start justify-between border-b border-[#27422b] pb-1.5">
                    <div className="min-w-0">
                      <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-[#9fffc4]/90">Country Intelligence</p>
                      <p className="truncate pt-0.5 text-[11px] font-semibold text-slate-100">
                        {REGION_LABELS[focusRegion] ?? focusRegion}
                      </p>
                    </div>
                    <span
                      className="ml-2 rounded border px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-widest"
                      style={{
                        color: focusRegionStats ? REGION_HEAT_COLOR[focusRegionStats.sev].core : '#d7ffe8',
                        borderColor: focusRegionStats ? `${REGION_HEAT_COLOR[focusRegionStats.sev].glow}88` : '#2c4f31',
                        backgroundColor: focusRegionStats ? `${REGION_HEAT_COLOR[focusRegionStats.sev].glow}22` : '#0f1f12',
                      }}
                    >
                      {focusRegionStats?.sev ?? 'LOW'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[8px] font-mono">
                    <div className="rounded border border-[#2a432c] bg-[#0a180e]/85 px-1.5 py-1">
                      <p className="text-slate-400 uppercase">Incidents</p>
                      <p className="pt-0.5 text-[10px] font-semibold text-emerald-200 tabular-nums">{focusIncidentSet.length}</p>
                    </div>
                    <div className="rounded border border-[#2a432c] bg-[#0a180e]/85 px-1.5 py-1">
                      <p className="text-slate-400 uppercase">Critical</p>
                      <p className="pt-0.5 text-[10px] font-semibold text-rose-300 tabular-nums">{focusCriticalCount}</p>
                    </div>
                    <div className="rounded border border-[#2a432c] bg-[#0a180e]/85 px-1.5 py-1">
                      <p className="text-slate-400 uppercase">Mode</p>
                      <p className="pt-0.5 text-[10px] font-semibold text-[#b2ffd0]">FOCUS</p>
                    </div>
                    <div className="rounded border border-[#2a432c] bg-[#0a180e]/85 px-1.5 py-1">
                      <p className="text-slate-400 uppercase">Coverage</p>
                      <p className="pt-0.5 text-[10px] font-semibold text-emerald-200 tabular-nums">{focusActivityRatio}%</p>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-[8px] font-mono">
                    {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((sev) => {
                      const count = focusSeverityMix[sev]
                      const ratio = focusIncidentSet.length > 0 ? Math.round((count / focusIncidentSet.length) * 100) : 0
                      const barColor = sev === 'CRITICAL'
                        ? '#f43f5e'
                        : sev === 'HIGH'
                          ? '#f59e0b'
                          : sev === 'MEDIUM'
                            ? '#22c55e'
                            : '#86efac'
                      return (
                        <div key={sev}>
                          <div className="flex items-center justify-between text-slate-300">
                            <span className="tracking-widest">{sev}</span>
                            <span className="tabular-nums text-slate-400">{count}</span>
                          </div>
                          <div className="mt-0.5 h-[4px] overflow-hidden rounded border border-[#1f3524] bg-[#061008]">
                            <div
                              className="h-full"
                              style={{
                                width: `${count > 0 ? Math.max(6, ratio) : 0}%`,
                                backgroundColor: barColor,
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={onClearFocus}
                      className="flex-1 rounded border border-[#2f5b35] bg-[#0d2311] py-1 text-[8px] font-bold uppercase tracking-widest text-[#9bffc2] hover:bg-[#14361a]"
                    >
                      Clear Focus
                    </button>
                    <span className="rounded border border-[#24432a] bg-[#0a180e]/80 px-1.5 py-1 text-[8px] font-mono text-slate-300">
                      focus slice
                    </span>
                  </div>
                </div>
              </foreignObject>
            </g>
          )}

          <rect
            x="0"
            y="0"
            width={MAP_VIEWBOX_WIDTH}
            height={MAP_VIEWBOX_HEIGHT}
            fill="url(#worldVignette)"
            clipPath="url(#mapViewportClip)"
            pointerEvents="none"
          />
        </svg>

        {!worldTopology && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="rounded border border-[#24412a] bg-[#08130b]/90 px-3 py-1 text-[9px] font-mono tracking-widest uppercase text-[#9bc2a7]">
              Loading Topology Layer
            </span>
          </div>
        )}

        <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2 rounded border border-[#204028] bg-[#08130b]/92 px-2 py-1 text-[8px] font-mono">
          <span className="rounded border border-[#2a4b31] bg-[#09190d] px-1.5 py-0.5 text-[#9dc5a9]">
            {focusRegion ? 'FOCUS MIX' : 'GLOBAL MIX'}
          </span>
          <span className="text-rose-300">CRITICAL {legendSeverityMix.CRITICAL}</span>
          <span className="text-amber-300">HIGH {legendSeverityMix.HIGH}</span>
          <span className="text-emerald-300">MEDIUM {legendSeverityMix.MEDIUM}</span>
          <span className="text-green-300">LOW {legendSeverityMix.LOW}</span>
        </div>

        <style jsx>{`
          .matrix-drift {
            animation: matrix-drift 16s linear infinite;
          }

          .scan-sweep {
            animation: scan-sweep 11s ease-in-out infinite;
          }

          .ambient-flow {
            animation: ambient-flow-dash 18s linear infinite;
          }

          .hybrid-flow {
            animation-name: hybrid-flow-dash;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
          }

          .hybrid-pulse {
            transform-origin: center;
            transform-box: fill-box;
            animation: hybrid-pulse-wave 4.8s ease-in-out infinite;
          }

          @keyframes hybrid-flow-dash {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: -220; }
          }

          @keyframes hybrid-pulse-wave {
            0%, 100% { opacity: 0.14; transform: scale(0.97); }
            50% { opacity: 0.28; transform: scale(1.06); }
          }

          @keyframes ambient-flow-dash {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: -140; }
          }

          @keyframes scan-sweep {
            0%, 100% { opacity: 0.2; }
            50% { opacity: 0.4; }
          }

          @keyframes matrix-drift {
            0% { transform: translateX(0); opacity: 0.34; }
            50% { transform: translateX(-5px); opacity: 0.48; }
            100% { transform: translateX(0); opacity: 0.34; }
          }
        `}</style>
      </div>
    </section>
  )
})
GlobalMapPanel.displayName = 'GlobalMapPanel'





const LiveTelemetryStream = React.memo(({
  visibleEvents,
  selectedEventId,
  mapFilter,
  incidentByEventId,
  onEventSelect,
  onPromote,
  onInvestigate,
  onContain,
  onDismiss,
}: {
  visibleEvents: ThreatEvent[]
  selectedEventId: string | null
  mapFilter: string | null
  incidentByEventId: Map<string, Incident>
  onEventSelect: (id: string) => void
  onPromote: (event: ThreatEvent) => void
  onInvestigate: (event: ThreatEvent) => void
  onContain: (event: ThreatEvent) => void
  onDismiss: (event: ThreatEvent) => void
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | Severity>('ALL')
  const [caseFilter, setCaseFilter] = useState<TelemetryCaseFilter>('ALL')

  const telemetryRows = useMemo(() => {
    return visibleEvents.map((event) => {
      const linkedIncident = incidentByEventId.get(event.id) ?? null
      const caseStatus = (linkedIncident?.status ?? 'NO_CASE') as TelemetryCaseFilter | IncidentStatus
      return { event, linkedIncident, caseStatus }
    })
  }, [incidentByEventId, visibleEvents])

  const filteredRows = useMemo(() => {
    return telemetryRows.filter((row) => {
      if (severityFilter !== 'ALL' && row.event.sev !== severityFilter) return false
      if (caseFilter === 'ALL') return true
      if (caseFilter === 'NO_CASE') return row.caseStatus === 'NO_CASE'
      return row.caseStatus === caseFilter
    })
  }, [caseFilter, severityFilter, telemetryRows])

  const tableRows = filteredRows.slice(0, 120)
  const criticalCount = filteredRows.filter((row) => row.event.sev === 'CRITICAL').length
  const highCount = filteredRows.filter((row) => row.event.sev === 'HIGH').length
  const investigatingCount = filteredRows.filter((row) => row.caseStatus === 'INVESTIGATING').length
  const openCaseCount = filteredRows.filter((row) => row.caseStatus === 'OPEN').length
  const containedCount = filteredRows.filter((row) => row.caseStatus === 'CONTAINED').length
  const noCaseCount = filteredRows.filter((row) => row.caseStatus === 'NO_CASE').length

  const selectedTelemetryRow = selectedEventId
    ? telemetryRows.find((row) => row.event.id === selectedEventId) ?? null
    : null
  const selectedTelemetryEvent = selectedTelemetryRow?.event ?? null
  const selectedTelemetryIncident = selectedTelemetryRow?.linkedIncident ?? null

  return (
    <Frame
      title={`Live Telemetry Stream ${mapFilter ? `[FILTER: ${mapFilter}]` : ''}`}
      className={`flex-none min-h-0 ${TELEMETRY_PANEL_HEIGHT_CLASS} border-[#1a2e1a]`}
      headerClass="bg-[#08120b]"
      rightAction={
        <div className="flex items-center gap-2 text-[8px] font-mono tracking-wider">
          <span className="text-rose-300">CRIT {criticalCount}</span>
          <span className="text-amber-300">HIGH {highCount}</span>
          <span className="text-[#7aa989]">ROWS {tableRows.length}/{filteredRows.length}</span>
        </div>
      }
    >
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar -m-3 mt-0">
        <div className="sticky top-0 z-20 border-b border-[#1d3323] bg-[#0a180d]/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="rounded border border-[#2b4e32] bg-[#0d2212] px-2 py-0.5 text-[8px] font-mono uppercase tracking-widest text-[#99c9a8]">
              {selectedTelemetryEvent ? `Selected: ${formatTime(selectedTelemetryEvent.timestamp)}` : 'Selected: none'}
            </span>
            {selectedTelemetryIncident && (
              <span className="rounded border border-[#2a4a31] bg-[#0e1e12] px-2 py-0.5 text-[8px] font-mono uppercase tracking-widest text-[#9fe3b3]">
                Case {selectedTelemetryIncident.id}
              </span>
            )}
            <span className="rounded border border-[#2a4a31] bg-[#0e1e12] px-2 py-0.5 text-[8px] font-mono uppercase tracking-widest text-[#9dc9a8]">
              Open {openCaseCount}
            </span>
            <span className="rounded border border-[#265140] bg-[#0d2218] px-2 py-0.5 text-[8px] font-mono uppercase tracking-widest text-[#9cead0]">
              Inv {investigatingCount}
            </span>
            <span className="rounded border border-[#2d5642] bg-[#11231a] px-2 py-0.5 text-[8px] font-mono uppercase tracking-widest text-[#89e0b5]">
              Con {containedCount}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                disabled={!selectedTelemetryEvent}
                onClick={() => selectedTelemetryEvent && onPromote(selectedTelemetryEvent)}
                className="rounded border border-[#2f5f3c] bg-[#122716] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#a9efbc] hover:bg-[#17311d] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create/Open
              </button>
              <button
                disabled={!selectedTelemetryEvent}
                onClick={() => selectedTelemetryEvent && onInvestigate(selectedTelemetryEvent)}
                className="rounded border border-cyan-500/45 bg-cyan-900/25 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-cyan-100 hover:bg-cyan-800/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Investigate
              </button>
              <button
                disabled={!selectedTelemetryEvent}
                onClick={() => selectedTelemetryEvent && onContain(selectedTelemetryEvent)}
                className="rounded border border-rose-500/45 bg-rose-900/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-rose-100 hover:bg-rose-800/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Contain
              </button>
              <button
                disabled={!selectedTelemetryEvent}
                onClick={() => selectedTelemetryEvent && onDismiss(selectedTelemetryEvent)}
                className="rounded border border-amber-500/45 bg-amber-900/25 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-amber-100 hover:bg-amber-800/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Dismiss
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto border-t border-[#163122] px-2 py-1 whitespace-nowrap">
            <span className="text-[7px] uppercase tracking-widest text-[#6f8f78]">Severity</span>
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
              <button
                key={`sev-${sev}`}
                onClick={() => setSeverityFilter(sev)}
                className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${
                  severityFilter === sev
                    ? 'border-[#3d7850] bg-[#17311f] text-[#bff7cf]'
                    : 'border-[#2a4a31] bg-[#0f1f13] text-[#89aa94] hover:bg-[#162a1b]'
                }`}
              >
                {sev}
              </button>
            ))}
            <span className="ml-2 text-[7px] uppercase tracking-widest text-[#6f8f78]">Case</span>
            {(['ALL', 'NO_CASE', 'OPEN', 'INVESTIGATING', 'CONTAINED', 'FALSE_POSITIVE'] as const).map((item) => (
              <button
                key={`case-${item}`}
                onClick={() => setCaseFilter(item)}
                className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${
                  caseFilter === item
                    ? 'border-[#3d7850] bg-[#17311f] text-[#bff7cf]'
                    : 'border-[#2a4a31] bg-[#0f1f13] text-[#89aa94] hover:bg-[#162a1b]'
                }`}
              >
                {item === 'NO_CASE' ? 'NoCase' : item === 'FALSE_POSITIVE' ? 'Dismissed' : item}
              </button>
            ))}
            <span className="ml-2 rounded border border-[#2a4a31] bg-[#0f1f13] px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-widest text-[#8db09a]">
              No Case {noCaseCount}
            </span>
          </div>
        </div>
        <table className="w-full border-collapse table-fixed text-left">
          <thead className="sticky top-[54px] z-10 bg-[#0b170d] border-b border-[#1f3824]">
            <tr>
              <th className="px-3 py-2 text-[8px] uppercase tracking-widest text-[#739b81] font-normal w-[74px] border-r border-[#183020]">Time</th>
              <th className="px-3 py-2 text-[8px] uppercase tracking-widest text-[#739b81] font-normal w-[86px] border-r border-[#183020]">Severity</th>
              <th className="px-3 py-2 text-[8px] uppercase tracking-widest text-[#739b81] font-normal border-r border-[#183020]">Incident Type</th>
              <th className="px-3 py-2 text-[8px] uppercase tracking-widest text-[#739b81] font-normal w-[130px] border-r border-[#183020]">Source IP</th>
              <th className="px-3 py-2 text-[8px] uppercase tracking-widest text-[#739b81] font-normal w-[130px] border-r border-[#183020]">Node</th>
              <th className="px-3 py-2 text-[8px] uppercase tracking-widest text-[#739b81] font-normal w-[142px] border-r border-[#183020]">Region</th>
              <th className="px-3 py-2 text-[8px] uppercase tracking-widest text-[#739b81] font-normal w-[130px] border-r border-[#183020]">Case</th>
              <th className="px-3 py-2 text-[8px] uppercase tracking-widest text-[#739b81] font-normal w-[200px]">Ops</th>
            </tr>
          </thead>
          <tbody className="font-mono divide-y divide-[#15251a]">
            {tableRows.map((row, index) => {
              const evt = row.event
              const isSelected = selectedEventId === evt.id
              const linkedIncident = row.linkedIncident
              const linkedStatus = linkedIncident?.status ?? null
              const isContained = linkedStatus === 'CONTAINED'
              const isDismissed = linkedStatus === 'FALSE_POSITIVE'
              const primaryLabel = !linkedIncident ? 'Create' : linkedStatus === 'OPEN' ? 'Investigate' : 'Open'
              const baseRow = index % 2 === 0 ? 'bg-[#08140b]' : 'bg-[#0b180f]'
              const sevTone = evt.sev === 'CRITICAL'
                ? 'text-rose-200'
                : evt.sev === 'HIGH'
                  ? 'text-amber-200'
                  : evt.sev === 'MEDIUM'
                    ? 'text-emerald-200'
                    : 'text-green-200'
              return (
                <tr
                  key={evt.id}
                  onClick={() => onEventSelect(evt.id)}
                  className={`cursor-pointer ${isSelected ? 'bg-[#123019]' : `${baseRow} hover:bg-[#11301a]`}`}
                >
                  <td className="px-3 py-2 text-[10px] text-slate-400 tabular-nums border-r border-[#183020]">{formatTime(evt.timestamp)}</td>
                  <td className="px-3 py-2 border-r border-[#183020]">
                    <span className={`inline-flex min-w-[64px] justify-center rounded-sm border border-[#24402b] px-1.5 py-[2px] text-[8px] font-bold tracking-widest ${sevTone}`}>
                      {evt.sev}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-[10px] truncate border-r border-[#183020] ${sevTone}`}>{evt.type}</td>
                  <td className="px-3 py-2 text-[10px] text-[#a5ffc8]/80 tabular-nums border-r border-[#183020]">{evt.source}</td>
                  <td className="px-3 py-2 text-[10px] text-slate-300 tabular-nums border-r border-[#183020]">
                    <span className="text-slate-500 mr-1">[{evt.protocol}]</span>
                    {evt.node}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-slate-300 truncate border-r border-[#183020]">{REGION_LABELS[evt.region] ?? evt.region}</td>
                  <td className="px-2 py-1.5 border-r border-[#183020]">
                    {linkedIncident ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[8px] font-semibold text-[#b6f3cb]">{linkedIncident.id}</span>
                        <span
                          className={`rounded border px-1 py-0.5 text-[7px] font-bold uppercase tracking-widest ${
                            linkedStatus === 'CONTAINED'
                              ? 'border-emerald-500/40 bg-emerald-900/25 text-emerald-200'
                              : linkedStatus === 'FALSE_POSITIVE'
                                ? 'border-amber-500/40 bg-amber-900/20 text-amber-200'
                                : linkedStatus === 'INVESTIGATING'
                                  ? 'border-cyan-500/40 bg-cyan-900/20 text-cyan-200'
                                  : 'border-[#325338] bg-[#102214] text-[#9fd6ad]'
                          }`}
                        >
                          {linkedStatus}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[8px] uppercase tracking-widest text-[#6f8f78]">No Case</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!linkedIncident) onPromote(evt)
                          else if (linkedStatus === 'OPEN') onInvestigate(evt)
                          else onPromote(evt)
                        }}
                        className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${
                          linkedIncident
                            ? 'border-[#2f5f3c] bg-[#122716] text-[#a9efbc] hover:bg-[#17311d]'
                            : 'border-[#2e4f33] bg-[#102014] text-[#96d9a7] hover:bg-[#17301c]'
                        }`}
                        title={linkedIncident ? `Case: ${linkedIncident.id}` : 'Promote telemetry to incident'}
                      >
                        {primaryLabel}
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          onContain(evt)
                        }}
                        disabled={isContained || isDismissed}
                        className="rounded border border-rose-500/45 bg-rose-900/35 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-rose-100 hover:bg-rose-800/45 disabled:cursor-not-allowed disabled:opacity-35"
                        title={isContained ? 'Already contained' : isDismissed ? 'Dismissed case cannot be contained' : 'Contain from telemetry'}
                      >
                        Contain
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          onDismiss(evt)
                        }}
                        disabled={isDismissed}
                        className="rounded border border-amber-500/45 bg-amber-900/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-amber-100 hover:bg-amber-800/45 disabled:cursor-not-allowed disabled:opacity-35"
                        title={isDismissed ? 'Already dismissed' : 'Mark as false positive from telemetry'}
                      >
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[10px] uppercase tracking-widest text-slate-500 font-mono">
                  No telemetry events
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Frame>
  )
})
LiveTelemetryStream.displayName = 'LiveTelemetryStream'

const TriageQueuePanel = React.memo(({ visibleIncidents, activeIncidentId, mapFilter, onIncidentSelect }: { visibleIncidents: Incident[], activeIncidentId: string | null, mapFilter: string | null, onIncidentSelect: (id: string) => void }) => (
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
            onClick={() => onIncidentSelect(inc.id)}
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
// SKELETON SCREEN (shown before client-side mount to prevent blank flash)
// ============================================================================

function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#040d18]/80 border border-[#0a1929] ${className}`} />
}

function DashboardSkeleton() {
  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-[#000102] flex flex-col">
      <div className="mx-auto flex w-full max-w-[2400px] flex-1 gap-2 p-2 items-stretch">
        {/* Center */}
        <main className="flex-1 flex flex-col gap-2 min-w-0">
          {/* Map placeholder */}
          <div className="h-[45vh] border border-[#1a2e1a] bg-[#00020a] flex flex-col relative overflow-hidden animate-pulse">
            <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-3 py-1.5 border-b border-[#17331f]/40">
              <div className="w-1.5 h-1.5 bg-[#2b5e37] flex-none" />
              <div className="h-2 w-40 bg-[#0a180e] rounded-sm" />
              <div className="ml-auto h-2 w-24 bg-[#0a180e] rounded-sm" />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-[85%] h-[75%] bg-[#091309]/60 border border-[#17301b]/45" />
            </div>
          </div>

          {/* Telemetry table placeholder */}
          <div className={`flex-none ${TELEMETRY_PANEL_HEIGHT_CLASS} border border-[#1a2e1a] bg-[#07110a]/80 flex flex-col min-h-0 overflow-hidden`}>
            <div className="flex items-center px-3 py-1.5 border-b border-[#1a2e1a] bg-[#050905]">
              <div className="h-2 w-36 bg-[#0a180e] rounded-sm animate-pulse" />
            </div>
            <div className="flex-1 p-3 flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse" style={{ opacity: 1 - i * 0.09 }}>
                  <div className="h-2 w-14 bg-[#0a180e] rounded-sm" />
                  <div className="h-2 w-3 bg-[#123020] rounded-sm" />
                  <div className="h-2 w-28 bg-[#0a180e] rounded-sm" />
                  <div className="h-2 w-24 bg-[#071009] rounded-sm" />
                  <div className="h-2 w-20 bg-[#071009] rounded-sm" />
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="w-[360px] flex-shrink-0 hidden xl:flex flex-col gap-2">
          <SkeletonBox className="flex-1" />
          <SkeletonBox className="flex-[1.5]" />
        </aside>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

export default function DashboardLayout() {
  // Storage State
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [events, setEvents] = useState<ThreatEvent[]>([])
  const [containedNodes, setContainedNodes] = useState<string[]>([])
  const incidentsRef = useRef<Incident[]>([])

  // View State
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [mapFilter, setMapFilter] = useState<string | null>(null)

  useEffect(() => {
    incidentsRef.current = incidents
  }, [incidents])

  // Simulation Tick
  useEffect(() => {
    
    // Seed payload
    const t0 = new Date(Date.now() - 300000).toISOString()
    const t1 = new Date(Date.now() - 250000).toISOString()
    const t2 = new Date(Date.now() - 120000).toISOString()
    
    const seedEventsRaw = [
      generateEvent([], true, { timestamp: t0, sev: 'HIGH', type: 'Auth Bypass Attempt', source: '10.0.4.15', node: 'FIN-DB-01', region: 'US-EAST' }),
      generateEvent([], true, { timestamp: t1, sev: 'HIGH', type: 'SQL Injection Payload', source: '10.0.4.15', node: 'FIN-DB-01', region: 'US-EAST' }),
      generateEvent([], true, { timestamp: t2, sev: 'CRITICAL', type: 'Ransomware Payload Detonated', source: '10.0.4.15', node: 'FIN-DB-01', region: 'US-EAST' })
    ]
    const seedEvents = seedEventsRaw.filter((e): e is ThreatEvent => e !== null)
    
    const randomEventsRaw = Array.from({ length: 40 }).map(() => generateEvent([]))
    const randomEvents = randomEventsRaw.filter((e): e is ThreatEvent => e !== null)
    
    setEvents([...seedEvents, ...randomEvents].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
    
    const initialIncident: Incident = {
      id: 'INC-9921',
      sev: 'CRITICAL',
      time: t2,
      label: 'Ransomware Payload Detonated',
      source: '10.0.4.15',
      node: 'FIN-DB-01',
      region: 'US-EAST',
      status: 'OPEN',
      sla: 862,
      events: seedEvents.map(e => e.id),
      timeline: [
        { id: 't-1', time: t0, desc: 'Initial authentication bypass attempt observed', type: 'OBSERVED' },
        { id: 't-2', time: t1, desc: 'Correlated SQL injection activity detected', type: 'CORRELATED' },
        { id: 't-3', time: t2, desc: 'Ransomware execution confirmed', type: 'DETECTED' },
        { id: 't-4', time: t2, desc: 'Automatic incident elevated', type: 'ALERT_OPENED' }
      ]
    }
    setIncidents([initialIncident])
    
    // Core Simulator
    const interval = setInterval(() => {
      setContainedNodes(currentContained => {
         const newEvent = generateEvent(currentContained)
         if (newEvent) {
           setEvents(prev => [newEvent, ...prev].slice(0, 150))
           
           if (newEvent.sev === 'CRITICAL' && Math.random() > 0.9) {
              setIncidents(prev => {
                 if (prev.length > 20) return prev
                 return [{
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
                 }, ...prev]
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
    setMapFilter(prev => prev === region ? null : region)
  }, [])

  const handleClearMapFocus = useCallback((): void => {
    setMapFilter(null)
    setSelectedEventId(null)
    setActiveIncidentId(null)
  }, [])

  const buildIncidentFromEvent = useCallback((event: ThreatEvent): Incident => ({
    id: `INC-${Math.floor(Math.random() * 90000) + 10000}`,
    sev: event.sev,
    time: new Date().toISOString(),
    label: `Promoted: ${event.type}`,
    source: event.source,
    node: event.node,
    region: event.region,
    status: 'INVESTIGATING',
    sla: 3600,
    events: [event.id],
    timeline: [
      { id: `tp-1-${Date.now()}`, time: event.timestamp, desc: 'Original threat telemetry observed', type: 'OBSERVED' },
      { id: `tp-2-${Date.now()}`, time: new Date().toISOString(), desc: 'Analyst promoted telemetry to full incident', type: 'ALERT_OPENED' },
      { id: `tp-3-${Date.now()}`, time: new Date().toISOString(), desc: 'Investigation started immediately', type: 'INVESTIGATING' },
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
        incident.status !== 'FALSE_POSITIVE' &&
        incident.status !== 'RESOLVED',
    )
  }, [])

  const ensureIncidentForEvent = useCallback((event: ThreatEvent): Incident => {
    const existing = findIncidentForEvent(event, incidentsRef.current)
    if (existing) return existing
    const created = buildIncidentFromEvent(event)
    incidentsRef.current = [created, ...incidentsRef.current]
    setIncidents((prev) => [created, ...prev])
    return created
  }, [buildIncidentFromEvent, findIncidentForEvent])

  // ==========================================================================
  // ACTION HANDLERS (MUTATIONS)
  // ==========================================================================
  
  const handleInvestigate = useCallback((id: string): void => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id && inc.status === 'OPEN') {
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
    
    setEvents(prev => [{
      id: `EVT-SYS-${Date.now()}`,
      timestamp: new Date().toISOString(),
      sev: 'CRITICAL',
      type: 'ISOLATION PROTOCOL ENGAGED',
      source: 'SYSTEM',
      node: node,
      region: 'GLOBAL',
      protocol: 'TCP',
      port: 0
    }, ...prev])

    setIncidents(prev => prev.map(inc => inc.id === id ? { 
      ...inc, 
      status: 'CONTAINED',
      timeline: [...inc.timeline, { id: `tl-iso-${Date.now()}`, time: new Date().toISOString(), desc: 'Network isolation and containment deployed', type: 'CONTAINED' }]
    } : inc))
  }, [])

  const handleDismiss = useCallback((id: string): void => {
    setIncidents(prev => prev.map(inc => inc.id === id ? { 
      ...inc, 
      status: 'FALSE_POSITIVE',
      timeline: [...inc.timeline, { id: `tl-dis-${Date.now()}`, time: new Date().toISOString(), desc: 'Incident dismissed as false positive', type: 'DISMISSED' }]
    } : inc))
    
    setActiveIncidentId(prev => prev === id ? null : prev)
  }, [])

  const handleTelemetryPromote = useCallback((event: ThreatEvent): void => {
    const incident = ensureIncidentForEvent(event)
    setSelectedEventId(null)
    setActiveIncidentId(incident.id)
  }, [ensureIncidentForEvent])

  const handleTelemetryInvestigate = useCallback((event: ThreatEvent): void => {
    const incident = ensureIncidentForEvent(event)
    if (incident.status === 'OPEN') {
      handleInvestigate(incident.id)
    }
    setSelectedEventId(null)
    setActiveIncidentId(incident.id)
  }, [ensureIncidentForEvent, handleInvestigate])

  const handleTelemetryContain = useCallback((event: ThreatEvent): void => {
    const incident = ensureIncidentForEvent(event)
    if (incident.status !== 'CONTAINED' && incident.status !== 'FALSE_POSITIVE') {
      handleIsolate(incident.id, incident.node, incident.source)
    }
    setSelectedEventId(null)
    setActiveIncidentId(incident.id)
  }, [ensureIncidentForEvent, handleIsolate])

  const handleTelemetryDismiss = useCallback((event: ThreatEvent): void => {
    const incident = ensureIncidentForEvent(event)
    if (incident.status !== 'FALSE_POSITIVE') {
      handleDismiss(incident.id)
    }
    setSelectedEventId(null)
  }, [ensureIncidentForEvent, handleDismiss])

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================
  
  const activeIncidents = useMemo(() => {
    return incidents.filter(i => i.status !== 'FALSE_POSITIVE' && i.status !== 'RESOLVED')
  }, [incidents])

  const visibleIncidents = useMemo(() => {
    let filtered = activeIncidents
    if (mapFilter) filtered = filtered.filter(i => i.region === mapFilter)
    return filtered
  }, [activeIncidents, mapFilter])

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

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-[#000102] text-slate-300 font-sans selection:bg-emerald-900/60 selection:text-emerald-50 flex flex-col">
      <div className="mx-auto flex w-full max-w-[2400px] flex-1 gap-2 p-2 overflow-hidden items-stretch">

        {/* ========================================================= */}
        {/* CENTER COLUMN: HIGH-FREQUENCY DOMAINS                     */}
        {/* ========================================================= */}
        <main className="flex-1 flex flex-col gap-2 min-w-0 h-full">
          <GlobalMapPanel
             mapIncidents={mapIncidents}
             mapFilter={mapFilter}
             onMapClick={handleMapClick}
             onClearFocus={handleClearMapFocus}
          />
          <LiveTelemetryStream 
             visibleEvents={visibleEvents}
             selectedEventId={selectedEventId}
             mapFilter={mapFilter}
             incidentByEventId={incidentByEventId}
             onEventSelect={handleSelectEvent}
             onPromote={handleTelemetryPromote}
             onInvestigate={handleTelemetryInvestigate}
             onContain={handleTelemetryContain}
             onDismiss={handleTelemetryDismiss}
          />
        </main>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: ACTION STATIONS                             */}
        {/* ========================================================= */}
        <aside className="w-[360px] flex-shrink-0 flex flex-col min-h-0 overflow-hidden hidden xl:flex">
          <TriageQueuePanel 
             visibleIncidents={visibleIncidents}
             activeIncidentId={activeIncidentId}
             mapFilter={mapFilter}
             onIncidentSelect={handleSelectIncident}
          />
        </aside>

      </div>
    </div>
  )
}


