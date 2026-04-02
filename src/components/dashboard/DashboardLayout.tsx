'use client'

import React, { ReactNode, useEffect, useState, useMemo, useCallback } from 'react'

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

const THEME = {
  border: 'border-[#0a121a]',
  panelBg: 'bg-[#020509]/80',
  panelDim: 'bg-[#010204]/90',
  severity: {
    CRITICAL: { hex: '#f43f5e', text: 'text-rose-400', bg: 'bg-rose-500', doc: 'bg-rose-950/30' },
    HIGH: { hex: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-500', doc: 'bg-amber-950/30' },
    MEDIUM: { hex: '#eab308', text: 'text-yellow-400', bg: 'bg-yellow-500', doc: 'bg-yellow-950/20' },
    LOW: { hex: '#3b82f6', text: 'text-blue-500', bg: 'bg-blue-600', doc: 'bg-blue-950/10' },
  }
}

const REGIONS = ['US-EAST', 'UK-LON', 'JP-TYO', 'SG-SIN', 'BR-SAO', 'RU-MOW', 'CN-PEK']
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
    id: `EVT-${Math.floor(Math.random() * 1000000)}`,
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
    <header className={`flex items-center justify-between border-b ${THEME.border} px-3 py-1.5 ${dim ? 'bg-[#010203]' : 'bg-[#020509]'} ${headerClass}`}>
      <h2 className={`font-bold uppercase tracking-[0.2em] text-[9px] ${dim ? 'text-slate-600' : 'text-cyan-700/80'}`}>{title}</h2>
      {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
    </header>
    <div className="flex-1 overflow-hidden p-3 flex flex-col relative">
      {children}
    </div>
  </section>
)

const SevTag = React.memo(({ sev, solid = false }: { sev: Severity, solid?: boolean }) => {
  const s = THEME.severity[sev]
  return (
    <span className={`inline-flex items-center justify-center px-1.5 py-[2px] text-[8px] font-bold tracking-widest uppercase ${solid ? s.bg + ' text-black' : s.doc + ' ' + s.text + ' border border-transparent'}`}>
      {sev}
    </span>
  )
})
SevTag.displayName = 'SevTag'

// ============================================================================
// MEMOIZED SUB-COMPONENTS
// ============================================================================

const SystemPosturePanel = React.memo(({ visibleCount, containedCount }: { visibleCount: number, containedCount: number }) => (
  <Frame title="System Posture" dim={true} rightAction={<span className="text-[8px] text-emerald-800 font-mono">SIM_ACTIVE</span>}>
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-end border-b border-[#0a121a] pb-1">
        <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">Active Incidents</span>
        <span className="text-sm text-cyan-800 font-mono tabular-nums">{visibleCount}</span>
      </div>
      <div className="flex justify-between items-end border-b border-[#0a121a] pb-1">
        <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">Contained Nodes</span>
        <span className="text-sm text-rose-800 font-mono tabular-nums">{containedCount}</span>
      </div>
    </div>
  </Frame>
))
SystemPosturePanel.displayName = 'SystemPosturePanel'

const GlobalMapFilters = React.memo(({ mapFilter, onMapClick }: { mapFilter: string | null, onMapClick: (r: string) => void }) => (
  <Frame title="Global Map Filters" dim={true}>
    <div className="flex flex-wrap gap-1 mt-1">
      {REGIONS.map(reg => (
        <button 
          key={reg} 
          onClick={() => onMapClick(reg)}
          className={`px-2 py-1 text-[8px] font-mono tracking-widest uppercase border ${mapFilter === reg ? 'bg-cyan-900/40 text-cyan-400 border-cyan-500/50' : 'bg-[#05080c] text-slate-500 border-[#1a2c3f]'}`}
        >
          {reg}
        </button>
      ))}
      {mapFilter && (
        <button onClick={() => onMapClick(mapFilter)} className="px-2 py-1 text-[8px] font-mono tracking-widest uppercase text-rose-400 mt-2 hover:underline">Clear Filter</button>
      )}
    </div>
  </Frame>
))
GlobalMapFilters.displayName = 'GlobalMapFilters'

// ─── Map coordinate system: viewBox 0 0 260 100 ────────────────────────────
// x = (lng + 180) * (260 / 360)   y = (90 - lat) * (100 / 180)
// At typical dashboard width, x-scale ≈ y-scale → circles stay circular.

// Primary node positions pre-computed (reused in constants below)
// US-EAST(76,27) UK-LON(130,21) JP-TYO(231,30) SG-SIN(205,49)
// BR-SAO(97,63)  RU-MOW(157,19) CN-PEK(214,28)





const INFRA_GEO: Array<[number, number]> = [
  // NA
  [-118,54],[-104,58],[-90,63],[-76,58],[-62,54],[-125,40],[-111,45],[-97,40],[-83,46],[-69,41],[-132,27],[-118,32],[-104,29],[-90,25],[-76,32],[-122,14],[-108,18],[-94,11],[-114,0],[-100,4],
  // SA
  [-76,-9],[-62,-3],[-48,-7],[-79,-22],[-65,-18],[-51,-23],[-76,-36],[-62,-32],[-48,-40],[-69,-54],[-55,-50],[-62,-68],
  // EU
  [-28,63],[-14,68],[0,63],[14,58],[-21,50],[-7,54],[7,47],[21,50],[-14,40],[0,43],[14,36],[28,40],
  // AF
  [-21,27],[-7,32],[7,25],[21,29],[-28,9],[-14,14],[0,7],[14,11],[-21,-9],[-7,-3],[7,-11],[21,-7],[-14,-27],[0,-22],[14,-29],[-7,-45],[7,-40],[0,-58],
  // AS
  [35,63],[48,68],[62,63],[76,67],[90,61],[104,65],[118,58],[132,63],[28,45],[42,50],[55,43],[69,47],[83,40],[97,45],[111,36],[125,40],[138,32],[152,38],[35,27],[48,32],[62,25],[76,29],[90,22],[104,27],[118,18],[132,22],[145,14],[28,9],[42,14],[55,7],[69,11],[83,4],[97,9],[111,0],[125,4],
  // OC
  [118,-18],[132,-14],[145,-22],[111,-32],[125,-29],[138,-36],[118,-47],[132,-43]
];

const ADVERSARY_MATRIX: Record<string, string[]> = {
  'US-EAST': ['RU-MOW', 'CN-PEK', 'BR-SAO'],
  'UK-LON':  ['RU-MOW', 'CN-PEK', 'US-EAST'],
  'JP-TYO':  ['CN-PEK', 'RU-MOW', 'US-EAST'],
  'SG-SIN':  ['CN-PEK', 'US-EAST', 'JP-TYO'],
  'BR-SAO':  ['US-EAST', 'UK-LON', 'RU-MOW'],
  'RU-MOW':  ['US-EAST', 'UK-LON', 'JP-TYO'],
  'CN-PEK':  ['US-EAST', 'JP-TYO', 'SG-SIN'],
}

// ─── 3D ORTHOGRAPHIC PROJECTION ─────────────────────────────────────────────
const GLOBE_R = 90;
const CENTER_LNG = 10;
const CENTER_LAT = 20;

function projectNode(lng: number, lat: number) {
  const lambda = (lng - CENTER_LNG) * (Math.PI / 180);
  const phi = lat * (Math.PI / 180);
  const phi0 = CENTER_LAT * (Math.PI / 180);

  const x = Math.cos(phi) * Math.sin(lambda);
  const y = Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda);
  const z = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda);

  return { x: x * GLOBE_R, y: -y * GLOBE_R, z }; // z < 0 is back hemisphere
}

