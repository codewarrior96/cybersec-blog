'use client'

import React, { ReactNode, useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { dispatchReportsUpdatedEvent } from '@/lib/reports-events'

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

interface ArcData {
  id: string
  sev: Severity
  src: { lat: number; lng: number; region: string }
  tgt: { lat: number; lng: number; region: string }
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
  { lat: 51.50, lng: -0.12,  region: 'UK-LON'  },
  { lat: 35.68, lng: 139.69, region: 'JP-TYO'  },
  { lat: 1.35,  lng: 103.81, region: 'SG-SIN'  },
  { lat: -23.55, lng: -46.63, region: 'BR-SAO' },
  { lat: 55.75, lng: 37.61,  region: 'RU-MOW'  },
  { lat: 39.90, lng: 116.40, region: 'CN-PEK'  },
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

  if (containedNodes.includes(source) || containedNodes.includes(node)) return null

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
// INCIDENT RESPONSE GUIDANCE
// ============================================================================

interface AttackGuidance {
  immediate: string[]
  analysis: string
  defense: string[]
  postIncident: string[]
}

const ACTION_GUIDANCE: Record<string, AttackGuidance> = {
  'Ransomware Payload Detonated': {
    immediate: [
      'Immediately isolate the affected system — disconnect LAN cable and disable Wi-Fi',
      'Do NOT power off the machine — preserve volatile forensic evidence in RAM',
      'Notify incident response team and security leadership immediately',
      'Identify and document all potentially encrypted or modified file paths',
      'Check for lateral movement to adjacent systems on the same subnet',
    ],
    analysis: 'Ransomware execution has been confirmed. The payload has detonated on the target node. This indicates successful initial compromise, privilege escalation, and payload delivery. The source IP must be traced to identify the full attack chain and determine if other nodes are at risk.',
    defense: [
      'Enforce application whitelisting to block unauthorized executable launch',
      'Implement immutable backup policies with air-gapped or offline copies',
      'Deploy endpoint detection and response (EDR) on all critical nodes',
      'Disable PowerShell and macros for standard users; audit privileged execution',
    ],
    postIncident: [
      'Acquire a full forensic disk image before any system restoration',
      'Trace the initial access vector — phishing, RDP brute force, or exploit',
      'Audit all privileged account activity in the 48 hours before detonation',
      'Notify regulatory bodies and legal if personal or sensitive data was exposed',
    ],
  },
  'C2 Beaconing': {
    immediate: [
      'Block the source IP at the firewall and DNS layer immediately',
      'Isolate the beaconing host from the network segment',
      'Capture a live memory dump from the compromised node before isolation',
      'Identify all processes making outbound connections on the affected host',
    ],
    analysis: 'An active command-and-control beacon has been detected. The endpoint is compromised and in two-way communication with an external threat actor. The attacker may already have persistent access and is likely in a reconnaissance or staging phase.',
    defense: [
      'Deploy DNS filtering and threat intelligence feeds to block C2 domains',
      'Implement strict egress filtering — only allow approved outbound ports',
      'Use network behavioral analysis (NBA) to detect periodic beaconing patterns',
      'Enable process-level network monitoring via EDR on all endpoints',
    ],
    postIncident: [
      'Perform full malware analysis on the identified C2 implant sample',
      'Audit all lateral movement paths from the compromised host',
      'Review DNS query logs for Domain Generation Algorithm (DGA) patterns',
      'Reset all credentials that were accessible from the compromised system',
    ],
  },
  'SQL Injection Payload': {
    immediate: [
      'Block the source IP at the WAF/firewall immediately',
      'Identify which database tables or records were accessed or modified',
      'Pull database audit logs for the last 24 hours from that source IP',
      'Check for unauthorized admin account creation or data exfiltration',
    ],
    analysis: 'An SQL injection payload has been detected targeting a database endpoint. The attacker is likely attempting to extract sensitive records, bypass authentication, execute OS commands, or establish a persistent database backdoor via a web shell or stored procedure.',
    defense: [
      'Enforce parameterized queries and prepared statements in all application code',
      'Deploy a WAF with SQL injection rulesets and enable blocking mode',
      'Apply principle of least privilege to all database user accounts',
      'Enable database activity monitoring (DAM) with anomaly alerting',
    ],
    postIncident: [
      'Audit all recently accessed or modified database records',
      'Check for unauthorized database user creation or privilege grants',
      'Rotate all database credentials and application secrets',
      'Run a full vulnerability scan on the application and database layer',
    ],
  },
  'Auth Bypass': {
    immediate: [
      'Revoke and reset the target account credentials immediately',
      'Enable MFA on all privileged accounts if not already enforced',
      'Review authentication logs for the last 72 hours for unauthorized sessions',
      'Check for new account creation or privilege escalation post-bypass',
    ],
    analysis: 'An authentication bypass has been detected. The attacker has likely gained unauthorized access to a privileged account or administrative interface. If successful, this can lead to lateral movement, data access, or persistence mechanisms being installed.',
    defense: [
      'Enforce multi-factor authentication (MFA) on all accounts, especially admin',
      'Implement Zero Trust Network Access (ZTNA) — never trust, always verify',
      'Enable continuous authentication and short session timeouts on sensitive systems',
      'Deploy Privileged Access Management (PAM) for all administrative accounts',
    ],
    postIncident: [
      'Audit all actions taken during the unauthorized session',
      'Review and tighten authentication policies across all exposed systems',
      'Notify affected users of potential account compromise',
      'Conduct a full Identity and Access Management (IAM) review',
    ],
  },
  'Large Data Exfil': {
    immediate: [
      'Block the destination IP/domain at the firewall immediately',
      'Terminate the active connection and preserve full packet capture logs',
      'Identify the data category and volume being transferred',
      'Isolate the source host — this is likely the final stage of an intrusion',
    ],
    analysis: 'A large-scale data exfiltration event is in progress. Significant volumes of data are being transferred to an external destination. This typically indicates the final stage of a multi-phase intrusion — the attacker has already achieved access and is extracting the objective.',
    defense: [
      'Deploy Data Loss Prevention (DLP) with content inspection on all egress points',
      'Implement strict egress filtering and bandwidth anomaly detection',
      'Classify and encrypt sensitive data at rest and in transit',
      'Enable UEBA (User and Entity Behavior Analytics) for data access anomalies',
    ],
    postIncident: [
      'Determine the exact dataset that was exfiltrated — records, classification',
      'Assess regulatory breach notification obligations (GDPR, KVKK, HIPAA)',
      'Trace the full attack timeline back to the initial breach point',
      'Engage legal and compliance teams for notification requirements',
    ],
  },
  'SYN Flood': {
    immediate: [
      'Enable SYN cookies on all affected network interfaces immediately',
      'Contact your ISP to request upstream traffic filtering and scrubbing',
      'Activate your DDoS mitigation appliance or cloud-based scrubbing service',
      'Implement source-IP rate limiting rules at the edge firewall',
    ],
    analysis: 'A SYN flood DDoS attack is targeting your infrastructure. The attacker is sending high volumes of TCP SYN packets to exhaust connection state tables and render services unreachable. This may be a cover for another ongoing intrusion activity.',
    defense: [
      'Deploy a purpose-built DDoS mitigation appliance or cloud scrubbing service',
      'Implement anycast routing to distribute and absorb attack traffic geographically',
      'Configure SYN cookies and TCP backlog queue tuning at the OS level',
      'Establish a BGP blackholing agreement with your ISP for emergency activation',
    ],
    postIncident: [
      'File a formal abuse report with the source IP network owners (WHOIS/ARIN)',
      'Review firewall and IPS rules — refine rate limiting thresholds',
      'Document peak traffic rates, affected services, and total downtime window',
      'Test DDoS mitigation runbooks and team response times in a tabletop exercise',
    ],
  },
  'default': {
    immediate: [
      'Isolate the affected system and preserve forensic evidence',
      'Block the source IP at the network perimeter firewall',
      'Notify the security operations team and escalate to incident response',
      'Document all observed indicators of compromise (IOCs)',
    ],
    analysis: 'A high-severity security event has been detected. The full scope requires immediate investigation. The source IP and target node should be correlated against recent telemetry to determine the attack vector and potential blast radius.',
    defense: [
      'Review and update firewall and IDS/IPS rules based on observed IOCs',
      'Ensure endpoint protection is fully deployed and signatures are current',
      'Conduct threat hunting across similar nodes in the affected region',
      'Implement additional logging and monitoring for similar attack patterns',
    ],
    postIncident: [
      'Complete a full post-incident review (PIR) within 24 hours',
      'Update threat intelligence feeds with new IOCs from this incident',
      'Patch any vulnerabilities that were exploited in this incident',
      'Brief stakeholders and update the incident response playbook',
    ],
  },
}

function generateReportContent(incident: Incident): string {
  const guidance = ACTION_GUIDANCE[incident.label] ?? ACTION_GUIDANCE['default']
  return `## Olay Özeti
**Olay ID:** ${incident.id}
**Saldırı Tipi:** ${incident.label}
**Şiddet:** ${incident.sev}
**Kaynak IP:** ${incident.source}
**Hedef Düğüm:** ${incident.node}
**Bölge:** ${incident.region}
**Tespit Zamanı:** ${incident.time}
**Rapor Oluşturma:** ${new Date().toISOString()}

## Anlık Eylem Planı
${guidance.immediate.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## Saldırı Analizi
${guidance.analysis}

## Savunma Önerileri
${guidance.defense.map((d, i) => `${i + 1}. ${d}`).join('\n')}

## Olay Sonrası Adımlar
${guidance.postIncident.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## Olay Zaman Çizelgesi
${incident.timeline.map(t => `- ${t.time.split('T')[1].substring(0, 8)} [${t.type}] ${t.desc}`).join('\n')}`
}

function getIncidentTags(incident: Incident): string[] {
  const tagMap: Record<string, string[]> = {
    'Ransomware Payload Detonated': ['ransomware', 'malware', 'critical'],
    'C2 Beaconing': ['c2', 'malware', 'persistence'],
    'SQL Injection Payload': ['sqli', 'injection', 'database'],
    'Auth Bypass': ['auth-bypass', 'credential', 'privilege-escalation'],
    'Large Data Exfil': ['exfiltration', 'data-loss', 'dlp'],
    'SYN Flood': ['ddos', 'dos', 'network'],
  }
  return tagMap[incident.label] ?? ['incident', incident.sev.toLowerCase()]
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

// Critical incident banner — only shown when CRITICAL incidents are active
const CriticalBanner = React.memo(({ criticalCount }: { criticalCount: number }) => (
  <div className="flex-none flex items-center gap-3 px-4 py-1 bg-rose-950/60 border-b border-rose-900/50">
    <span className="w-1.5 h-1.5 bg-rose-500 animate-ping inline-block flex-none"></span>
    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.22em] text-rose-300">
      {criticalCount} CRITICAL INCIDENT{criticalCount > 1 ? 'S' : ''} — IMMEDIATE RESPONSE REQUIRED
    </span>
    <span className="ml-auto text-[8px] font-mono text-rose-800 tracking-widest whitespace-nowrap">THREATCON CRITICAL</span>
  </div>
))
CriticalBanner.displayName = 'CriticalBanner'

// System posture — upgraded with threat level indicator
const SystemPosturePanel = React.memo(({ visibleCount, containedCount, criticalCount, eventRate }: {
  visibleCount: number
  containedCount: number
  criticalCount: number
  eventRate: number
}) => {
  const threatLevel = criticalCount > 0 ? 'CRITICAL' : visibleCount > 5 ? 'HIGH' : visibleCount > 2 ? 'ELEVATED' : 'GUARDED'
  const threatHex = criticalCount > 0 ? '#f43f5e' : visibleCount > 5 ? '#f59e0b' : visibleCount > 2 ? '#eab308' : '#164e63'
  const barPct = criticalCount > 0 ? '95%' : visibleCount > 5 ? '75%' : visibleCount > 2 ? '50%' : '22%'

  return (
    <Frame title="System Posture" dim={true} rightAction={
      <span className="text-[8px] font-mono text-emerald-700">● LIVE</span>
    }>
      <div className="flex flex-col gap-2.5">
        <div className="border border-[#0a121a] p-2 bg-[#010203]">
          <div className="text-[8px] text-slate-600 font-mono uppercase tracking-widest mb-1.5">Threat Level</div>
          <div className="text-[15px] font-bold font-mono tracking-[0.12em]" style={{ color: threatHex }}>{threatLevel}</div>
          <div className="h-[2px] w-full bg-[#0a0f15] mt-2">
            <div className="h-full transition-all duration-700" style={{ width: barPct, backgroundColor: threatHex }}></div>
          </div>
        </div>
        {([
          { label: 'Active Incidents', value: visibleCount, hex: visibleCount > 0 ? '#f59e0b' : '#1a3a1a' },
          { label: 'Critical Alerts',  value: criticalCount, hex: criticalCount > 0 ? '#f43f5e' : '#1a1a2a' },
          { label: 'Contained Nodes',  value: containedCount, hex: '#374151' },
          { label: 'Events / min',     value: eventRate, hex: '#164e63' },
        ] as const).map(({ label, value, hex }) => (
          <div key={label} className="flex justify-between items-end border-b border-[#0a121a] pb-1.5">
            <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">{label}</span>
            <span className="text-sm font-mono tabular-nums" style={{ color: hex }}>{value}</span>
          </div>
        ))}
      </div>
    </Frame>
  )
})
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

// Global map — upgraded with SVG attack arcs, larger nodes, radar sweep
const GlobalMapPanel = React.memo(({ visibleIncidents, activeIncidentId, selectedEventRegion, mapFilter, onMapClick, activeArcs }: {
  visibleIncidents: Incident[]
  activeIncidentId: string | null
  selectedEventRegion: string | null
  mapFilter: string | null
  onMapClick: (r: string) => void
  activeArcs: ArcData[]
}) => {
  const critVectors = activeArcs.filter(a => a.sev === 'CRITICAL').length
  const highVectors = activeArcs.filter(a => a.sev === 'HIGH').length

  return (
    <section className="flex-none h-[50%] border border-[#1a1c23] bg-[#000204] flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-3 py-1.5 bg-[#000204]/95 border-b border-[#0a121a] z-30">
        <span className="w-1.5 h-1.5 bg-rose-500 animate-ping flex-none"></span>
        <span className="font-bold uppercase tracking-[0.3em] text-[8px] text-slate-300">Global Threat Vector Map</span>
        <div className="ml-auto flex items-center gap-4 text-[8px] font-mono">
          {critVectors > 0 && <span className="text-rose-600">{critVectors} CRITICAL</span>}
          {highVectors > 0 && <span className="text-amber-800">{highVectors} HIGH</span>}
          <span className="text-slate-700">{activeArcs.length} VECTORS</span>
          <span className="text-slate-700">{MOCK_MAP_POINTS.length} NODES</span>
        </div>
      </div>

      {/* Map canvas */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#000204]">

        {/* Ambient radial glow */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{ background: 'radial-gradient(ellipse 65% 55% at 50% 55%, rgba(0,180,255,0.04) 0%, transparent 70%)' }}
        />

        {/* Horizontal scanlines */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,20,0.22) 3px, rgba(0,10,20,0.22) 4px)' }}
        />

        {/* Coordinate grid */}
        <div className="absolute inset-0 pointer-events-none z-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`h-${i}`} className="absolute w-full h-[1px]" style={{ top: `${(i+1)*11}%`, background: 'rgba(0,212,255,0.05)' }} />
          ))}
          {Array.from({ length: 17 }).map((_, i) => (
            <div key={`v-${i}`} className="absolute h-full w-[1px]" style={{ left: `${(i+1)*5.5}%`, background: 'rgba(0,212,255,0.04)' }} />
          ))}
        </div>

        {/* World SVG map image */}
        <img
          src="/world-lite.svg"
          alt=""
          className="absolute pointer-events-none object-contain z-5"
          style={{
            width: '93%',
            opacity: 0.42,
            filter: 'sepia(0.15) hue-rotate(188deg) saturate(280%) brightness(0.65)',
          }}
          onError={(e) => e.currentTarget.style.display = 'none'}
        />

        {/* SVG arc overlay — coordinate space matches node % positions */}
        <svg
          className="absolute inset-0 pointer-events-none z-15"
          style={{ width: '100%', height: '100%' }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {activeArcs.map((arc) => {
            const x1 = (arc.src.lng + 180) * (100 / 360)
            const y1 = (90 - arc.src.lat) * (100 / 180)
            const x2 = (arc.tgt.lng + 180) * (100 / 360)
            const y2 = (90 - arc.tgt.lat) * (100 / 180)
            const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
            const cx = (x1 + x2) / 2
            const cy = (y1 + y2) / 2 - dist * 0.28
            const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
            const isCrit = arc.sev === 'CRITICAL'
            const color = isCrit ? '#f43f5e' : '#f59e0b'
            const speed = isCrit ? '1.8s' : '2.8s'

            return (
              <g key={arc.id}>
                {/* Static glow trail */}
                <path d={d} fill="none" stroke={color} strokeWidth="0.5" strokeOpacity="0.1" pathLength="1" />
                {/* Traveling comet — animates via arcTravel keyframe in globals.css */}
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth="0.35"
                  strokeOpacity="0.9"
                  strokeLinecap="round"
                  pathLength="1"
                  strokeDasharray="0.18 0.82"
                  style={{ animation: `arcTravel ${speed} linear infinite` }}
                />
              </g>
            )
          })}
        </svg>

        {/* Radar sweep — CSS-only conic gradient spin */}
        <div
          className="absolute pointer-events-none z-10"
          style={{
            width: '130px', height: '130px',
            top: '40%', left: '46%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'conic-gradient(from 0deg, transparent 305deg, rgba(0,212,255,0.13) 345deg, rgba(0,212,255,0.04) 360deg)',
            animation: 'spin 12s linear infinite',
          }}
        />

        {/* Region nodes */}
        {MOCK_MAP_POINTS.map((pt, i) => {
          const x = (pt.lng + 180) * (100 / 360)
          const y = (90 - pt.lat) * (100 / 180)
          const regionIncidents = visibleIncidents.filter(inc => inc.region === pt.region)
          const hasCrit = regionIncidents.some(inc => inc.sev === 'CRITICAL')
          const hasHigh = regionIncidents.some(inc => inc.sev === 'HIGH')
          const nodeColor = hasCrit
            ? THEME.severity.CRITICAL.hex
            : hasHigh
            ? THEME.severity.HIGH.hex
            : regionIncidents.length > 0
            ? THEME.severity.MEDIUM.hex
            : '#0e3a5c'
          const isFiltered = mapFilter === pt.region
          const isHighlighted =
            (activeIncidentId ? regionIncidents.some(inc => inc.id === activeIncidentId) : false) ||
            selectedEventRegion === pt.region
          const nodeSize = hasCrit ? 10 : regionIncidents.length > 0 ? 8 : 5

          return (
            <button
              key={i}
              onClick={() => onMapClick(pt.region)}
              className="absolute z-30 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 group cursor-crosshair"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {/* Outer slow pulse for critical */}
              {hasCrit && (
                <span
                  className="absolute rounded-full border border-rose-500/20 animate-ping pointer-events-none"
                  style={{ width: '40px', height: '40px' }}
                />
              )}
              {/* Highlight ring for selected/filtered */}
              {(isHighlighted || isFiltered) && (
                <span
                  className="absolute rounded-full border border-cyan-400/50 animate-pulse pointer-events-none"
                  style={{ width: '22px', height: '22px' }}
                />
              )}
              {/* Node square */}
              <div
                className={`relative z-10 transition-all duration-100 ${isFiltered || isHighlighted ? 'scale-150' : 'group-hover:scale-125'}`}
                style={{
                  width: `${nodeSize}px`,
                  height: `${nodeSize}px`,
                  backgroundColor: nodeColor,
                  boxShadow: `0 0 ${hasCrit ? 18 : 8}px ${nodeColor}${hasCrit ? 'cc' : '88'}`,
                }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                <div
                  className={`bg-[#010204]/98 px-2 py-1.5 border flex flex-col gap-0.5 ${hasCrit ? 'border-rose-500/70' : 'border-[#1a2c3f]'}`}
                  style={{ boxShadow: hasCrit ? '0 0 10px rgba(244,63,94,0.2)' : 'none' }}
                >
                  <span className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: nodeColor }}>{pt.region}</span>
                  <span className="text-[8px] font-mono text-slate-500">{regionIncidents.length} INCIDENT{regionIncidents.length !== 1 ? 'S' : ''}</span>
                  {hasCrit && <span className="text-[8px] font-mono text-rose-500">⚠ CRITICAL ACTIVE</span>}
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
            const sevHex = THEME.severity[evt.sev].hex
            return (
              <tr
                key={evt.id}
                onClick={() => onEventSelect(evt.id)}
                className={`cursor-pointer transition-colors group border-l-[3px] ${isSelected ? 'bg-[#030912] border-cyan-500' : 'hover:bg-[#03070b] border-transparent'}`}
                style={{ borderLeftColor: isSelected ? undefined : (evt.sev === 'CRITICAL' || evt.sev === 'HIGH') ? `${sevHex}44` : undefined }}
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
  activeIncident: Incident | undefined
  selectedEventInfo: ThreatEvent | undefined
  correlatedEvents: ThreatEvent[]
  onInvestigate: (id: string) => void
  onIsolate: (id: string, node: string, source: string) => void
  onDismiss: (id: string) => void
  onPromote: (e: ThreatEvent) => void
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
          {activeIncident.status === 'OPEN' && (
            <button
              onClick={() => onInvestigate(activeIncident.id)}
              className="w-full bg-amber-900/40 hover:bg-amber-600 border border-amber-500/50 text-amber-100 text-[10px] font-mono font-bold uppercase tracking-widest py-2 transition-colors"
            >
              Start Investigation
            </button>
          )}
          <div>
            <h4 className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mb-2 border-b border-[#0a121a] pb-1">Operational Timeline</h4>
            <div className="flex flex-col gap-2 relative border-l border-[#1a2c3f] ml-1.5 pl-3">
              {activeIncident.timeline.map((entry) => (
                <div key={entry.id} className="text-[9px] font-mono relative">
                  <div className={`absolute -left-[14px] top-1.5 w-1.5 h-1.5 rounded-full ${entry.type === 'CONTAINED' ? 'bg-emerald-500' : entry.type === 'INVESTIGATING' ? 'bg-amber-500' : entry.type === 'DETECTED' || entry.type === 'ALERT_OPENED' ? 'bg-rose-500' : 'bg-cyan-500'}`}></div>
                  <div className="text-slate-500 mb-0.5">{formatTime(entry.time)} <span className="text-slate-700">[{entry.type}]</span></div>
                  <div className={entry.type === 'CONTAINED' ? 'text-emerald-400' : 'text-slate-300'}>{entry.desc}</div>
                </div>
              ))}
            </div>
          </div>
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
// CRITICAL ALERT PANEL — full-screen overlay for CRITICAL incidents
// ============================================================================

const CriticalAlertPanel = React.memo(({
  incident,
  onDismiss,
  onInvestigate,
  onCreateReport,
  submitting,
}: {
  incident: Incident
  onDismiss: (id: string) => void
  onInvestigate: (id: string) => void
  onCreateReport: (incident: Incident) => void
  submitting: boolean
}) => {
  const guidance = ACTION_GUIDANCE[incident.label] ?? ACTION_GUIDANCE['default']

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(15,0,5,0.88)', backdropFilter: 'blur(6px)' }}
    >
      {/* Red vignette pulse */}
      <div
        className="absolute inset-0 pointer-events-none animate-[pulse_2s_ease-in-out_infinite]"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(244,63,94,0.12) 100%)' }}
      />

      <div
        className="relative w-full max-w-2xl flex flex-col font-mono mx-4"
        style={{
          background: '#050002',
          border: '1px solid rgba(244,63,94,0.65)',
          boxShadow: '0 0 70px rgba(244,63,94,0.22), 0 0 140px rgba(244,63,94,0.08)',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b flex-none"
          style={{ borderColor: 'rgba(244,63,94,0.35)', background: 'rgba(244,63,94,0.07)' }}
        >
          <span className="w-2 h-2 bg-rose-500 animate-ping flex-none" />
          <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-rose-300">
            Critical Incident Detected
          </span>
          <span className="ml-auto text-[9px] font-mono text-rose-800">{incident.id}</span>
          <button
            onClick={() => onDismiss(incident.id)}
            className="text-slate-600 hover:text-slate-300 transition-colors ml-3 text-[12px]"
          >
            ✕
          </button>
        </div>

        {/* Incident summary */}
        <div className="px-4 py-3 border-b flex-none" style={{ borderColor: 'rgba(244,63,94,0.2)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-[14px] font-bold text-rose-100 uppercase tracking-wide leading-tight">
              {incident.label}
            </h2>
            <span className="text-[9px] font-bold px-2 py-0.5 bg-rose-500 text-black whitespace-nowrap flex-none">
              CRITICAL
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[9px]">
            {[
              { label: 'Source IP', value: incident.source, color: '#f87171' },
              { label: 'Target Node', value: incident.node, color: '#fbbf24' },
              { label: 'Region', value: incident.region, color: '#94a3b8' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col border border-[#1a0008] bg-[#080004] p-1.5">
                <span className="text-slate-600 uppercase mb-0.5">{label}</span>
                <span className="font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable guidance */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-4 min-h-0">
          {/* Immediate actions */}
          <div>
            <div className="text-[9px] text-rose-700 font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <span className="w-1 h-3 bg-rose-500 inline-block flex-none" />
              Immediate Actions Required
            </div>
            <ol className="space-y-1.5">
              {guidance.immediate.map((action, i) => (
                <li key={i} className="flex gap-2 text-[10px]">
                  <span className="text-rose-600 font-bold flex-none tabular-nums">{i + 1}.</span>
                  <span className="text-slate-300 leading-relaxed">{action}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Analysis */}
          <div>
            <div className="text-[9px] text-amber-700 font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <span className="w-1 h-3 bg-amber-500 inline-block flex-none" />
              Threat Analysis
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">{guidance.analysis}</p>
          </div>

          {/* Defense */}
          <div>
            <div className="text-[9px] text-cyan-700 font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <span className="w-1 h-3 bg-cyan-600 inline-block flex-none" />
              Defense Recommendations
            </div>
            <ol className="space-y-1.5">
              {guidance.defense.map((d, i) => (
                <li key={i} className="flex gap-2 text-[10px]">
                  <span className="text-cyan-800 font-bold flex-none tabular-nums">{i + 1}.</span>
                  <span className="text-slate-400 leading-relaxed">{d}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Action buttons */}
        <div
          className="flex gap-2 p-4 border-t flex-none"
          style={{ borderColor: 'rgba(244,63,94,0.2)', background: '#050002' }}
        >
          <button
            onClick={() => onInvestigate(incident.id)}
            className="flex-1 bg-amber-900/50 hover:bg-amber-700 border border-amber-500/50 text-amber-100 text-[10px] font-bold uppercase tracking-widest py-2.5 transition-colors"
          >
            Investigate Now
          </button>
          <button
            onClick={() => onCreateReport(incident)}
            disabled={submitting}
            className="flex-1 bg-rose-900/50 hover:bg-rose-700 border border-rose-500/60 text-rose-100 text-[10px] font-bold uppercase tracking-widest py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating…' : 'Create Sentinel Report →'}
          </button>
          <button
            onClick={() => onDismiss(incident.id)}
            className="px-4 bg-[#08000c] hover:bg-[#120010] border border-[#1a0020] text-slate-500 hover:text-slate-300 text-[10px] font-bold uppercase tracking-widest py-2.5 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
})
CriticalAlertPanel.displayName = 'CriticalAlertPanel'

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

  // Critical alert panel state
  const [acknowledgedCriticalIds, setAcknowledgedCriticalIds] = useState<Set<string>>(new Set())
  const [reportSubmitting, setReportSubmitting] = useState(false)

  const router = useRouter()

  // Simulation Tick
  useEffect(() => {
    setMounted(true)

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

    setEvents([...seedEvents, ...randomEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))

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
  // VIEW HANDLERS
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

  // Critical alert panel handlers
  const handleDismissCriticalAlert = useCallback((id: string): void => {
    setAcknowledgedCriticalIds(prev => { const s = new Set(prev); s.add(id); return s })
  }, [])

  const handleInvestigateCriticalAlert = useCallback((id: string): void => {
    setAcknowledgedCriticalIds(prev => { const s = new Set(prev); s.add(id); return s })
    setActiveIncidentId(id)
    setSelectedEventId(null)
  }, [])

  const handleCreateSentinelReport = useCallback(async (incident: Incident): Promise<void> => {
    setReportSubmitting(true)
    try {
      const content = generateReportContent(incident)
      const tags = getIncidentTags(incident)
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[${incident.sev}] ${incident.label} — ${incident.region}`,
          content,
          severity: incident.sev,
          tags,
        }),
      })
      if (res.ok) {
        dispatchReportsUpdatedEvent()
      }
    } catch {
      // navigate regardless
    } finally {
      setReportSubmitting(false)
      setAcknowledgedCriticalIds(prev => { const s = new Set(prev); s.add(incident.id); return s })
      router.push('/zafiyet-taramasi')
    }
  }, [router])

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
        let score = 0
        if (e.source === activeIncident.source && e.node === activeIncident.node) score = 3
        else if (e.source === activeIncident.source || e.node === activeIncident.node) score = 2
        else if (e.region === activeIncident.region) score = 1
        return { event: e, score }
      })
      .sort((a, b) => b.score !== a.score ? b.score - a.score : new Date(b.event.timestamp).getTime() - new Date(a.event.timestamp).getTime())
      .map(item => item.event)
      .slice(0, 30)
  }, [activeIncident, events])

  const criticalCount = useMemo(
    () => visibleIncidents.filter(i => i.sev === 'CRITICAL').length,
    [visibleIncidents]
  )

  // The first unacknowledged CRITICAL incident — drives the alert overlay
  const criticalAlertTarget = useMemo(
    () => incidents.find(
      i => i.sev === 'CRITICAL' &&
           i.status !== 'FALSE_POSITIVE' &&
           i.status !== 'RESOLVED' &&
           !acknowledgedCriticalIds.has(i.id)
    ) ?? null,
    [incidents, acknowledgedCriticalIds]
  )

  const eventRate = useMemo(() => {
    const cutoff = Date.now() - 60000
    return events.filter(e => new Date(e.timestamp).getTime() > cutoff).length
  }, [events])

  // Active attack arcs — derived from recent HIGH/CRITICAL events, deduped by region pair
  const activeArcs = useMemo((): ArcData[] => {
    const seen = new Set<string>()
    return events
      .filter(e => (e.sev === 'CRITICAL' || e.sev === 'HIGH') && e.region !== 'GLOBAL')
      .slice(0, 30)
      .map((e): ArcData | null => {
        const src = MOCK_MAP_POINTS.find(p => p.region === e.region)
        if (!src) return null
        const hash = e.node.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
        const candidates = MOCK_MAP_POINTS.filter(p => p.region !== e.region)
        if (candidates.length === 0) return null
        const tgt = candidates[hash % candidates.length]
        const key = `${src.region}→${tgt.region}`
        if (seen.has(key)) return null
        seen.add(key)
        return { id: e.id, sev: e.sev, src, tgt }
      })
      .filter((a): a is ArcData => a !== null)
      .slice(0, 10)
  }, [events])

  if (!mounted) return null

  return (
    <div className="relative h-[calc(100vh-64px)] bg-[#000102] text-slate-300 font-sans selection:bg-cyan-900 selection:text-cyan-50 flex flex-col overflow-hidden">
      {/* Critical incident overlay — blocks interaction until acknowledged */}
      {criticalAlertTarget && (
        <CriticalAlertPanel
          incident={criticalAlertTarget}
          onDismiss={handleDismissCriticalAlert}
          onInvestigate={handleInvestigateCriticalAlert}
          onCreateReport={handleCreateSentinelReport}
          submitting={reportSubmitting}
        />
      )}
      {criticalCount > 0 && <CriticalBanner criticalCount={criticalCount} />}
      <div className="mx-auto flex w-full max-w-[2400px] flex-1 gap-2 p-2 overflow-hidden items-stretch">

        {/* LEFT COLUMN: STATIC POSTURE */}
        <aside className="w-[280px] flex-shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar hidden lg:flex">
          <SystemPosturePanel
            visibleCount={visibleIncidents.length}
            containedCount={containedNodes.length}
            criticalCount={criticalCount}
            eventRate={eventRate}
          />
          <GlobalMapFilters mapFilter={mapFilter} onMapClick={handleMapClick} />
        </aside>

        {/* CENTER COLUMN: MAP + TELEMETRY */}
        <main className="flex-1 flex flex-col gap-2 min-w-0 h-full">
          <GlobalMapPanel
            visibleIncidents={visibleIncidents}
            activeIncidentId={activeIncidentId}
            selectedEventRegion={selectedEventInfo?.region || null}
            mapFilter={mapFilter}
            onMapClick={handleMapClick}
            activeArcs={activeArcs}
          />
          <LiveTelemetryStream
            visibleEvents={visibleEvents}
            selectedEventId={selectedEventId}
            mapFilter={mapFilter}
            onEventSelect={handleSelectEvent}
          />
        </main>

        {/* RIGHT COLUMN: ACTION STATIONS */}
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
