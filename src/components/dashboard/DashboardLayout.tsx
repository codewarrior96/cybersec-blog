'use client'

import React, { ReactNode, useEffect, useState } from 'react'

// ============================================================================
// SYSTEM & THEME CONSTANTS 
// ============================================================================
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type AlertStatus = 'UNASSIGNED' | 'INVESTIGATING' | 'MITIGATED'
type Protocol = 'TCP' | 'UDP' | 'ICMP' | 'HTTP' | 'DNS'

interface Alert {
  id: string
  sev: Severity
  time: string
  label: string
  source: string
  node: string
  sla: number // represented in seconds for live countdown
}

interface ThreatEvent {
  id: string
  timestamp: string
  sev: Severity
  type: string
  src: string
  dst: string
  region: string
  status: AlertStatus
  protocol: Protocol
  port: number
}

const THEME = {
  fgMuted: 'text-slate-500',
  fgBase: 'text-slate-300',
  fgHigh: 'text-slate-100',
  border: 'border-[#0a121a]',
  borderLight: 'border-[#121f2b]',
  panelBg: 'bg-[#020509]/80',
  panelDim: 'bg-[#010204]/90',
  severity: {
    CRITICAL: { hex: '#f43f5e', text: 'text-rose-400', bg: 'bg-rose-500', doc: 'bg-rose-950/30' },
    HIGH: { hex: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-500', doc: 'bg-amber-950/30' },
    MEDIUM: { hex: '#eab308', text: 'text-yellow-400', bg: 'bg-yellow-500', doc: 'bg-yellow-950/20' },
    LOW: { hex: '#3b82f6', text: 'text-blue-500', bg: 'bg-blue-600', doc: 'bg-blue-950/10' },
  }
}

// ============================================================================
// DETERMINISTIC MOCK DATA
// ============================================================================
const INITIAL_ALERTS: Alert[] = [
  { id: 'ALT-9921', sev: 'CRITICAL', time: '14:22:01', label: 'Ransomware Payload Detonated', source: '10.0.4.15', node: 'FIN-DB-01', sla: 862 },
  { id: 'ALT-9920', sev: 'CRITICAL', time: '14:21:55', label: 'Unauthorized Domain Admin Access', source: '198.51.100.4', node: 'DC-02', sla: 2700 },
  { id: 'ALT-9919', sev: 'HIGH', time: '14:19:12', label: 'Egress Traffic Spike > 5GB', source: '10.0.8.22', node: 'DMZ-WEB', sla: 6495 },
  { id: 'ALT-9918', sev: 'MEDIUM', time: '14:15:00', label: 'Suspicious Powershell Exec', source: 'LCL-HOST', node: 'WKST-492', sla: 11400 },
]

const MOCK_EVENTS: ThreatEvent[] = Array.from({ length: 60 }).map((_, i) => ({
  id: `EVT-${10000 + i}`,
  timestamp: new Date(Date.now() - i * 15000).toISOString(),
  sev: i % 17 === 0 ? 'CRITICAL' : i % 7 === 0 ? 'HIGH' : i % 4 === 0 ? 'MEDIUM' : 'LOW',
  type: ['SYN Flood', 'SQL Injection Payload', 'C2 Beaconing', 'Auth Bypass', 'Large Data Exfil'][i % 5],
  src: `192.168.${i % 255}.${(i * 3) % 255}`,
  dst: `10.0.${(i * 7) % 255}.${(i * 2) % 255}`,
  region: ['US-EAST', 'EU-WEST', 'APAC', 'LATAM'][i % 4],
  status: i === 0 ? 'INVESTIGATING' : 'MITIGATED',
  protocol: ['TCP', 'UDP', 'HTTP', 'DNS'][i % 4] as Protocol,
  port: [443, 53, 80, 22, 3389][i % 5],
}))

const MOCK_MAP_POINTS = [
  { lat: 40.71, lng: -74.00, sev: 'CRITICAL', label: 'US-EAST' },
  { lat: 51.50, lng: -0.12, sev: 'HIGH', label: 'UK-LON' },
  { lat: 35.68, lng: 139.69, sev: 'MEDIUM', label: 'JP-TYO' },
  { lat: 1.35, lng: 103.81, sev: 'LOW', label: 'SG-SIN' },
  { lat: -23.55, lng: -46.63, sev: 'HIGH', label: 'BR-SAO' },
  { lat: 55.75, lng: 37.61, sev: 'CRITICAL', label: 'RU-MOW' },
  { lat: 39.90, lng: 116.40, sev: 'HIGH', label: 'CN-PEK' },
]

const HUB_COORD = { lat: 38.89, lng: -77.03 } // Target Hub (Washington DC)

// ============================================================================
// UTILS & FORMATTERS
// ============================================================================
const formatTime = (date: Date) => date.toISOString().split('T')[1].substring(0, 11)
const formatSLA = (seconds: number) => {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

const Frame = ({ title, children, rightAction, dim = false, className = '', headerClass = '' }: { title: string, children: ReactNode, rightAction?: ReactNode, dim?: boolean, className?: string, headerClass?: string }) => (
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

const SevTag = ({ sev, solid = false }: { sev: Severity, solid?: boolean }) => {
  const s = THEME.severity[sev]
  return (
    <span className={`inline-flex items-center justify-center px-1.5 py-[2px] text-[8px] font-bold tracking-widest uppercase ${solid ? s.bg + ' text-black' : s.doc + ' ' + s.text + ' border border-transparent'}`}>
      {sev}
    </span>
  )
}

// ============================================================================
// MODULES
// ============================================================================

const TacticalAlerts = ({ alerts }: { alerts: Alert[] }) => (
   <div className="flex flex-col gap-1.5 overflow-auto custom-scrollbar -m-3 p-3">
      {alerts.map((a) => (
        <div key={a.id} className={`group flex flex-col bg-[#020509] border-[0.5px] border-[#0a121a] hover:bg-[#04080e] transition-colors cursor-crosshair ${a.sev === 'CRITICAL' ? 'border-l-2 border-l-rose-500' : 'border-l-2 border-l-transparent'}`}>
          <div className="p-2.5">
            <div className="flex justify-between items-start mb-1.5">
               <SevTag sev={a.sev} solid={a.sev === 'CRITICAL'} />
               <span className={`text-[9px] font-mono font-bold ${a.sla < 900 ? 'text-rose-500 animate-[pulse_2s_ease-in-out_infinite]' : 'text-slate-500'}`}>T-{formatSLA(a.sla)}</span>
            </div>
            <span className={`font-bold text-[11px] uppercase tracking-wide truncate mb-1 block ${a.sev === 'CRITICAL' ? 'text-rose-100' : 'text-slate-300'}`}>{a.label}</span>
            <div className="flex justify-between text-[9px] font-mono mt-2 opacity-80">
              <span className="text-slate-500">SRC: <span className={a.sev==='CRITICAL'?'text-rose-400':'text-cyan-600'}>{a.source}</span></span>
              <span className="text-slate-500">TGT: <span className="text-slate-400">{a.node}</span></span>
            </div>
          </div>
        </div>
      ))}
   </div>
)

const ThreatMap = ({ tick }: { tick: number }) => (
  <div className="relative w-full h-full bg-[#000204] overflow-hidden flex items-center justify-center p-4">
    {/* Abstract Data Graticules */}
    <div className="absolute inset-0 pointer-events-none z-0 opacity-10">
       {Array.from({ length: 9 }).map((_, i) => (
         <div key={`h-${i}`} className="absolute w-full h-[1px] border-b border-solid border-cyan-900/30" style={{ top: `${(i+1)*10}%` }}></div>
       ))}
       {Array.from({ length: 19 }).map((_, i) => (
         <div key={`v-${i}`} className="absolute h-full w-[1px] border-r border-solid border-cyan-900/30" style={{ left: `${(i+1)*5}%` }}></div>
       ))}
    </div>
    
    {/* Hub Marker */}
    <div className="absolute z-10 w-2 h-2 bg-emerald-500 shadow-[0_0_15px_#10b981]" style={{ left: `${(HUB_COORD.lng + 180)*(100/360)}%`, top: `${(90 - HUB_COORD.lat)*(100/180)}%`, transform: 'translate(-50%, -50%)' }}></div>
    
    {/* Explicit Trajectories (SVG) */}
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible">
       {MOCK_MAP_POINTS.map((pt, i) => {
          if (pt.sev !== 'CRITICAL' && pt.sev !== 'HIGH') return null; // Authority: only critical flows get trajectories
          const hubX = (HUB_COORD.lng + 180) * (100 / 360)
          const hubY = (90 - HUB_COORD.lat) * (100 / 180)
          const x = (pt.lng + 180) * (100 / 360)
          const y = (90 - pt.lat) * (100 / 180)
          const color = THEME.severity[pt.sev].hex
          const isCritical = pt.sev === 'CRITICAL'
          const dashOffset = (tick * (isCritical ? 2 : 1)) % 100 // Smooth JS-driven dash animation to avoid CSS reflow intensity
          
          return (
             <g key={`traj-${i}`}>
               <path 
                 d={`M ${x} ${y} Q 50 ${Math.min(y, hubY)-20} ${hubX} ${hubY}`} 
                 fill="none" 
                 stroke={color} 
                 strokeWidth={isCritical ? "1.5" : "0.5"} 
                 opacity={isCritical ? "0.8" : "0.3"} 
                 strokeDasharray={isCritical ? "4 6" : "2 8"}
                 strokeDashoffset={-dashOffset}
                 vectorEffect="non-scaling-stroke"
               />
             </g>
          )
       })}
    </svg>

    {/* Map Data Nodes */}
    {MOCK_MAP_POINTS.map((pt, i) => {
      const x = (pt.lng + 180) * (100 / 360)
      const y = (90 - pt.lat) * (100 / 180)
      const color = THEME.severity[pt.sev as keyof typeof THEME.severity].hex
      const isCrit = pt.sev === 'CRITICAL'
      
      return (
        <div key={i} className="absolute z-30 flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair group" style={{ left: `${x}%`, top: `${y}%`}}>
          <div className="relative flex items-center justify-center">
            <div className={`w-[3px] h-[3px] z-10 ${isCrit?'shadow-[0_0_12px_#f43f5e]':''}`} style={{ backgroundColor: color }}></div>
            {isCrit && (
               <div className="absolute w-8 h-8 border border-rose-500/40 rounded-full animate-[ping_3s_ease-out_infinite] z-0 pointer-events-none"></div>
            )}
          </div>
          {/* Minimalist overlay on hover */}
          <div className="absolute top-3 flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-40">
            <div className="flex flex-col bg-[#010204]/95 px-1.5 py-1 border border-[#1a2c3f] shadow-xl">
              <span className="text-[8px] font-mono font-bold tracking-widest uppercase whitespace-nowrap" style={{ color }}>{pt.label}</span>
            </div>
          </div>
        </div>
      )
    })}

    {/* Slow deliberate scanline */}
    <div className="absolute inset-x-0 h-1 bg-gradient-to-b from-transparent via-cyan-900/20 to-transparent opacity-30 z-10 pointer-events-none" style={{ top: `${(tick*2)%100}%` }}></div>
  </div>
)

const LiveTelemetryStream = () => (
  <div className="flex-1 overflow-auto custom-scrollbar -m-3 mt-0">
    <table className="w-full text-left border-collapse whitespace-nowrap table-fixed">
      <thead className="sticky top-0 bg-[#010203] border-b border-[#0a121a] z-10">
        <tr>
          <th className="py-2 px-3 text-[8px] w-20 uppercase tracking-widest text-slate-600 font-normal border-r border-[#0a121a]">TIME</th>
          <th className="py-2 px-3 text-[8px] w-12 uppercase tracking-widest text-slate-600 font-normal border-r border-[#0a121a]">SEV</th>
          <th className="py-2 px-3 text-[8px] w-48 uppercase tracking-widest text-slate-600 font-normal border-r border-[#0a121a]">SIGNATURE</th>
          <th className="py-2 px-3 text-[8px] w-32 uppercase tracking-widest text-slate-600 font-normal border-r border-[#0a121a]">ORIGIN</th>
          <th className="py-2 px-3 text-[8px] w-32 uppercase tracking-widest text-slate-600 font-normal border-r border-[#0a121a]">DEST</th>
          <th className="py-2 px-3 text-[8px] uppercase tracking-widest text-slate-600 font-normal">PAYLOAD TRACE</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#05080c] font-mono">
        {MOCK_EVENTS.map((evt, idx) => (
          <tr key={evt.id} className="hover:bg-[#03070b] transition-colors group cursor-crosshair">
            <td className="py-1 px-3 text-[9px] text-slate-600 tabular-nums border-r border-[#05080c] group-hover:text-cyan-800">{evt.timestamp.split('T')[1].substring(0,8)}</td>
            <td className="py-1 px-3 border-r border-[#05080c]">
              <span className={`w-1 h-1 inline-block rounded-none ${THEME.severity[evt.sev].bg}`}></span>
            </td>
            <td className={`py-1 px-3 text-[9px] truncate border-r border-[#05080c] ${evt.sev === 'CRITICAL' ? 'text-rose-200' : 'text-slate-400'}`}>{evt.type}</td>
            <td className="py-1 px-3 text-[9px] text-cyan-800 tabular-nums border-r border-[#05080c] group-hover:text-cyan-600">{evt.src}</td>
            <td className="py-1 px-3 text-[9px] text-slate-500 tabular-nums border-r border-[#05080c]"><span className="text-slate-700 mr-1">[{evt.protocol}]</span>{evt.dst}</td>
            <td className="py-1 px-3 text-[8px] text-slate-700 truncate group-hover:text-slate-500">
               {Array.from({ length: 4 }).map((_, i) => Math.floor([123,456,789,321][i%4] * (idx+1)).toString(16).padStart(4, '0')).join(' ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

export default function DashboardLayout() {
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState<Date | null>(null)
  const [tick, setTick] = useState(0)
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS)

  useEffect(() => {
    setMounted(true)
    setTime(new Date())
    
    // Controlled deterministic live updates (1s tick)
    const interval = setInterval(() => {
      setTime(new Date())
      setTick(prev => prev + 1)
      // Decrement SLA timers slightly for realism without chaos
      setAlerts(prev => prev.map(a => ({ ...a, sla: Math.max(0, a.sla - 1) })))
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  if (!mounted) return null // Prevent hydration mismatch on initial render

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-[#010101] text-slate-300 font-sans selection:bg-cyan-900 selection:text-cyan-50 flex flex-col">
      
      {/* 3-COLUMN ARCHITECTURE */}
      <div className="mx-auto flex w-full max-w-[2400px] flex-1 gap-2 p-2 overflow-hidden items-stretch">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: DIMMED POSTURE (Asymmetrical hierarchy)     */}
        {/* ========================================================= */}
        <aside className="w-[300px] flex-shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1 hidden lg:flex">
          
          <Frame title="System Posture" dim={true} rightAction={<span className="text-[8px] text-slate-600 font-mono">SYS_OK</span>}>
             <div className="flex flex-col gap-3">
               <div className="flex justify-between items-end border-b border-[#0a121a] pb-1">
                 <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">Dwell Time</span>
                 <span className="text-sm text-cyan-800 font-mono tabular-nums">1.4h</span>
               </div>
               <div className="flex justify-between items-end border-b border-[#0a121a] pb-1">
                 <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">0-Day Sigs</span>
                 <span className="text-sm text-rose-800 font-mono tabular-nums">4</span>
               </div>
               <div className="flex justify-between items-end border-b border-[#0a121a] pb-1">
                 <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">Ingest Vol</span>
                 <span className="text-sm text-slate-500 font-mono tabular-nums">{12.4 + (tick%5)*0.1} TB</span>
               </div>
             </div>
          </Frame>

          <Frame title="Detection Funnel" dim={true}>
            <div className="flex flex-col gap-2.5 mt-1">
              {[
                { label: 'RAW INGESTION', val: '42.8M', pct: 100, c: 'bg-slate-800' },
                { label: 'FILTERED', val: '4.2M', pct: 40, c: 'bg-cyan-900/50' },
                { label: 'ANOMALIES', val: '14,242', pct: 15, c: 'bg-amber-900/50' },
                { label: 'CRITICAL', val: '142', pct: 5, c: 'bg-rose-900/50' }
              ].map((node, i) => (
                <div key={i} className="flex flex-col">
                  <div className="flex justify-between text-[8px] font-mono tabular-nums">
                    <span className="text-slate-600">{node.label}</span>
                    <span className="text-slate-500">{node.val}</span>
                  </div>
                  <div className="h-[1px] w-full bg-[#05080c] mt-1">
                    <div className={`h-full ${node.c}`} style={{ width: `${node.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </Frame>
          
          <div className="flex-1 min-h-[100px] border border-[#0a121a] bg-[#010203] flex items-center justify-center">
             <span className="text-[8px] text-slate-800 font-mono rotate-[-90deg] tracking-[0.3em]">SENSOR_GRID_IDLE</span>
          </div>

        </aside>

        {/* ========================================================= */}
        {/* CENTER COLUMN: DOMINANT MAP & TELEMETRY STREAM            */}
        {/* ========================================================= */}
        <main className="flex-1 flex flex-col gap-2 min-w-0 h-full">

          {/* Deep Command Map Overlay */}
          <section className="flex-none h-[50%] lg:h-[65%] border border-[#1a1c23] bg-[#000102] flex flex-col relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 left-0 bg-[#000102]/90 border-b border-r border-[#0a121a] px-3 py-1.5 z-30 flex items-center gap-2">
               <span className="w-1.5 h-1.5 bg-rose-600"></span>
               <span className="font-bold uppercase tracking-[0.3em] text-[8px] text-slate-300">Global Threat Vector Map</span>
             </div>
             
             {/* Map Component */}
             <div className="flex-1 relative border-b border-[#0a121a]"><ThreatMap tick={tick} /></div>

             {/* Secondary Intelligence Layer (Subtle Timeline) */}
             <div className="h-[60px] bg-[#010204] z-30 px-3 py-1 flex justify-between items-end border-t border-[#0a121a]/50">
               <div className="flex flex-col mb-1 max-w-[150px]">
                  <span className="text-[8px] text-slate-600 uppercase tracking-widest font-mono mb-1">Time Trace</span>
                  <span className="text-[10px] text-cyan-800 font-mono">{time ? formatTime(time) : '00:00:00'} UTC</span>
               </div>
               
               <div className="flex items-end gap-[1px] h-8 flex-1 ml-8 overflow-hidden pointer-events-none opacity-60">
                 {Array.from({ length: 80 }).map((_, i) => {
                    const noise = Math.sin(i * 0.5 + tick * 0.1) * 20 + 30
                    const isSpike = i === 65 || i === 42
                    const val = isSpike ? 90 + (tick%5) : noise
                    return (
                      <div key={i} className={`flex-1 ${isSpike ? 'bg-rose-900/80' : 'bg-[#0a1622]'}`} style={{ height: `${Math.max(2, val)}%` }}></div>
                    )
                 })}
               </div>
             </div>
          </section>

          {/* Raw Operational Table */}
          <Frame title="Telemetry Stream" className="flex-1 min-h-0" headerClass="bg-[#010101]" rightAction={<span className="text-[8px] font-mono text-cyan-900 border border-cyan-900/30 px-1 py-0.5">TAIL</span>}>
             <LiveTelemetryStream />
          </Frame>

        </main>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: TRIAGE & HIGH-INTENSITY ALERTS              */}
        {/* ========================================================= */}
        <aside className="w-[360px] flex-shrink-0 flex flex-col gap-2 overflow-hidden pr-1 hidden xl:flex pb-6">
          
          <Frame title="Active Triage Queue" className="flex-1 min-h-0 border-[#1a1c23]" headerClass="bg-[#020305]">
             <TacticalAlerts alerts={alerts} />
          </Frame>

          <Frame title="Correlation Intel" className="flex-none bg-[#020202] border-[#1a1c23]" headerClass="bg-[#050102] border-[#2a0810] text-rose-500/80">
             <div className="flex flex-col pt-1">
                <span className="text-[9px] font-mono text-rose-200 bg-rose-950/40 px-1.5 py-0.5 uppercase tracking-widest inline-flex w-fit mb-2">APT-29 Match</span>
                <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                  Novel payload matching MITRE T1059.001 executing on boundary nodes. Lateral movement probabilty 92%.
                </p>
                <div className="grid grid-cols-2 gap-[1px] mt-3 tracking-widest">
                   <div className="bg-[#05080c] p-1.5 flex flex-col">
                      <span className="text-[7px] text-slate-600 uppercase">Target</span>
                      <span className="text-[9px] text-cyan-600 font-mono">DMZ-WEB</span>
                   </div>
                   <div className="bg-[#05080c] p-1.5 flex flex-col">
                      <span className="text-[7px] text-slate-600 uppercase">Confidence</span>
                      <span className="text-[9px] text-rose-600 font-mono">98.4%</span>
                   </div>
                </div>
                <div className="flex gap-1 mt-3">
                  <button className="flex-1 text-[9px] font-mono text-black bg-rose-600/90 py-1.5 hover:bg-rose-500 transition-colors uppercase tracking-widest">Isolate</button>
                  <button className="flex-1 text-[9px] font-mono text-slate-500 border border-[#0a121a] py-1.5 hover:bg-[#05080c] hover:text-slate-300 transition-colors uppercase tracking-widest">Dismiss</button>
                </div>
             </div>
          </Frame>

        </aside>

      </div>
    </div>
  )
}