function getGraticulePath(isLat: boolean, val: number, isFront: boolean) {
  const pts = [];
  if (isLat) {
    for (let lng = -180; lng <= 180; lng += 4) {
      const p = projectNode(lng, val);
      if ((isFront && p.z >= 0) || (!isFront && p.z < 0)) pts.push(`${p.x},${p.y}`);
    }
  } else {
    for (let lat = -90; lat <= 90; lat += 4) {
      const p = projectNode(val, lat);
      if ((isFront && p.z >= 0) || (!isFront && p.z < 0)) pts.push(`${p.x},${p.y}`);
    }
  }
  return pts.join(' ');
}

const LAT_LINES = [-60, -30, 0, 30, 60];
const LNG_LINES = [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];

// Pre-calculate static globe structures for extreme performance
const PROJECTED_INFRA_FRONT = INFRA_GEO.map(pt => projectNode(pt[0], pt[1])).filter(p => p.z >= 0);
const PROJECTED_INFRA_BACK = INFRA_GEO.map(pt => projectNode(pt[0], pt[1])).filter(p => p.z < 0);

const GlobalMapPanel = React.memo(({ visibleIncidents, activeIncidentId, selectedEventRegion, mapFilter, onMapClick }: { visibleIncidents: Incident[], activeIncidentId: string | null, selectedEventRegion: string | null, mapFilter: string | null, onMapClick: (r: string) => void }) => {
  const { arcs, nodes } = useMemo(() => {
    const projectedNodes = MOCK_MAP_POINTS.map(pt => ({
      ...pt,
      proj: projectNode(pt.lng, pt.lat),
      isFront: projectNode(pt.lng, pt.lat).z >= -0.05
    }))

    const seen = new Set<string>()
    const calculatedArcs: Array<{ id: string; sx: number; sy: number; tx: number; ty: number; sev: Severity; sFront: boolean; tFront: boolean }> = []
    
    visibleIncidents.slice(0, 6).forEach(inc => {
      const target = projectedNodes.find(p => p.region === inc.region)
      if (!target) return
      
      const hash = inc.source.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
      const candidates = ADVERSARY_MATRIX[inc.region] || REGIONS.filter(r => r !== inc.region)
      const srcRegion = candidates[hash % candidates.length]
      const src = projectedNodes.find(p => p.region === srcRegion) || projectedNodes[0]
      
      const key = `${src.region}→${inc.region}`
      if (seen.has(key)) return
      seen.add(key)
      calculatedArcs.push({
        id: key,
        sx: src.proj.x, sy: src.proj.y, sFront: src.isFront,
        tx: target.proj.x, ty: target.proj.y, tFront: target.isFront,
        sev: inc.sev
      })
    })

    return { arcs: calculatedArcs.slice(0, 4), nodes: projectedNodes }
  }, [visibleIncidents])

  const critCount = visibleIncidents.filter(i => i.sev === 'CRITICAL').length

  return (
    <section className="flex-none h-[45vh] border border-[#1a1c23] bg-[#00020a] flex flex-col relative overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-2 px-3 py-1.5 bg-gradient-to-b from-[#000408]/95 to-transparent pointer-events-none border-b border-[#0f1b2b]/30">
        <span className="w-1.5 h-1.5 bg-rose-600 animate-pulse flex-none shadow-[0_0_8px_theme(colors.rose.600)]" />
        <span className="font-bold uppercase tracking-[0.3em] text-[8px] text-slate-300">Global Threat Vector Map</span>
        <div className="ml-auto flex gap-4 text-[8px] font-mono">
          {critCount > 0 && <span className="text-rose-500">{critCount} CRITICAL</span>}
          <span className="text-cyan-600">{arcs.length} ACTIVE VECTORS</span>
          <span className="text-slate-600">GLOBE MONITORING ACTIVE</span>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {/* Deep Space Background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 90% 75% at 50% 50%, rgba(0,18,36,0.92) 0%, rgba(0,4,10,0.98) 55%, #00020a 100%)'
        }} />
        
        <svg viewBox="-140 -90 280 180" className="w-full h-full max-h-full">
          <defs>
            <filter id="glow-intense" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3.0" result="b1" />
              <feGaussianBlur stdDeviation="8.0" result="b2" />
              <feMerge><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            
            <radialGradient id="sphere-core" cx="40%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#0a1d30" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#020914" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#000000" stopOpacity="1.0" />
            </radialGradient>
            
            <radialGradient id="sphere-atmosphere" cx="50%" cy="50%" r="50%">
              <stop offset="88%" stopColor="#0ea5e9" stopOpacity="0" />
              <stop offset="96%" stopColor="#0c4a6e" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
            </radialGradient>

            <radialGradient id="sphere-highlight" cx="30%" cy="25%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="40%" stopColor="#0ea5e9" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* BACKGROUND LAYER (Back Hemisphere) */}
          <g className="back-hemisphere">
            {/* Subtle Horizon Graticules Only */}
            <polyline points={getGraticulePath(true, 0, false)} fill="none" stroke="#0ea5e9" opacity="0.08" strokeWidth="0.2" />
            <polyline points={getGraticulePath(false, 0, false)} fill="none" stroke="#0ea5e9" opacity="0.08" strokeWidth="0.2" />
            
            {/* Back Landmass (Optimized static paths) */}
            <g opacity="0.4">
              {PROJECTED_INFRA_BACK.map((p, i) => <circle key={`bl${i}`} cx={p.x} cy={p.y} r="1.2" fill="#02283e" />)}
            </g>
            
            {/* Back Arcs */}
            {arcs.map(arc => {
              if (arc.sFront && arc.tFront) return null;
              const mx = (arc.sx + arc.tx) / 2, my = (arc.sy + arc.ty) / 2;
              const dist = Math.hypot(arc.tx - arc.sx, arc.ty - arc.sy);
              const angle = Math.atan2(arc.ty - arc.sy, arc.tx - arc.sx) - Math.PI/2;
              const offset = (arc.sx > arc.tx ? 1 : -1) * dist * 0.2;
              return (
                <path key={`bkar${arc.id}`} d={`M${arc.sx} ${arc.sy} Q${mx + Math.cos(angle)*offset} ${my + Math.sin(angle)*offset} ${arc.tx} ${arc.ty}`}
                  fill="none" stroke={arc.sev === 'CRITICAL' ? '#be123c' : '#0369a1'} strokeWidth="0.4" opacity="0.15" strokeDasharray="1.5 3" />
              );
            })}
          </g>

          {/* GLOBE SPHERE */}
          <circle cx="0" cy="0" r={GLOBE_R} fill="url(#sphere-core)" />
          <circle cx="0" cy="0" r={GLOBE_R} fill="url(#sphere-highlight)" style={{ pointerEvents: 'none' }} />
          
          {/* FRONT LAYER (Front Hemisphere) */}
          <g className="front-hemisphere">
            {/* Faint Center Graticules */}
            <polyline points={getGraticulePath(true, 0, true)} fill="none" stroke="#38bdf8" opacity="0.08" strokeWidth="0.2" />
            <polyline points={getGraticulePath(false, 0, true)} fill="none" stroke="#38bdf8" opacity="0.08" strokeWidth="0.2" />

            {/* Front Landmass Solid Dots (Optimized static mapping) */}
            {PROJECTED_INFRA_FRONT.map((p, i) => (
              <g key={`flF${i}`} opacity="0.8">
                <circle cx={p.x} cy={p.y} r="2.0" fill="#024068" opacity="0.4" />
                <circle cx={p.x} cy={p.y} r="0.6" fill="#0ea5e9" opacity="0.6" />
              </g>
            ))}

            {/* Attack Arcs */}
            {arcs.map((arc, i) => {
              if (!arc.sFront && !arc.tFront) return null; // Entirely in back
              
              const mx = (arc.sx + arc.tx) / 2;
              const my = (arc.sy + arc.ty) / 2;
              const dist = Math.hypot(arc.tx - arc.sx, arc.ty - arc.sy);
              
              // 3D Orbital curve simulation
              const angle = Math.atan2(arc.ty - arc.sy, arc.tx - arc.sx) - Math.PI/2;
              const offset = (arc.sx > arc.tx ? 1 : -1) * dist * 0.35;
              const cpx = mx + Math.cos(angle) * offset;
              const cpy = my + Math.sin(angle) * offset;
              
              const color = arc.sev === 'CRITICAL' ? '#f43f5e' : '#f59e0b';
              const dur = arc.sev === 'CRITICAL' ? 1.4 : 2.0;

              return (
                <g key={`Farc${arc.id}`}>
                  {/* Arc Orbit Shadow Loop */}
                  <path d={`M${arc.sx} ${arc.sy} Q${cpx} ${cpy} ${arc.tx} ${arc.ty}`}
                    fill="none" stroke={color} strokeWidth={arc.sev === 'CRITICAL' ? '0.4' : '0.2'} opacity="0.15" />
                  
                  {/* Active 3D Projectile (Hardware optimized, no heavy filters) */}
                  <path d={`M${arc.sx} ${arc.sy} Q${cpx} ${cpy} ${arc.tx} ${arc.ty}`}
                    fill="none" stroke={color}
                    strokeWidth={arc.sev === 'CRITICAL' ? '1.6' : '1.2'}
                    strokeDasharray={`${arc.sev === 'CRITICAL' ? 15 : 10} 250`} strokeLinecap="round"
                    style={{
                      animation: `arcFlow ${dur}s cubic-bezier(0.3, 0.1, 0.7, 1) ${(i*0.35).toFixed(2)}s infinite`
                    }}
                  />
                </g>
              )
            })}

            {/* Hub Nodes (Projected to Front) */}
            {nodes.filter(n => n.isFront).map(pt => {
              const x = pt.proj.x;
              const y = pt.proj.y;
              const regionInc = visibleIncidents.filter(i => i.region === pt.region)
              const hasCrit = regionInc.some(i => i.sev === 'CRITICAL')
              const hasHigh = regionInc.some(i => i.sev === 'HIGH')
              const isActive = (activeIncidentId != null && regionInc.some(i => i.id === activeIncidentId)) || selectedEventRegion === pt.region
              const isTarget = regionInc.length > 0;
              const isFiltered = mapFilter === pt.region;
              
              const color = hasCrit ? '#f43f5e' : hasHigh ? '#f59e0b' : regionInc.length > 0 ? '#eab308' : isFiltered ? '#22d3ee' : '#38bdf8';

              return (
                <g key={pt.region} onClick={() => onMapClick(pt.region)} style={{ cursor: 'crosshair' }} className="transition-all duration-300">
                  {/* Optimized Critical Target Pulses */}
                  {hasCrit && (
                    <>
                      <circle cx={x} cy={y} r="10" fill="#f43f5e" opacity="0.2" />
                      <circle cx={x} cy={y} r="16" fill="#f43f5e" opacity="0.08" />
                      <circle cx={x} cy={y} r="8" fill="none" stroke="#f43f5e" strokeWidth="0.4" opacity="0.8" style={{ animation: 'nodeRingPulse 2.5s ease-out infinite' }} />
                    </>
                  )}
                  
                  {/* Clean Holographic Base */}
                  <circle cx={x} cy={y} r={4} fill={color} opacity={0.2} />
                  <circle cx={x} cy={y} r={isTarget || isActive || isFiltered ? 1.5 : 0.8} fill={color} opacity={isTarget || isActive || isFiltered ? 1.0 : 0.6} />
                  
                  {/* Edge Highlighting */}
                  {(isTarget || isActive) && <rect x={x-0.5} y={y-0.5} width="1" height="1" fill="#ffffff" opacity="0.9" />}

                  {/* Premium Elegant Labeling */}
                  <g style={{ pointerEvents: 'none' }}>
                     {(isTarget || isActive || isFiltered) && (
                      <path d={`M${x+1.5} ${y-1.5} L${x+4} ${y-4} L${x+10} ${y-4}`} fill="none" stroke={color} strokeWidth="0.25" opacity="0.6" />
                     )}
                     <text x={(isTarget || isActive || isFiltered) ? x+10.5 : x} y={(isTarget || isActive || isFiltered) ? y-3.5 : y-3} textAnchor={(isTarget || isActive || isFiltered) ? "start" : "middle"}
                      fontSize={(isTarget || isActive || isFiltered) ? "2.6" : "2.0"} fontFamily="sans-serif" 
                      fontWeight={(isTarget || isActive || isFiltered) ? "600" : "400"}
                      letterSpacing="0.2"
                      fill={hasCrit ? '#fca5a5' : isTarget ? '#fef08a' : isFiltered ? '#7dd3fc' : '#64748b'}
                      style={{ textShadow: (isTarget || hasCrit) ? '0 1px 2px rgba(0,0,0,0.8)' : 'none' }}>
                      {pt.region}
                    </text>
                  </g>
                </g>
              )
            })}
          </g>

          {/* Globe Surface Outer Atmosphere & Shine */}
          <circle cx="0" cy="0" r={GLOBE_R} fill="url(#sphere-atmosphere)" style={{ pointerEvents: 'none' }} />
          
          {/* Subtle Outer Boundary Ring */}
          <circle cx="0" cy="0" r={GLOBE_R+1} fill="none" stroke="#0ea5e9" strokeWidth="0.4" opacity="0.3" style={{ pointerEvents: 'none' }} />
          <circle cx="0" cy="0" r={GLOBE_R+2} fill="none" stroke="#0ea5e9" strokeWidth="1.5" opacity="0.05" style={{ pointerEvents: 'none' }} />

        </svg>
      </div>
    </section>
  )
})
GlobalMapPanel.displayName = 'GlobalMapPanel'





