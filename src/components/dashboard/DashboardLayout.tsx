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

const GlobalMapPanel = React.memo(({ visibleIncidents, activeIncidentId, selectedEventRegion, mapFilter, onMapClick }: { visibleIncidents: Incident[], activeIncidentId: string | null, selectedEventRegion: string | null, mapFilter: string | null, onMapClick: (r: string) => void }) => {
  return (
    <section className="flex-none h-[50%] border border-[#1a1c23] bg-[#000102] flex flex-col relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 left-0 bg-[#000102]/90 border-b border-r border-[#0a121a] px-3 py-1.5 z-30 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-rose-600"></span>
        <span className="font-bold uppercase tracking-[0.3em] text-[8px] text-slate-300">Global Threat Vector Map</span>
      </div>
      
      <div className="flex-1 relative border-b border-[#0a121a] flex items-center justify-center bg-[#010306]">
          <div className="absolute inset-0 pointer-events-none z-0 opacity-10">
            {Array.from({ length: 9 }).map((_, i) => <div key={`h-${i}`} className="absolute w-full h-[1px] border-b border-solid border-cyan-900/30" style={{ top: `${(i+1)*10}%` }}></div>)}
            {Array.from({ length: 19 }).map((_, i) => <div key={`v-${i}`} className="absolute h-full w-[1px] border-r border-solid border-cyan-900/30" style={{ left: `${(i+1)*5}%` }}></div>)}
          </div>
          
          <img 
            src="/world-lite.svg" 
            alt="" 
            className="absolute w-[95%] opacity-[0.15] sepia-[.5] hue-rotate-[190deg] saturate-200 pointer-events-none object-contain z-10" 
            onError={(e) => e.currentTarget.style.display = 'none'}
          />

          {MOCK_MAP_POINTS.map((pt, i) => {
            const x = (pt.lng + 180) * (100 / 360)
            const y = (90 - pt.lat) * (100 / 180)
            
            const regionIncidents = visibleIncidents.filter(inc => inc.region === pt.region)
            const hasCrit = regionIncidents.some(inc => inc.sev === 'CRITICAL')
            const color = hasCrit ? THEME.severity.CRITICAL.hex : (regionIncidents.length > 0 ? THEME.severity.HIGH.hex : THEME.severity.LOW.hex)
            const isFiltered = mapFilter === pt.region
            
            const isActiveIncidentRegion = activeIncidentId ? regionIncidents.some(inc => inc.id === activeIncidentId) : false
            const isActiveEventRegion = selectedEventRegion === pt.region
            const isHighlighted = isActiveIncidentRegion || isActiveEventRegion

            return (
              <button 
                key={i} 
                onClick={() => onMapClick(pt.region)}
                className={`absolute z-30 flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 group cursor-crosshair transition-transform ${isFiltered || isHighlighted ? 'scale-150 z-40' : 'hover:scale-125'}`} 
                style={{ left: `${x}%`, top: `${y}%`}}
              >
                <div className="relative flex items-center justify-center">
                  <div className={`w-[4px] h-[4px] z-10 ${hasCrit?'shadow-[0_0_12px_#f43f5e]':''}`} style={{ backgroundColor: color }}></div>
                  {(hasCrit || isHighlighted) && (
                      <div className="absolute w-12 h-12 border border-rose-500/40 rounded-full animate-ping z-0 pointer-events-none"></div>
                  )}
                  {isFiltered && (
                      <div className="absolute w-6 h-6 border border-cyan-500/80 rounded-full animate-pulse z-0 pointer-events-none"></div>
                  )}
                </div>
                <div className="absolute top-4 flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-40">
                  <div className={`flex flex-col bg-[#010204]/95 px-2 py-1 border ${hasCrit ? 'border-rose-500' : 'border-[#1a2c3f]'}`}>
                    <span className="text-[9px] font-mono font-bold tracking-widest uppercase whitespace-nowrap" style={{ color }}>{pt.region}</span>
                    <span className="text-[8px] font-mono text-slate-500">{regionIncidents.length} INCIDENTS</span>
                  </div>
                </div>
              </button>
            )
          })}
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
