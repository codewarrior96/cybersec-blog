'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import ThreatGlobe from '@/components/ThreatGlobe'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PostMeta {
  slug: string
  title: string
  date: string
  tags?: string[]
  description?: string
  readingTime?: number
}

interface CVEItem {
  id: string
  description: string
  severity: string | null
  score: number | null
  published: string
}

interface NewsItem {
  title: string
  source: string
}

interface CountryThreat {
  name: string
  count: number
}

interface TagThreat {
  name: string
  count: number
}

interface GreyNoiseData {
  total: number
  countries: CountryThreat[]
  tags: TagThreat[]
}

interface AttackEvent {
  id: number
  time: string
  sourceIP: string
  sourceCountry: string
  targetPort: number
  type: string
  severity: 'critical' | 'high' | 'low'
}

interface Report {
  id: number
  title: string
  content: string
  severity: string
  tags: string[]
  createdAt: string
}

interface CommunityPost {
  id: string | number
  title: string
  author?: string
  category?: string
  likes?: unknown[]
  comments?: unknown[]
  createdAt?: string
}

interface SOCDashboardProps {
  posts: PostMeta[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTACK_TYPES = [
  'SSH Brute Force',
  'Port Scan',
  'SQL Injection',
  'RCE Attempt',
  'DDoS',
  'Phishing',
] as const

const COUNTRIES = ['China', 'Russia', 'Brazil', 'Germany', 'Iran', 'USA'] as const
const PORTS = [22, 80, 443, 3306, 5432, 8080, 8443, 6379]
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const ACTIVITY_HEIGHTS = [75, 45, 88, 60, 92, 30, 55]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateAttack(id: number): AttackEvent {
  const type = ATTACK_TYPES[rnd(0, ATTACK_TYPES.length - 1)]
  const country = COUNTRIES[rnd(0, COUNTRIES.length - 1)]
  const r = Math.random()
  const severity: 'critical' | 'high' | 'low' =
    r < 0.25 ? 'critical' : r < 0.65 ? 'high' : 'low'
  const port = PORTS[rnd(0, PORTS.length - 1)]
  const ip = `${rnd(1, 223)}.${rnd(0, 255)}.${rnd(0, 255)}.${rnd(1, 254)}`
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  return { id, time, sourceIP: ip, sourceCountry: country, targetPort: port, type, severity }
}

function severityColor(s: string | null): string {
  const u = (s ?? '').toUpperCase()
  if (u === 'CRITICAL') return '#ef4444'
  if (u === 'HIGH')     return '#f59e0b'
  if (u === 'MEDIUM')   return '#64748b'
  return '#00ff41'
}

function formatClock(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtSession(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function normalizeCountry(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PanelHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div style={{
      padding: '10px 16px',
      background: '#050508',
      borderBottom: '1px solid #1a2a1a',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{
        color: '#4d7c4d', fontSize: 12,
        fontFamily: 'monospace', letterSpacing: '0.2em',
      }}>
        {title}
      </span>
      {right}
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string | null }) {
  const color = severityColor(severity)
  return (
    <span style={{
      fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold',
      color, border: `1px solid ${color}50`,
      padding: '1px 5px', letterSpacing: '0.08em', flexShrink: 0,
    }}>
      {severity ?? 'N/A'}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SOCDashboard({ posts }: SOCDashboardProps) {
  const [now, setNow] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [cves, setCves] = useState<CVEItem[]>([])
  const [greynoise, setGreynoise] = useState<GreyNoiseData | null>(null)
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
  const [attacks, setAttacks] = useState<AttackEvent[]>([])
  const [selectedThreatCountry, setSelectedThreatCountry] = useState<CountryThreat | null>(null)
  const [reports, setReports] = useState<Report[]>([])

  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formSeverity, setFormSeverity] = useState('LOW')
  const [formContent, setFormContent] = useState('')
  const [formTags, setFormTags] = useState('')

  const attackCounter = useRef(0)
  const sessionStart = useRef(Date.now())

  // ── Clock & session timer ───────────────────────────────────────────────────
  useEffect(() => {
    setNow(new Date())
    setElapsed(0)
    const iv = setInterval(() => {
      setNow(new Date())
      setElapsed(Math.floor((Date.now() - sessionStart.current) / 1000))
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // ── Cybernews ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/cybernews')
      .then(r => r.json())
      .then((d: { items?: NewsItem[] }) => setNewsItems(d.items ?? []))
      .catch(() => {})
  }, [])

  // ── CVEs ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/cves?days=1')
      .then(r => r.json())
      .then((d: { cves?: CVEItem[] }) => setCves((d.cves ?? []).slice(0, 5)))
      .catch(() => {})
  }, [])

  // ── GreyNoise ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/greynoise')
      .then(r => r.json())
      .then((d: GreyNoiseData) => setGreynoise(d))
      .catch(() => {})
  }, [])

  // ── Community posts from localStorage ─────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('community_posts')
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setCommunityPosts((parsed as CommunityPost[]).slice(0, 4))
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // ── Live attack feed ───────────────────────────────────────────────────────
  useEffect(() => {
    const seed = Array.from({ length: 5 }, (_, i) => {
      attackCounter.current = i
      return generateAttack(i)
    })
    setAttacks(seed)

    const iv = setInterval(() => {
      attackCounter.current += 1
      const next = generateAttack(attackCounter.current)
      setAttacks(prev => [next, ...prev].slice(0, 8))
    }, 3000)

    return () => clearInterval(iv)
  }, [])

  // ── Reports ────────────────────────────────────────────────────────────────
  const fetchReports = useCallback(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then((d: { reports?: Report[] }) => setReports(d.reports ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCreateReport = async () => {
    if (!formTitle.trim() || !formContent.trim()) return
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formTitle,
        content: formContent,
        severity: formSeverity,
        tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
      }),
    })
    setFormTitle('')
    setFormContent('')
    setFormSeverity('LOW')
    setFormTags('')
    setShowForm(false)
    fetchReports()
  }

  const handleDeleteReport = async (id: number) => {
    await fetch('/api/reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchReports()
  }

  const handlePrintPDF = (report: Report) => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${report.title} — BREACH TERMINAL</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: monospace; background: #000; color: #00ff41; padding: 48px; margin: 0; }
    h1 { font-size: 13px; font-weight: bold; letter-spacing: 0.2em; border-bottom: 1px solid #1a2a1a; padding-bottom: 12px; margin-bottom: 16px; }
    .meta { font-size: 10px; color: #4d7c4d; margin-bottom: 24px; }
    .severity { color: ${severityColor(report.severity)}; font-weight: bold; }
    h2 { font-size: 16px; color: #e2e8f0; margin-bottom: 16px; }
    .content { font-size: 12px; line-height: 1.8; color: #94a3b8; white-space: pre-wrap; border: 1px solid #1a2a1a; padding: 16px; }
    .tags { margin-top: 20px; font-size: 10px; color: #446644; }
    .footer { margin-top: 48px; font-size: 9px; color: #1a3a1a; border-top: 1px solid #0f1a0f; padding-top: 10px; display: flex; justify-content: space-between; }
    @media print { body { background: #fff; color: #000; } .content { border-color: #ccc; } }
  </style>
</head>
<body>
  <h1>◈ BREACH TERMINAL — SECURITY REPORT</h1>
  <div class="meta">
    <span class="severity">[${report.severity}]</span>
    &nbsp;|&nbsp; ${new Date(report.createdAt).toLocaleString()}
    &nbsp;|&nbsp; REF: ${report.id}
  </div>
  <h2>${report.title}</h2>
  <div class="content">${report.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <div class="tags">TAGS: ${report.tags.join(', ') || '—'}</div>
  <div class="footer">
    <span>BREACH TERMINAL v2.0.26</span>
    <span>CONFIDENTIAL — SECURITY USE ONLY</span>
  </div>
</body>
</html>`)
    win.document.close()
    win.print()
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const tickerText = newsItems.length > 0
    ? newsItems.slice(0, 10).map(n => `[${n.source}] ${n.title}`).join('   ◈   ')
    : 'LOADING THREAT FEED...'

  const maxCountry = greynoise?.countries?.[0]?.count ?? 1
  const selectedCountryAttacks = useMemo(() => {
    if (!selectedThreatCountry) return []
    const countryKey = normalizeCountry(selectedThreatCountry.name)
    return attacks.filter((attack) => normalizeCountry(attack.sourceCountry) === countryKey).slice(0, 6)
  }, [attacks, selectedThreatCountry])

  const selectedCountrySeverity = useMemo(() => {
    return selectedCountryAttacks.reduce(
      (acc, attack) => {
        acc[attack.severity] += 1
        return acc
      },
      { critical: 0, high: 0, low: 0 },
    )
  }, [selectedCountryAttacks])

  // Derived from `now` state (client-only) to avoid SSR↔client mismatch
  // Sunday=0 → index 6 in MON…SUN array
  const todayIdx = now !== null ? (now.getDay() + 6) % 7 : -1

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="soc-shell" style={{ background: '#070710', minHeight: '100vh', fontFamily: 'monospace' }}>
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes glitch1 {
          0%,89%,100% { clip-path: inset(0 0 100% 0); transform: translateX(0); }
          90% { clip-path: inset(30% 0 50% 0); transform: translateX(-4px); color: #ff00ff; }
          92% { clip-path: inset(60% 0 20% 0); transform: translateX(4px);  color: #00ffff; }
          94% { clip-path: inset(0 0 100% 0); }
        }
        @keyframes glitch2 {
          0%,91%,100% { clip-path: inset(0 0 100% 0); transform: translateX(0); }
          92% { clip-path: inset(50% 0 30% 0); transform: translateX(4px);  color: #00ffff; }
          94% { clip-path: inset(20% 0 60% 0); transform: translateX(-4px); color: #ff00ff; }
          96% { clip-path: inset(0 0 100% 0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes liveBlink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.35; }
        }
        .soc-action:hover {
          border-color: rgba(0,255,65,0.7) !important;
          color: #00ff41 !important;
          background: rgba(0,255,65,0.06) !important;
        }
        .soc-post-card:hover { background: rgba(0,255,65,0.025) !important; }
        .soc-input {
          width: 100%; box-sizing: border-box;
          background: #050508; border: 1px solid #1a2a1a;
          color: #00ff41; font-family: monospace; font-size: 11px;
          padding: 6px 10px; outline: none;
        }
        .soc-input::placeholder { color: #1a3a1a; }
        .soc-input:focus { border-color: rgba(0,255,65,0.35); }
        .soc-top-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          padding: 14px;
          align-items: start;
        }
        .soc-card {
          background: #07070f;
          border: 1px solid #12301c;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
        }
        .soc-card:hover {
          border-color: rgba(0, 255, 65, 0.35);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35), 0 0 16px rgba(0, 255, 65, 0.08);
        }
        .soc-shell {
          overflow-x: hidden;
          padding-bottom: calc(62px + env(safe-area-inset-bottom));
        }
        .soc-hero {
          padding: 24px 24px 20px;
          border-bottom: 1px solid #1a2a1a;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
        }
        .soc-hero-left,
        .soc-hero-right {
          min-width: 0;
        }
        .soc-hero-right {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: flex-end;
        }
        .soc-hero-left > div:last-child {
          overflow-wrap: anywhere;
        }
        .soc-card > div:first-child {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-wrap: wrap;
          gap: 8px;
        }
        .soc-status-row,
        .soc-actions-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .soc-split-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: #1a2a1a;
          margin-top: 1px;
        }
        .soc-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1px;
          background: #1a2a1a;
          margin-top: 1px;
        }
        .soc-weekly-wrap {
          background: #08080f;
          border-top: 1px solid #1a2a1a;
          padding: 12px 16px 16px;
        }
        .soc-weekly-scroll {
          overflow-x: auto;
          scrollbar-width: none;
        }
        .soc-weekly-scroll::-webkit-scrollbar {
          display: none;
        }
        .soc-weekly-track {
          display: flex;
          align-items: flex-end;
          gap: 5px;
          height: 56px;
        }
        .soc-notes-wrap {
          margin-top: 1px;
          background: #08080f;
          border-top: 1px solid #1a2a1a;
          padding: 20px 24px;
        }
        .soc-notes-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        .soc-notes-grid {
          display: grid;
          grid-template-columns: 3fr 2fr;
          gap: 16px;
        }
        .soc-report-card {
          border: 1px solid #1a2a1a;
          background: #07070f;
          padding: 12px 14px;
        }
        .soc-report-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 7px;
        }
        .soc-report-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-top: 9px;
          flex-wrap: wrap;
        }
        .soc-report-meta-right {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .soc-form-actions {
          display: flex;
          gap: 6px;
        }
        .soc-threat-globe {
          margin-bottom: 14px;
        }
        .soc-threat-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
        }
        .soc-threat-drawer {
          margin-top: 10px;
          border: 1px solid #1a2a1a;
          background: rgba(6, 10, 12, 0.82);
          animation: slideIn 0.2s ease-out;
        }
        .soc-threat-drawer-head {
          padding: 8px 10px;
          border-bottom: 1px solid #1a2a1a;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .soc-threat-drawer-meta {
          padding: 7px 10px;
          border-bottom: 1px solid #112215;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .soc-threat-drawer-list {
          max-height: 160px;
          overflow-y: auto;
        }
        .soc-threat-drawer-list::-webkit-scrollbar {
          width: 6px;
        }
        .soc-threat-drawer-list::-webkit-scrollbar-thumb {
          background: #1a3a1a;
        }
        .soc-attack-feed {
          height: 200px;
          overflow-y: hidden;
        }
        .soc-attack-row {
          min-width: 0;
        }
        @media (min-width: 1024px) {
          .soc-shell { padding-bottom: 0; }
        }
        @media (max-width: 1300px) {
          .soc-top-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .soc-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 900px) {
          .soc-top-grid { grid-template-columns: 1fr; }
          .soc-top-grid { gap: 10px; padding: 10px; }
          .soc-hero {
            padding: 16px 14px 14px;
            gap: 12px;
          }
          .soc-hero > div:first-child > div:first-child > div {
            font-size: 18px !important;
            letter-spacing: 0.04em !important;
          }
          .soc-hero-right {
            width: 100%;
            align-items: flex-start;
          }
          .soc-status-row,
          .soc-actions-row {
            justify-content: flex-start;
          }
          .soc-split-grid { grid-template-columns: 1fr; }
          .soc-notes-wrap { padding: 14px 12px; }
          .soc-notes-grid { grid-template-columns: 1fr; }
          .soc-notes-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .soc-report-top {
            flex-wrap: wrap;
          }
          .soc-report-meta-right {
            width: 100%;
            justify-content: flex-start;
          }
        }
        @media (max-width: 640px) {
          .soc-card > div:first-child {
            padding: 9px 12px !important;
          }
          .soc-card > div:first-child span,
          .soc-card > div:first-child a {
            font-size: 10px !important;
          }
          .soc-action {
            font-size: 11px !important;
            padding: 4px 8px !important;
          }
          .soc-status-row > span {
            font-size: 10px !important;
            padding: 3px 8px !important;
          }
          .soc-notes-header > button {
            width: 100%;
          }
          .soc-split-grid > div > div {
            padding: 12px !important;
          }
          .soc-stats-grid { grid-template-columns: 1fr; }
          .soc-stats-grid > div > div:first-child {
            font-size: 24px !important;
          }
          .soc-stats-grid > div {
            padding: 14px 10px !important;
          }
          .soc-weekly-track {
            min-width: 560px;
          }
          .soc-attack-feed {
            height: 220px;
            overflow-y: auto;
          }
          .soc-threat-globe {
            margin-bottom: 12px;
          }
          .soc-threat-globe > div {
            height: 240px !important;
          }
          .soc-threat-globe > div > div:first-child {
            left: 50% !important;
          }
          .soc-threat-row > span:first-child {
            width: 54px !important;
            font-size: 10px !important;
          }
          .soc-threat-row > span:last-child {
            width: 30px !important;
            font-size: 10px !important;
          }
          .soc-threat-drawer-head,
          .soc-threat-drawer-meta {
            padding: 7px 8px;
          }
          .soc-threat-drawer-list {
            max-height: 200px;
          }
          .soc-attack-row {
            display: flex !important;
            flex-wrap: wrap !important;
            row-gap: 3px;
            column-gap: 6px;
            padding: 6px 12px !important;
          }
          .soc-attack-row > span {
            font-size: 10px !important;
          }
          .soc-attack-row > span:nth-child(1),
          .soc-attack-row > span:nth-child(2) {
            flex-shrink: 0 !important;
          }
          .soc-attack-row > span:nth-child(3) {
            width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .soc-attack-row > div {
            display: none;
          }
          .soc-notes-wrap > div:first-child > span {
            font-size: 11px !important;
            letter-spacing: 0.12em !important;
          }
          .soc-report-card > div:nth-child(2) {
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: clip !important;
          }
          .soc-form-actions {
            flex-direction: column;
          }
        }
      `}</style>

      {/* ══════════════════ TICKER BAR ══════════════════ */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: '#050508', borderBottom: '1px solid #1a2a1a',
        display: 'flex', alignItems: 'center',
        height: 30, overflow: 'hidden',
      }}>
        <span style={{
          flexShrink: 0, padding: '0 12px',
          color: '#f59e0b', fontSize: 12, fontFamily: 'monospace',
          letterSpacing: '0.15em', fontWeight: 'bold',
          borderRight: '1px solid #1a2a1a',
          height: '100%', display: 'flex', alignItems: 'center',
        }}>
          ◈ LIVE INTEL
        </span>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{
            display: 'inline-block', whiteSpace: 'nowrap',
            animation: 'tickerScroll 80s linear infinite',
          }}>
            <span style={{ color: 'rgba(0,255,65,0.55)', fontSize: 11, fontFamily: 'monospace', paddingLeft: 16 }}>
              {tickerText}&nbsp;&nbsp;&nbsp;&nbsp;{tickerText}
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════ HERO STATUS BAR ══════════════════ */}
      <div className="soc-hero">
        {/* Left */}
        <div className="soc-hero-left">
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
            <div style={{
              color: '#00ff41', fontSize: 26, fontWeight: 'bold',
              fontFamily: 'monospace', letterSpacing: '0.06em',
            }}>
              OPERATOR DASHBOARD
            </div>
            <div style={{
              position: 'absolute', inset: 0,
              color: '#ff00ff', opacity: 0.45, fontSize: 26, fontWeight: 'bold',
              fontFamily: 'monospace', letterSpacing: '0.06em',
              animation: 'glitch1 9s infinite', pointerEvents: 'none',
            }}>
              OPERATOR DASHBOARD
            </div>
            <div style={{
              position: 'absolute', inset: 0,
              color: '#00ffff', opacity: 0.45, fontSize: 26, fontWeight: 'bold',
              fontFamily: 'monospace', letterSpacing: '0.06em',
              animation: 'glitch2 9s infinite 0.6s', pointerEvents: 'none',
            }}>
              OPERATOR DASHBOARD
            </div>
          </div>
          <div style={{ color: '#4d7c4d', fontSize: 11, fontFamily: 'monospace', marginTop: 2, letterSpacing: '0.04em' }}>
            {now !== null ? formatClock(now) : ''}
          </div>
          <div style={{ color: '#00ff41', fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>
            <span style={{ color: '#4d7c4d' }}>ghost@breach-terminal</span>
            <span style={{ color: '#1a3a1a' }}>:</span>
            <span style={{ color: '#00ff41' }}>~$</span>
            <span style={{
              display: 'inline-block', width: 7, height: 13,
              background: '#00ff41', marginLeft: 5, verticalAlign: 'text-bottom',
              animation: 'liveBlink 1s step-end infinite',
            }} />
          </div>
        </div>

        {/* Right */}
        <div className="soc-hero-right">
          {/* Status pills */}
          <div className="soc-status-row">
            {[
              { label: '● ONLINE',            color: '#00ff41' },
              { label: '⚠ THREAT: ELEVATED',  color: '#f59e0b' },
              { label: '14 CVE TODAY',         color: '#ef4444' },
              { label: `SESSION: ${fmtSession(elapsed)}`, color: '#00ff41' },
            ].map(p => (
              <span key={p.label} style={{
                border: `1px solid ${p.color}55`,
                color: p.color, fontSize: 12,
                fontFamily: 'monospace', padding: '4px 12px',
                letterSpacing: '0.05em',
              }}>
                {p.label}
              </span>
            ))}
          </div>
          {/* Quick actions */}
          <div className="soc-actions-row">
            {[
              { label: '[+ WRITEUP]',   href: '/blog'             },
              { label: '[+ COMMUNITY]', href: '/community'        },
              { label: '[→ CVE RADAR]', href: '/cve-radar'        },
              { label: '[→ TIMELINE]',  href: '/breach-timeline'  },
            ].map(btn => (
              <Link
                key={btn.href}
                href={btn.href}
                className="soc-action"
                style={{
                  border: '1px solid rgba(0,255,65,0.25)',
                  color: 'rgba(0,255,65,0.65)', fontSize: 12,
                  fontFamily: 'monospace', padding: '4px 10px',
                  textDecoration: 'none', transition: 'all 0.15s ease',
                  letterSpacing: '0.04em',
                }}
              >
                {btn.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════ MAIN GRID (3 columns) ══════════════════ */}
      <div className="soc-top-grid">
        {/* PANEL A — Son Yazılar */}
        <div className="soc-card">
          <PanelHeader
            title="// SON YAZILAR"
            right={
              <Link href="/blog" style={{ color: '#4d7c4d', fontSize: 12, fontFamily: 'monospace', textDecoration: 'none', letterSpacing: '0.1em' }}>
                TÜMÜ →
              </Link>
            }
          />
          <div>
            {(posts || []).slice(0, 4).map(post => (
              <Link key={post.slug} href={`/blog/${post.slug}`} style={{ display: 'block', textDecoration: 'none' }}>
                <div
                  className="soc-post-card"
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid #0d1a0d',
                    transition: 'background 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    {post.tags?.[0] && (
                      <span style={{
                        fontSize: 11, fontFamily: 'monospace',
                        color: '#00cc44', border: '1px solid rgba(0,255,65,0.18)',
                        padding: '1px 5px', letterSpacing: '0.1em',
                      }}>
                        {post.tags[0].toUpperCase()}
                      </span>
                    )}
                    <div style={{
                      width: 5, height: 5, borderRadius: 9999,
                      background: '#00ff41', boxShadow: '0 0 4px #00ff41',
                    }} />
                  </div>
                  <div style={{
                    color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace',
                    fontWeight: 'bold', lineHeight: 1.4,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {post.title}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>
                      {post.date}
                    </span>
                    {post.readingTime && (
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>
                        {post.readingTime} dk
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {(posts || []).length === 0 && (
              <div style={{ padding: '24px 16px', color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>
                Henüz yazı yok.
              </div>
            )}
          </div>
        </div>

        {/* PANEL B — CVE Radar */}
        <div className="soc-card">
          <PanelHeader
            title="// CVE RADAR"
            right={
              <Link href="/cve-radar" style={{ color: '#4d7c4d', fontSize: 12, fontFamily: 'monospace', textDecoration: 'none', letterSpacing: '0.1em' }}>
                TÜM CVE&apos;LER →
              </Link>
            }
          />
          <div>
            {cves.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{
                    padding: '12px 16px', borderBottom: '1px solid #0d1a0d',
                    display: 'flex', flexDirection: 'column', gap: 7,
                  }}>
                    <div style={{ height: 8, background: '#1a2a1a', width: '55%' }} />
                    <div style={{ height: 7, background: '#0f1a0f', width: '88%' }} />
                  </div>
                ))
              : cves.map(cve => (
                  <div key={cve.id} style={{
                    padding: '10px 16px', borderBottom: '1px solid #0d1a0d',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 5,
                    }}>
                      <span style={{
                        color: '#00ff41', fontSize: 11,
                        fontFamily: 'monospace', fontWeight: 'bold',
                      }}>
                        {cve.id}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SeverityBadge severity={cve.severity} />
                        {cve.score !== null && (
                          <span style={{
                            color: '#f59e0b', fontSize: 15,
                            fontFamily: 'monospace', fontWeight: 'bold',
                          }}>
                            {cve.score.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      color: '#475569', fontSize: 11, fontFamily: 'monospace',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      {cve.description}
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* PANEL C — Community */}
        <div className="soc-card">
          <PanelHeader
            title="// COMMUNITY"
            right={
              <Link href="/community" style={{ color: '#4d7c4d', fontSize: 12, fontFamily: 'monospace', textDecoration: 'none', letterSpacing: '0.1em' }}>
                TÜM POSTLAR →
              </Link>
            }
          />
          <div>
            {communityPosts.length === 0 ? (
              <div style={{ padding: '24px 16px', color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>
                Henüz community post yok.
              </div>
            ) : communityPosts.map(cp => (
              <div key={String(cp.id)} style={{
                padding: '10px 16px', borderBottom: '1px solid #0d1a0d',
              }}>
                <div style={{
                  color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace',
                  fontWeight: 'bold', marginBottom: 5,
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                  {cp.title}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#00ff41', fontSize: 11, fontFamily: 'monospace' }}>
                    {cp.author ?? 'anon'}
                  </span>
                  {cp.likes !== undefined && (
                    <span style={{ color: '#64748b', fontSize: 11, fontFamily: 'monospace' }}>
                      ♥ {cp.likes?.length || 0}
                    </span>
                  )}
                  {cp.comments !== undefined && (
                    <span style={{ color: '#64748b', fontSize: 11, fontFamily: 'monospace' }}>
                      ▸ {cp.comments?.length || 0}
                    </span>
                  )}
                  {cp.category && (
                    <span style={{
                      fontSize: 11, fontFamily: 'monospace',
                      color: '#4d7c4d', border: '1px solid #1a3a1a',
                      padding: '1px 5px',
                    }}>
                      {cp.category}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════ ATTACK INTELLIGENCE ROW ══════════════════ */}
      <div className="soc-split-grid">
        {/* PANEL D — Saldırı İstihbaratı */}
        <div style={{ background: '#07070f' }}>
          <PanelHeader title="// SALDIRI İSTİHBARATI" />
          <div style={{ padding: '14px 16px' }}>
            <div className="soc-threat-globe">
              <ThreatGlobe
                countries={greynoise?.countries || []}
                attacks={attacks}
                onCountrySelect={(country) => setSelectedThreatCountry(country)}
              />
            </div>
            {greynoise ? (
              <>
                <div style={{ marginBottom: 14 }}>
                  {(greynoise.countries || []).slice(0, 5).map(c => (
                    <div key={c.name} className="soc-threat-row">
                      <span style={{
                        fontSize: 11, fontFamily: 'monospace', color: '#94a3b8',
                        width: 68, flexShrink: 0,
                      }}>
                        {c.name}
                      </span>
                      <div style={{
                        flex: 1, position: 'relative', height: 7, background: '#1a2a1a',
                      }}>
                        <div style={{
                          position: 'absolute', top: 0, left: 0, height: '100%',
                          width: `${Math.round((c.count / maxCountry) * 100)}%`,
                          background: 'linear-gradient(90deg, #00ff41, #f59e0b)',
                        }} />
                      </div>
                      <span style={{
                        fontSize: 11, fontFamily: 'monospace', color: '#00ff41',
                        width: 36, textAlign: 'right', flexShrink: 0,
                      }}>
                        {c.count}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(greynoise.tags || []).slice(0, 3).map(tag => (
                    <span key={tag.name} style={{
                      fontSize: 12, fontFamily: 'monospace',
                      color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)',
                      padding: '2px 8px', letterSpacing: '0.08em',
                    }}>
                      {tag.name} ({tag.count})
                    </span>
                  ))}
                </div>

                {selectedThreatCountry && (
                  <div className="soc-threat-drawer">
                    <div className="soc-threat-drawer-head">
                      <span style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: '#00ff41',
                        letterSpacing: '0.08em',
                      }}>
                        DETAIL // {selectedThreatCountry.name.toUpperCase()}
                      </span>
                      <button
                        onClick={() => setSelectedThreatCountry(null)}
                        style={{
                          fontSize: 10,
                          fontFamily: 'monospace',
                          color: '#64748b',
                          border: '1px solid #1a2a1a',
                          background: 'transparent',
                          padding: '2px 8px',
                          cursor: 'pointer',
                          letterSpacing: '0.06em',
                        }}
                      >
                        [ CLOSE ]
                      </button>
                    </div>
                    <div className="soc-threat-drawer-meta">
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8' }}>
                        SIGNAL: {selectedThreatCountry.count}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#ef4444' }}>
                        CRIT: {selectedCountrySeverity.critical}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#f59e0b' }}>
                        HIGH: {selectedCountrySeverity.high}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#00ff41' }}>
                        LOW: {selectedCountrySeverity.low}
                      </span>
                    </div>
                    <div className="soc-threat-drawer-list">
                      {selectedCountryAttacks.length === 0 ? (
                        <div style={{
                          padding: '10px',
                          color: '#64748b',
                          fontSize: 11,
                          fontFamily: 'monospace',
                        }}>
                          Son olay akisinda bu ulkeye ait kayit bulunamadi.
                        </div>
                      ) : (
                        selectedCountryAttacks.map((attack) => {
                          const badgeColor =
                            attack.severity === 'critical'
                              ? '#ef4444'
                              : attack.severity === 'high'
                                ? '#f59e0b'
                                : '#00ff41'
                          return (
                            <div
                              key={attack.id}
                              style={{
                                padding: '7px 10px',
                                borderBottom: '1px solid #101a13',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={{ color: '#64748b', fontSize: 10, fontFamily: 'monospace' }}>
                                {attack.time}
                              </span>
                              <span style={{
                                color: badgeColor,
                                border: `1px solid ${badgeColor}44`,
                                padding: '1px 6px',
                                fontSize: 10,
                                fontFamily: 'monospace',
                              }}>
                                {attack.type}
                              </span>
                              <span style={{ color: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}>
                                {attack.sourceIP}
                              </span>
                              <span style={{ color: '#4d7c4d', fontSize: 10, fontFamily: 'monospace' }}>
                                :{attack.targetPort}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>
                Yükleniyor...
              </div>
            )}
          </div>
        </div>

        {/* PANEL E — Canlı Saldırı Akışı */}
        <div style={{ background: '#07070f' }}>
          <PanelHeader
            title="// CANLI SALDIRI AKIŞI"
            right={
              <span style={{
                fontSize: 11, fontFamily: 'monospace', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)', padding: '1px 6px',
                animation: 'liveBlink 1.2s ease-in-out infinite',
              }}>
                ● LIVE
              </span>
            }
          />
          <div className="soc-attack-feed">
            {(attacks || []).map((atk, idx) => {
              const sColor =
                atk.severity === 'critical' ? '#ef4444' :
                atk.severity === 'high'     ? '#f59e0b' : '#00ff41'
              const sBorder =
                atk.severity === 'critical' ? 'rgba(239,68,68,0.3)' :
                atk.severity === 'high'     ? 'rgba(245,158,11,0.3)' : 'rgba(0,255,65,0.2)'
              return (
                <div key={atk.id} className="soc-attack-row" style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 16px',
                  borderBottom: '1px solid #0a0a14',
                  fontSize: 11, fontFamily: 'monospace',
                  animation: idx === 0 ? 'slideIn 0.3s ease-out' : undefined,
                }}>
                  <span style={{ color: '#64748b', flexShrink: 0, minWidth: 56 }}>{atk.time}</span>
                  <span style={{
                    color: sColor, flexShrink: 0, fontSize: 12,
                    border: `1px solid ${sBorder}`, padding: '1px 4px',
                  }}>
                    {atk.type}
                  </span>
                  <span style={{ color: '#64748b', flexShrink: 0 }}>{atk.sourceIP}</span>
                  <span style={{ color: '#64748b' }}>→ :{atk.targetPort}</span>
                  <div style={{
                    width: 5, height: 5, borderRadius: 9999, marginLeft: 'auto', flexShrink: 0,
                    background: sColor, boxShadow: `0 0 4px ${sColor}`,
                  }} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════ STATS + CHARTS ══════════════════ */}
      <div className="soc-stats-grid">
        {[
          { label: 'WRITEUP',    value: posts.length || 8, color: '#00ff41' },
          { label: 'CVE BUGÜN', value: 14,                 color: '#ef4444' },
          { label: 'CTF ÇÖZÜM', value: 6,                  color: '#00ff41' },
          { label: 'KOD SATIRI', value: 1337,              color: '#f59e0b' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '20px 16px', background: '#08080f',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontSize: 32, fontWeight: 'bold',
              fontFamily: 'monospace', color: stat.color,
              textShadow: `0 0 24px ${stat.color}30`,
            }}>
              {stat.value.toLocaleString()}
            </div>
            <div style={{
              fontSize: 12, color: '#4d7c4d',
              fontFamily: 'monospace', letterSpacing: '0.15em', marginTop: 4,
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Weekly activity bar chart */}
      <div className="soc-weekly-wrap">
        <div style={{
          fontSize: 11, fontFamily: 'monospace', color: '#4d7c4d',
          letterSpacing: '0.2em', marginBottom: 10,
        }}>
          // HAFTALIK AKTİVİTE
        </div>
        <div className="soc-weekly-scroll">
          <div className="soc-weekly-track">
          {DAY_LABELS.map((day, i) => {
            const isToday = i === todayIdx
            return (
              <div key={day} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3,
                height: '100%', justifyContent: 'flex-end',
              }}>
                <div style={{
                  width: '100%',
                  height: `${ACTIVITY_HEIGHTS[i]}%`,
                  background: isToday ? '#f59e0b' : '#00ff41',
                  opacity: isToday ? 1 : 0.45,
                  boxShadow: isToday
                    ? '0 0 8px rgba(245,158,11,0.5)'
                    : '0 0 3px rgba(0,255,65,0.3)',
                }} />
                <div style={{
                  fontSize: 11, fontFamily: 'monospace',
                  color: isToday ? '#f59e0b' : '#4d7c4d',
                }}>
                  {day}
                </div>
              </div>
            )
          })}
          </div>
        </div>
      </div>

      {/* ══════════════════ NOTES & REPORTS ══════════════════ */}
      <div className="soc-notes-wrap">
        {/* Header row */}
        <div className="soc-notes-header">
          <span style={{
            color: '#4d7c4d', fontSize: 12,
            fontFamily: 'monospace', letterSpacing: '0.2em',
          }}>
            // SALDIRI NOTLARI &amp; RAPORLAR
          </span>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
              color: '#00ff41', border: '1px solid rgba(0,255,65,0.3)',
              padding: '4px 12px',
              background: showForm ? 'rgba(0,255,65,0.05)' : 'transparent',
              letterSpacing: '0.1em',
            }}
          >
            [ + YENİ NOT ]
          </button>
        </div>

        {/* Two-column layout */}
        <div className="soc-notes-grid">
          {/* LEFT — Notes list */}
          <div>
            {reports.length === 0 ? (
              <div style={{
                color: '#64748b', fontSize: 11, fontFamily: 'monospace',
                padding: '24px 0',
              }}>
                Henüz not yok. İlk notunu ekle.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(reports || []).map(report => (
                  <div key={report.id} className="soc-report-card">
                    <div className="soc-report-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SeverityBadge severity={report.severity} />
                        <span style={{
                          color: '#e2e8f0', fontSize: 12,
                          fontFamily: 'monospace', fontWeight: 'bold',
                        }}>
                          {report.title}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        style={{
                          background: 'transparent', border: 'none',
                          color: '#64748b', cursor: 'pointer',
                          fontSize: 14, padding: '0 4px', lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div style={{
                      color: '#475569', fontSize: 12, fontFamily: 'monospace',
                      lineHeight: 1.5,
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      {report.content}
                    </div>
                    <div className="soc-report-meta">
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(report.tags || []).map(tag => (
                          <span key={tag} style={{
                            fontSize: 11, fontFamily: 'monospace',
                            color: '#446644', border: '1px solid #1a3a1a',
                            padding: '1px 4px',
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="soc-report-meta-right">
                        <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#64748b' }}>
                          {new Date(report.createdAt).toLocaleDateString('tr-TR')}
                        </span>
                        <button
                          onClick={() => handlePrintPDF(report)}
                          style={{
                            fontSize: 12, fontFamily: 'monospace', cursor: 'pointer',
                            color: '#4d7c4d', border: '1px solid #1a3a1a',
                            padding: '2px 7px', background: 'transparent',
                          }}
                        >
                          [ PDF ]
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — New Note Form */}
          {showForm && (
            <div style={{
              border: '1px solid #1a2a1a', background: '#07070f', padding: '16px',
              alignSelf: 'start',
            }}>
              <div style={{
                fontSize: 12, fontFamily: 'monospace', color: '#4d7c4d',
                letterSpacing: '0.2em', marginBottom: 14,
              }}>
                // YENİ RAPOR
              </div>

              {/* Title */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#446644', marginBottom: 4, letterSpacing: '0.1em' }}>
                  BAŞLIK:
                </div>
                <input
                  type="text"
                  className="soc-input"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Rapor başlığı..."
                />
              </div>

              {/* Severity */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#446644', marginBottom: 4, letterSpacing: '0.1em' }}>
                  ŞİDDET:
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => (
                    <button
                      key={s}
                      onClick={() => setFormSeverity(s)}
                      style={{
                        fontSize: 12, fontFamily: 'monospace', cursor: 'pointer',
                        color: formSeverity === s ? '#00ff41' : '#4d7c4d',
                        border: `1px solid ${formSeverity === s ? 'rgba(0,255,65,0.45)' : '#1a2a1a'}`,
                        padding: '3px 7px',
                        background: formSeverity === s ? 'rgba(0,255,65,0.05)' : 'transparent',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#446644', marginBottom: 4, letterSpacing: '0.1em' }}>
                  İÇERİK:
                </div>
                <textarea
                  rows={4}
                  className="soc-input"
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  placeholder="Rapor içeriği..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Tags */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#446644', marginBottom: 4, letterSpacing: '0.1em' }}>
                  ETİKETLER: (virgülle)
                </div>
                <input
                  type="text"
                  className="soc-input"
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  placeholder="web, sqli, ctf..."
                />
              </div>

              {/* Buttons */}
              <div className="soc-form-actions">
                <button
                  onClick={handleCreateReport}
                  style={{
                    flex: 1, fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
                    color: '#00ff41', border: '1px solid rgba(0,255,65,0.35)',
                    padding: '7px 0', background: 'rgba(0,255,65,0.04)',
                    letterSpacing: '0.1em',
                  }}
                >
                  [ RAPOR OLUŞTUR ]
                </button>
                <button
                  onClick={() => {
                    if (formTitle && formContent) {
                      handlePrintPDF({
                        id: 0,
                        title: formTitle,
                        content: formContent,
                        severity: formSeverity,
                        tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
                        createdAt: new Date().toISOString(),
                      })
                    }
                  }}
                  style={{
                    fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
                    color: '#4d7c4d', border: '1px solid #1a3a1a',
                    padding: '7px 10px', background: 'transparent',
                    letterSpacing: '0.1em',
                  }}
                >
                  [ PDF ]
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