const LiveTelemetryStream = React.memo(({ visibleEvents, selectedEventId, mapFilter, onEventSelect }: { visibleEvents: ThreatEvent[], selectedEventId: string | null, mapFilter: string | null, onEventSelect: (id: string) => void }) => (
  <Frame title={`Live Telemetry Stream ${mapFilter ? `[FILTER: ${mapFilter}]` : ''}`} className="flex-1 min-h-0" headerClass="bg-[#010101]">
    <div className="flex-1 overflow-auto custom-scrollbar -m-3 mt-0">
      <table className="w-full text-left border-collapse whitespace-nowrap table-fixed">
        <thead className="sticky top-0 bg-[#010203] border-b border-[#0a121a] z-10 shadow-sm">
          <tr>
            <th className="py-2 px-3 text-[8px] w-20 uppercase tracking-widest text-slate-600 font-normal border-r border-[#0a121a]">TIME</th>
            <th className="py-2 px-3 text-[8px] w-12 uppercase tracking-widest text-slate-600 font-normal border-r border-[#0a121a]">SEV</th>
            <th className="py-2 px-3 text-[8px] w-48 uppercase tracking-widest text-slate-600 font-normal border-r border-[#0a121a]">SIGNATURE</th>
            <th className="py-2 px-3 text-[8px] w-32 uppercase tracking-widest text-slate-600 font-normal border-r border-[#0a121a]">ORIGIN</th>
            <th className="py-2 px-3 text-[8px] w-32 uppercase tracking-widest text-slate-600 font-normal border-r border-[#0a121a]">DEST (NODE)</th>
            <th className="py-2 px-3 text-[8px] uppercase tracking-widest text-slate-600 font-normal">REGION</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#05080c] font-mono">
          {visibleEvents.map((evt) => {
            const isSelected = selectedEventId === evt.id
            return (
              <tr 
                key={evt.id} 
                onClick={() => onEventSelect(evt.id)}
                className={`cursor-pointer transition-colors group border-l-[3px] ${isSelected ? 'bg-[#030912] border-cyan-500' : 'hover:bg-[#03070b] border-transparent'}`}
              >
                <td className="py-1.5 px-3 text-[9px] text-slate-600 tabular-nums border-r border-[#05080c] group-hover:text-cyan-600">{formatTime(evt.timestamp)}</td>
                <td className="py-1.5 px-3 border-r border-[#05080c]">
                  <span className={`w-1.5 h-1.5 inline-block rounded-none ${THEME.severity[evt.sev].bg}`}></span>
                </td>
                <td className={`py-1.5 px-3 text-[9px] truncate border-r border-[#05080c] ${evt.sev === 'CRITICAL' ? 'text-rose-200 font-bold' : evt.sev === 'HIGH' ? 'text-amber-200' : 'text-slate-400'}`}>{evt.type}</td>
                <td className="py-1.5 px-3 text-[9px] text-cyan-800 tabular-nums border-r border-[#05080c] group-hover:text-cyan-500">{evt.source}</td>
                <td className="py-1.5 px-3 text-[9px] text-slate-500 tabular-nums border-r border-[#05080c]"><span className="text-slate-700 mr-1">[{evt.protocol}]</span>{evt.node}</td>
                <td className="py-1.5 px-3 text-[8px] text-slate-700 truncate">{evt.region}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </Frame>
))
LiveTelemetryStream.displayName = 'LiveTelemetryStream'

const TriageQueuePanel = React.memo(({ visibleIncidents, activeIncidentId, mapFilter, onIncidentSelect }: { visibleIncidents: Incident[], activeIncidentId: string | null, mapFilter: string | null, onIncidentSelect: (id: string) => void }) => (
  <Frame title={`Triage Queue ${mapFilter ? `[${mapFilter}]` : ''}`} className="flex-1 min-h-0 border-[#1a1c23]">
    <div className="flex flex-col gap-1.5 overflow-auto custom-scrollbar -m-3 p-3">
      {visibleIncidents.map((inc) => {
        const isActive = activeIncidentId === inc.id
        return (
          <button 
            key={inc.id} 
            onClick={() => onIncidentSelect(inc.id)}
            className={`group flex flex-col bg-[#020509] border text-left hover:bg-[#04080e] transition-colors cursor-crosshair ${isActive ? 'border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'border-[#1a2c3f]'} border-l-4 ${inc.sev === 'CRITICAL' ? 'border-l-rose-500' : inc.sev === 'HIGH' ? 'border-l-amber-500' : 'border-l-yellow-500'}`}
          >
            <div className="p-2.5 w-full">
              <div className="flex justify-between items-start mb-1.5">
                  <SevTag sev={inc.sev} solid={inc.sev === 'CRITICAL'} />
                  {inc.status === 'CONTAINED' ? (
                    <span className="text-[9px] font-mono font-bold text-emerald-500">CONTAINED</span>
                  ) : (
                    <span className={`text-[9px] font-mono font-bold ${inc.sla < 900 ? 'text-rose-500 animate-[pulse_2s_ease-in-out_infinite]' : 'text-slate-500'}`}>T-{formatSLA(inc.sla)}</span>
                  )}
              </div>
              <span className={`font-bold text-[11px] uppercase tracking-wide truncate mb-1 block ${inc.sev === 'CRITICAL' ? 'text-rose-100' : 'text-slate-300'}`}>{inc.label}</span>
              <div className="flex justify-between text-[9px] font-mono mt-2 opacity-80">
                <span className="text-slate-500">SRC: <span className={inc.sev==='CRITICAL'?'text-rose-400':'text-cyan-600'}>{inc.source}</span></span>
                <span className="text-slate-500">TGT: <span className="text-slate-400">{inc.node}</span></span>
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

const InvestigationConsolePanel = React.memo(({ 
  activeIncident, 
  selectedEventInfo, 
  correlatedEvents,
  onInvestigate,
  onIsolate,
  onDismiss,
  onPromote,
  onClearSelection
}: { 
  activeIncident: Incident | undefined, 
  selectedEventInfo: ThreatEvent | undefined, 
  correlatedEvents: ThreatEvent[],
  onInvestigate: (id: string) => void,
  onIsolate: (id: string, node: string, source: string) => void,
  onDismiss: (id: string) => void,
  onPromote: (e: ThreatEvent) => void,
  onClearSelection: () => void
}) => {

  if (!activeIncident && !selectedEventInfo) {
    return (
      <div className="flex-1 flex items-center justify-center text-[10px] uppercase font-mono text-slate-600 tracking-widest p-8 text-center border-t border-[#121E2D]">
        Select an incident from the triage queue or an event from telemetry stream to begin correlation workflows.
      </div>
    )
  }

  if (selectedEventInfo) {
    return (
      <div className="flex flex-col h-full overflow-hidden text-sm">
        <div className="bg-[#05080c] p-3 border-b border-[#0a121a]">
            <div className="flex justify-between items-start mb-2">
              <SevTag sev={selectedEventInfo.sev} />
              <span className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 bg-slate-800 text-slate-400">TELEMETRY EVENT</span>
            </div>
            <h3 className="font-bold text-slate-100 text-[12px] uppercase tracking-wide leading-tight mb-3 text-cyan-200">{selectedEventInfo.type}</h3>
            
            <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
              <div className="flex flex-col border border-[#1a2c3f] bg-[#010203] p-1.5">
                  <span className="text-slate-600 uppercase mb-0.5">Source IP</span>
                  <span className="text-cyan-500">{selectedEventInfo.source}</span>
              </div>
              <div className="flex flex-col border border-[#1a2c3f] bg-[#010203] p-1.5">
                  <span className="text-slate-600 uppercase mb-0.5">Dest Node</span>
                  <span className="text-rose-400">{selectedEventInfo.node}</span>
              </div>
              <div className="flex flex-col border border-[#1a2c3f] bg-[#010203] p-1.5">
                  <span className="text-slate-600 uppercase mb-0.5">Region</span>
                  <span className="text-slate-300">{selectedEventInfo.region}</span>
              </div>
              <div className="flex flex-col border border-[#1a2c3f] bg-[#010203] p-1.5">
                  <span className="text-slate-600 uppercase mb-0.5">Protocol</span>
                  <span className="text-amber-500">{selectedEventInfo.protocol} / {selectedEventInfo.port}</span>
              </div>
            </div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar p-3 flex flex-col gap-4">
            <div>
              <h4 className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mb-2 border-b border-[#0a121a] pb-1">Event Centered Forensics</h4>
              <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                This isolated event was captured at {formatTime(selectedEventInfo.timestamp)}. It has not yet been correlated into a high-severity incident cluster. If activity persists or manual correlation is confirmed, promote this to a full tracking incident.
              </p>
            </div>
            
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <button 
                onClick={() => onPromote(selectedEventInfo)}
                className="w-full bg-cyan-900/60 hover:bg-cyan-700 border border-cyan-500/50 text-cyan-100 text-[10px] font-mono font-bold uppercase tracking-widest py-2.5 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              >
                Promote to Incident
              </button>
              <button 
                onClick={onClearSelection}
                className="w-full bg-[#05080c] hover:bg-[#0a121a] border border-[#1a2c3f] text-slate-400 hover:text-slate-200 text-[10px] font-mono font-bold uppercase tracking-widest py-2 transition-colors"
              >
                Clear Selection
              </button>
            </div>
        </div>
      </div>
    )
  }

  if (activeIncident) {
    const isActionable = activeIncident.status !== 'CONTAINED' && activeIncident.status !== 'FALSE_POSITIVE' && activeIncident.status !== 'RESOLVED'
    
    return (
      <div className="flex flex-col h-full overflow-hidden text-sm">
        <div className="bg-[#05080c] p-3 border-b border-[#0a121a] flex-none">
            <div className="flex justify-between items-start mb-2">
              <SevTag sev={activeIncident.sev} solid={true} />
              <span className={`text-[9px] font-mono tracking-widest px-1.5 py-0.5 ${activeIncident.status === 'INVESTIGATING' ? 'bg-amber-900/40 text-amber-500 border border-amber-500/20' : activeIncident.status === 'CONTAINED' ? 'bg-emerald-900/40 text-emerald-500 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                STATE: {activeIncident.status}
              </span>
            </div>
            <h3 className="font-bold text-slate-100 text-[12px] uppercase tracking-wide leading-tight mb-3 text-rose-100">{activeIncident.label}</h3>
            
            <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
              <div className="flex flex-col border border-[#1a2c3f] bg-[#010203] p-1.5">
                  <span className="text-slate-600 uppercase mb-0.5">Adversary</span>
                  <span className="text-cyan-500">{activeIncident.source}</span>
              </div>
              <div className="flex flex-col border border-[#1a2c3f] bg-[#010203] p-1.5">
                  <span className="text-slate-600 uppercase mb-0.5">Compromise</span>
                  <span className="text-rose-400">{activeIncident.node}</span>
              </div>
            </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-3 flex flex-col gap-4">
            {/* Action Bar (If Open) */}
            {activeIncident.status === 'OPEN' && (
              <button 
                  onClick={() => onInvestigate(activeIncident.id)}
                  className="w-full bg-amber-900/40 hover:bg-amber-600 border border-amber-500/50 text-amber-100 text-[10px] font-mono font-bold uppercase tracking-widest py-2 transition-colors"
                >
                  Start Investigation
              </button>
            )}

            {/* Incident Timeline */}
            <div>
              <h4 className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mb-2 border-b border-[#0a121a] pb-1">Operational Timeline</h4>
              <div className="flex flex-col gap-2 relative border-l border-[#1a2c3f] ml-1.5 pl-3">
                {activeIncident.timeline.map((entry, idx) => (
                  <div key={entry.id} className="text-[9px] font-mono relative">
                      <div className={`absolute -left-[14px] top-1.5 w-1.5 h-1.5 rounded-full ${entry.type === 'CONTAINED' ? 'bg-emerald-500' : entry.type === 'INVESTIGATING' ? 'bg-amber-500' : entry.type === 'DETECTED' || entry.type === 'ALERT_OPENED' ? 'bg-rose-500' : 'bg-cyan-500'}`}></div>
                      <div className="text-slate-500 mb-0.5">{formatTime(entry.time)} <span className="text-slate-700">[{entry.type}]</span></div>
                      <div className={entry.type === 'CONTAINED' ? 'text-emerald-400' : 'text-slate-300'}>{entry.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          
            {/* Incident Correlated Events */}
            <div>
              <h4 className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mb-2 border-b border-[#0a121a] pb-1">Correlated Telemetry</h4>
              <div className="flex flex-col gap-1 border border-[#0a121a] bg-[#010203]">
                {correlatedEvents.length === 0 ? (
                  <span className="text-[9px] font-mono text-slate-600 p-2 text-center uppercase tracking-widest">No telemetry recorded</span>
                ) : (
                  correlatedEvents.map(evt => (
                    <div key={evt.id} className="flex flex-col p-1.5 text-[9px] font-mono border-l-2 border-[#1a2c3f] border-b border-[#0a121a] last:border-b-0 hover:bg-[#03060a]">
                        <div className="flex justify-between text-slate-500 mb-0.5">
                          <span>{formatTime(evt.timestamp)}</span>
                          <span>{evt.protocol}:{evt.port}</span>
                        </div>
                        <span className="text-slate-300 truncate">{evt.type}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
        </div>

        <div className="p-3 bg-[#010203] border-t border-[#0a121a] flex gap-2 flex-none">
            <button 
              onClick={() => onIsolate(activeIncident.id, activeIncident.node, activeIncident.source)}
              disabled={!isActionable}
              className="flex-1 bg-rose-900/60 hover:bg-rose-600 border border-rose-500/50 text-rose-100 text-[10px] font-mono font-bold uppercase tracking-widest py-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Isolate Grid
            </button>
            <button 
              onClick={() => onDismiss(activeIncident.id)}
              disabled={!isActionable}
              className="flex-1 bg-[#05080c] hover:bg-[#0a121a] border border-[#1a2c3f] text-slate-300 text-[10px] font-mono font-bold uppercase tracking-widest py-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Dismiss
            </button>
        </div>
      </div>
    )
  }

  return null
})
InvestigationConsolePanel.displayName = 'InvestigationConsolePanel'

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

export default function DashboardLayout() {
  const [mounted, setMounted] = useState<boolean>(false)
  
  // Storage State
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [events, setEvents] = useState<ThreatEvent[]>([])
  const [containedNodes, setContainedNodes] = useState<string[]>([])
  
  // View State
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [mapFilter, setMapFilter] = useState<string | null>(null)

  // Simulation Tick
  useEffect(() => {
    setMounted(true)
    
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
    const INTERVAL_MS = 1500
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
          return { ...inc, sla: Math.max(0, inc.sla - (INTERVAL_MS / 1000)) }
        }
        return inc
      }))
      
    }, INTERVAL_MS)
    
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

  const handleClearSelection = useCallback((): void => {
    setSelectedEventId(null)
    setActiveIncidentId(null)
  }, [])

  const handleMapClick = useCallback((region: string): void => {
    setMapFilter(prev => prev === region ? null : region)
  }, [])

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

  const handlePromoteToIncident = useCallback((event: ThreatEvent): void => {
    const newInc: Incident = {
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
         { id: `tp-3-${Date.now()}`, time: new Date().toISOString(), desc: 'Investigation started immediately', type: 'INVESTIGATING' }
      ]
    }
    setIncidents(prev => [newInc, ...prev])
    setSelectedEventId(null)
    setActiveIncidentId(newInc.id)
  }, [])

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================
  
  const visibleIncidents = useMemo(() => {
    let filtered = incidents.filter(i => i.status !== 'FALSE_POSITIVE' && i.status !== 'RESOLVED')
    if (mapFilter) filtered = filtered.filter(i => i.region === mapFilter)
    return filtered
  }, [incidents, mapFilter])

  const visibleEvents = useMemo(() => {
    let filtered = events
    if (mapFilter) filtered = filtered.filter(e => e.region === mapFilter)
    return filtered
  }, [events, mapFilter])

  const activeIncident = useMemo(() => incidents.find(i => i.id === activeIncidentId), [incidents, activeIncidentId])
  const selectedEventInfo = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId])
  
  const correlatedEvents = useMemo(() => {
    if (!activeIncident) return []
    return events
      .filter(e => e.source === activeIncident.source || e.node === activeIncident.node || e.region === activeIncident.region)
      .map(e => {
        let score = 0;
        if (e.source === activeIncident.source && e.node === activeIncident.node) score = 3
        else if (e.source === activeIncident.source || e.node === activeIncident.node) score = 2
        else if (e.region === activeIncident.region) score = 1
        return { event: e, score }
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return new Date(b.event.timestamp).getTime() - new Date(a.event.timestamp).getTime()
      })
      .map(item => item.event)
      .slice(0, 30) // give enough room for history
  }, [activeIncident, events])

  if (!mounted) return null

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-[#000102] text-slate-300 font-sans selection:bg-cyan-900 selection:text-cyan-50 flex flex-col">
      <div className="mx-auto flex w-full max-w-[2400px] flex-1 gap-2 p-2 overflow-hidden items-stretch">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: STATIC POSTURE                              */}
        {/* ========================================================= */}
        <aside className="w-[280px] flex-shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar hidden lg:flex">
          <SystemPosturePanel visibleCount={visibleIncidents.length} containedCount={containedNodes.length} />
          <GlobalMapFilters mapFilter={mapFilter} onMapClick={handleMapClick} />
        </aside>

        {/* ========================================================= */}
        {/* CENTER COLUMN: HIGH-FREQUENCY DOMAINS                     */}
        {/* ========================================================= */}
        <main className="flex-1 flex flex-col gap-2 min-w-0 h-full">
          <GlobalMapPanel 
             visibleIncidents={visibleIncidents}
             activeIncidentId={activeIncidentId}
             selectedEventRegion={selectedEventInfo?.region || null}
             mapFilter={mapFilter}
             onMapClick={handleMapClick}
          />
          <LiveTelemetryStream 
             visibleEvents={visibleEvents}
             selectedEventId={selectedEventId}
             mapFilter={mapFilter}
             onEventSelect={handleSelectEvent}
          />
        </main>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: ACTION STATIONS                             */}
        {/* ========================================================= */}
        <aside className="w-[360px] flex-shrink-0 flex flex-col gap-2 overflow-hidden hidden xl:flex">
          <TriageQueuePanel 
             visibleIncidents={visibleIncidents}
             activeIncidentId={activeIncidentId}
             mapFilter={mapFilter}
             onIncidentSelect={handleSelectIncident}
          />
          <Frame title="Investigation Console" className="flex-[1.5] bg-[#020202] border-[#1a1c23]" headerClass="bg-[#05080c] border-[#1a2c3f] text-cyan-600">
             <InvestigationConsolePanel 
                activeIncident={activeIncident}
                selectedEventInfo={selectedEventInfo}
                correlatedEvents={correlatedEvents}
                onInvestigate={handleInvestigate}
                onIsolate={handleIsolate}
                onDismiss={handleDismiss}
                onPromote={handlePromoteToIncident}
                onClearSelection={handleClearSelection}
             />
          </Frame>
        </aside>

      </div>
    </div>
  )
}
