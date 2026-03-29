'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MODULES, TOOLS, CHALLENGES, TOOL_CATEGORIES } from '@/lib/lab/content'
import { VALID_FLAGS } from '@/lib/lab/engine'
import type { Module, ToolCard, Challenge, Difficulty } from '@/lib/lab/types'

const Terminal = dynamic(() => import('@/components/lab/Terminal'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentTab  = 'curriculum' | 'tools' | 'setup'
type MobileTab   = ContentTab | 'terminal'
type ToolCategory = typeof TOOL_CATEGORIES[number]

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_META: Record<Difficulty, { label: string; color: string }> = {
  beginner:     { label: 'Başlangıç', color: '#00ff41' },
  intermediate: { label: 'Orta',      color: '#f59e0b' },
  advanced:     { label: 'İleri',     color: '#ef4444' },
  expert:       { label: 'Uzman',     color: '#7c3aed' },
}

const CONTENT_TABS: { id: ContentTab; icon: string; label: string }[] = [
  { id: 'curriculum', icon: '📚', label: 'Müfredat'  },
  { id: 'tools',      icon: '🛠',  label: 'Araçlar'  },
  { id: 'setup',      icon: '⚙',  label: 'Kurulum'  },
]

const MOBILE_TABS: { id: MobileTab; icon: string; label: string }[] = [
  { id: 'curriculum', icon: '📚', label: 'Müfredat'  },
  { id: 'tools',      icon: '🛠',  label: 'Araçlar'  },
  { id: 'setup',      icon: '⚙',  label: 'Kurulum'  },
  { id: 'terminal',   icon: '⌨',  label: 'Terminal' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabPage() {
  const [contentTab,     setContentTab]     = useState<ContentTab>('curriculum')
  const [mobileTab,      setMobileTab]      = useState<MobileTab>('terminal')
  const [submittedFlags, setSubmittedFlags] = useState<Set<string>>(new Set())

  function handleFlagSubmit(flag: string) {
    setSubmittedFlags(prev => new Set([...Array.from(prev), flag]))
  }

  const progress = submittedFlags.size
  const total    = VALID_FLAGS.size

  // ── Shared content renderer ──────────────────────────────────────────────

  function renderContent(tab: ContentTab) {
    if (tab === 'curriculum') return <CurriculumTab />
    if (tab === 'tools')      return <ToolsTab />
    if (tab === 'setup')      return <SetupTab />
    return null
  }

  const shellStyle: React.CSSProperties = {
    height: 'calc(100vh - 64px)',
    display: 'flex',
    flexDirection: 'column',
    background: '#000',
    color: '#e2e8f0',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    overflow: 'hidden',
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════
          DESKTOP  (md+) — 2-column: left content + right terminal
          ═══════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col" style={shellStyle}>

        {/* ── Top bar ─────────────────────────────────────────── */}
        <DesktopTopBar
          activeTab={contentTab}
          onTabChange={setContentTab}
          progress={progress}
          total={total}
        />

        {/* ── Body ────────────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

          {/* LEFT — content panel */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {renderContent(contentTab)}
          </div>

          {/* DIVIDER */}
          <div style={{ width: 1, background: 'linear-gradient(to bottom, #1a2e1a 0%, #0d200d 100%)', flexShrink: 0 }} />

          {/* RIGHT — terminal panel (always visible) */}
          <div style={{ width: '44%', flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#030303' }}>
            <TerminalPanelBar />
            <div style={{ flex: 1, minHeight: 0 }}>
              <Terminal onFlagSubmit={handleFlagSubmit} />
            </div>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE  (<md) — full screen with bottom nav
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex md:hidden flex-col" style={shellStyle}>

        {/* Mobile header */}
        <MobileTopBar
          activeTab={mobileTab}
          progress={progress}
          total={total}
        />

        {/* Mobile content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {mobileTab === 'terminal'
            ? <Terminal onFlagSubmit={handleFlagSubmit} />
            : renderContent(mobileTab as ContentTab)
          }
        </div>

        {/* Mobile bottom nav */}
        <MobileBottomNav activeTab={mobileTab} onTabChange={setMobileTab} />

      </div>
    </>
  )
}

// ─── Desktop Top Bar ──────────────────────────────────────────────────────────

function DesktopTopBar({
  activeTab, onTabChange, progress, total,
}: {
  activeTab: ContentTab
  onTabChange: (t: ContentTab) => void
  progress: number
  total: number
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: 46, flexShrink: 0,
      background: '#06090608',
      borderBottom: '1px solid #172517',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>⬡</span>
        <span style={{ color: '#00ff41', fontWeight: 800, letterSpacing: '0.18em', fontSize: 12 }}>
          BREACH LAB
        </span>
        <span style={{
          padding: '1px 7px', borderRadius: 3, fontSize: 9, fontWeight: 700,
          background: 'rgba(0,255,65,0.08)', color: 'rgba(0,255,65,0.5)',
          border: '1px solid rgba(0,255,65,0.15)',
        }}>SİMÜLE</span>
      </div>

      {/* Center tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.03)', padding: '3px 4px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)' }}>
        {CONTENT_TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: '5px 16px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                letterSpacing: '0.04em',
                background: isActive ? 'rgba(0,255,65,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(0,255,65,0.25)' : '1px solid transparent',
                borderRadius: 5,
                color: isActive ? '#00ff41' : '#6b7280',
                transition: 'all 0.15s',
                outline: 'none',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 13 }}>{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#4ade80', fontSize: 11, letterSpacing: '0.05em' }}>
          🚩 <strong>{progress}</strong>/{total}
        </span>
        <div style={{ width: 64, height: 4, background: 'rgba(0,255,65,0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${total ? (progress / total) * 100 : 0}%`, height: '100%',
            background: 'linear-gradient(90deg, #00ff41, #4ade80)',
            borderRadius: 2, transition: 'width 0.5s',
            boxShadow: progress > 0 ? '0 0 8px #00ff41' : 'none',
          }} />
        </div>
      </div>
    </div>
  )
}

// ─── Terminal Panel Bar (desktop right-side label) ────────────────────────────

function TerminalPanelBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 14px', flexShrink: 0,
      background: '#040604',
      borderBottom: '1px solid #0f1f0f',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 12 }}>⌨</span>
        <span style={{ color: '#4b5563', fontSize: 10, letterSpacing: '0.12em', fontWeight: 700 }}>
          LIVE TERMINAL
        </span>
      </div>
      <span style={{ color: '#1f2937', fontSize: 9, letterSpacing: '0.08em' }}>TAB · ↑↓ · Ctrl+L</span>
    </div>
  )
}

// ─── Mobile Top Bar ───────────────────────────────────────────────────────────

function MobileTopBar({ activeTab, progress, total }: {
  activeTab: MobileTab; progress: number; total: number
}) {
  const current = MOBILE_TABS.find(t => t.id === activeTab)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px', flexShrink: 0,
      background: '#060906', borderBottom: '1px solid #172517',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#00ff41', fontSize: 14 }}>⬡</span>
        <span style={{ color: '#00ff41', fontWeight: 800, fontSize: 12, letterSpacing: '0.12em' }}>
          BREACH LAB
        </span>
        {current && (
          <span style={{ color: '#374151', fontSize: 11 }}>/ {current.icon} {current.label}</span>
        )}
      </div>
      <span style={{ color: '#4ade80', fontSize: 11 }}>🚩 {progress}/{total}</span>
    </div>
  )
}

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────

function MobileBottomNav({ activeTab, onTabChange }: {
  activeTab: MobileTab; onTabChange: (t: MobileTab) => void
}) {
  return (
    <div style={{
      display: 'flex', flexShrink: 0,
      background: '#060906', borderTop: '1px solid #172517',
    }}>
      {MOBILE_TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1, padding: '10px 4px', cursor: 'pointer',
              background: isActive ? 'rgba(0,255,65,0.07)' : 'transparent',
              border: 'none',
              borderTop: `2px solid ${isActive ? '#00ff41' : 'transparent'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              outline: 'none', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            <span style={{
              fontSize: 9, fontFamily: 'inherit', fontWeight: 700,
              letterSpacing: '0.06em',
              color: isActive ? '#00ff41' : '#4b5563',
            }}>
              {tab.label.toUpperCase()}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Curriculum Tab ───────────────────────────────────────────────────────────

function CurriculumTab() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '1.5rem' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <SectionHeader
          eyebrow="ÖĞRENME YOLU"
          title="Başlangıçtan Uzmanlığa"
          subtitle="Siber güvenlikte sıfırdan profesyonel seviyeye kapsamlı müfredat"
        />

        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 23, top: 0, bottom: 0, width: 2,
            background: 'linear-gradient(to bottom, #00ff41, #7c3aed)', opacity: 0.25 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {MODULES.map((mod, i) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                index={i}
                isExpanded={expanded === mod.id}
                onToggle={() => setExpanded(prev => prev === mod.id ? null : mod.id)}
              />
            ))}
          </div>
        </div>

        <ChallengesSection />
      </div>
    </div>
  )
}

function ModuleCard({ module: mod, index, isExpanded, onToggle }: {
  module: Module; index: number; isExpanded: boolean; onToggle: () => void
}) {
  const { label: diffLabel, color: diffColor } = DIFFICULTY_META[mod.difficulty]

  return (
    <div style={{ display: 'flex', gap: '0.85rem', paddingLeft: '0.4rem' }}>
      {/* Timeline icon */}
      <div style={{ flexShrink: 0, width: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 8, background: `${mod.color}12`,
          border: `1px solid ${mod.color}35`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 20 }}>
          {mod.icon}
        </div>
      </div>

      {/* Card */}
      <div style={{ flex: 1, border: `1px solid ${isExpanded ? mod.color + '40' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.2s' }}>
        <button
          onClick={onToggle}
          style={{ width: '100%', textAlign: 'left', padding: '0.85rem 1.1rem',
            background: isExpanded ? `${mod.color}07` : 'rgba(255,255,255,0.015)',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between' }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ color: '#64748b', fontSize: 10, fontWeight: 700 }}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                {mod.title}
              </span>
              <span style={{ padding: '1px 7px', borderRadius: 3, fontSize: 9, fontWeight: 700,
                background: `${diffColor}15`, color: diffColor, border: `1px solid ${diffColor}30` }}>
                {diffLabel}
              </span>
            </div>
            <span style={{ color: 'rgba(148,163,184,0.65)', fontSize: 11 }}>{mod.subtitle}</span>
          </div>
          <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 16, transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(90deg)' : 'none', flexShrink: 0, marginLeft: 8 }}>›</span>
        </button>

        {isExpanded && (
          <div style={{ padding: '0 1.1rem 1.1rem', borderTop: `1px solid ${mod.color}18` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.9rem' }}>
              <div>
                <p style={{ color: 'rgba(0,255,65,0.55)', fontSize: 10, letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
                  KONULAR
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {mod.topics.map(topic => (
                    <li key={topic} style={{ color: 'rgba(226,232,240,0.72)', fontSize: 11, display: 'flex', gap: '0.4rem' }}>
                      <span style={{ color: mod.color, flexShrink: 0 }}>›</span>
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p style={{ color: 'rgba(0,255,65,0.55)', fontSize: 10, letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
                  KAYNAKLAR
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {mod.resources.map(r => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#60a5fa', fontSize: 11, textDecoration: 'none', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <span>↗</span> {r.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChallengesSection() {
  return (
    <div style={{ marginTop: '2.5rem' }}>
      <SectionHeader eyebrow="PRATİK" title="CTF Görevleri" subtitle="Terminalde çöz, bayrak gönder" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.65rem' }}>
        {CHALLENGES.map(ch => <ChallengeCard key={ch.level} challenge={ch} />)}
      </div>
    </div>
  )
}

function ChallengeCard({ challenge: ch }: { challenge: Challenge }) {
  return (
    <div style={{ border: `1px solid ${ch.color}20`, borderRadius: 7, padding: '0.85rem',
      background: `${ch.color}04` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.45rem' }}>
        <span style={{ color: ch.color, fontWeight: 800, fontSize: 18, fontFamily: 'inherit' }}>
          {String(ch.level).padStart(2, '0')}
        </span>
        <div>
          <div style={{ color: ch.color, fontWeight: 700, fontSize: 12 }}>{ch.title}</div>
          <span style={{ padding: '1px 5px', borderRadius: 2, fontSize: 9, fontWeight: 700,
            background: `${ch.color}18`, color: ch.color }}>{ch.difficulty}</span>
        </div>
      </div>
      <p style={{ color: 'rgba(226,232,240,0.58)', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
        {ch.description}
      </p>
      <code style={{ display: 'block', marginTop: '0.55rem', padding: '0.35rem 0.55rem',
        background: 'rgba(0,0,0,0.6)', borderRadius: 4, fontSize: 10, color: 'rgba(0,255,65,0.65)' }}>
        cd {ch.path} && cat mission.txt
      </code>
    </div>
  )
}

// ─── Tools Tab ────────────────────────────────────────────────────────────────

function ToolsTab() {
  const [category, setCategory] = useState<ToolCategory>('Tümü')
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<ToolCard | null>(null)

  const filtered = TOOLS.filter(t => {
    const matchCat = category === 'Tümü' || t.category === category
    const q = search.toLowerCase()
    const matchSearch = !q || t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q))
    return matchCat && matchSearch
  })

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)',
        overflowY: 'auto', background: '#030303', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '0.75rem' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Araç ara..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)', borderRadius: 5,
              padding: '0.45rem 0.7rem', color: '#e2e8f0', fontSize: 11,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ padding: '0 0.65rem 0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
          {TOOL_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                fontFamily: 'inherit', border: '1px solid',
                borderColor: category === cat ? '#00ff41' : 'rgba(255,255,255,0.09)',
                background: category === cat ? 'rgba(0,255,65,0.1)' : 'transparent',
                color: category === cat ? '#00ff41' : 'rgba(255,255,255,0.35)',
                outline: 'none' }}>
              {cat}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }}>
          {filtered.map(tool => (
            <button key={tool.id} onClick={() => setSelected(tool)}
              style={{ width: '100%', textAlign: 'left', padding: '0.65rem 0.85rem', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: selected?.id === tool.id ? 'rgba(0,255,65,0.06)' : 'transparent',
                cursor: 'pointer',
                borderLeft: selected?.id === tool.id ? '2px solid #00ff41' : '2px solid transparent',
                outline: 'none' }}>
              <div style={{ color: selected?.id === tool.id ? '#00ff41' : '#d1d5db',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                {tool.name}
              </div>
              <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10, marginTop: 1 }}>
                {tool.category}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
        {selected ? <ToolDetail tool={selected} /> : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.18)', fontFamily: 'inherit', fontSize: 12,
            flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 32 }}>🛠</span>
            <span>Soldan bir araç seç</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ToolDetail({ tool }: { tool: ToolCard }) {
  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem' }}>
          <h2 style={{ color: '#00ff41', fontFamily: 'inherit', fontSize: 20, fontWeight: 800, margin: 0 }}>
            {tool.name}
          </h2>
          <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 10,
            background: 'rgba(0,255,65,0.08)', color: '#4ade80', border: '1px solid rgba(0,255,65,0.2)' }}>
            {tool.category}
          </span>
        </div>
        <p style={{ color: 'rgba(226,232,240,0.68)', fontSize: 12, lineHeight: 1.7, margin: 0 }}>
          {tool.description}
        </p>
      </div>

      <CodeBlock label="Kurulum" code={tool.install} />

      <Section title="Önemli Parametreler">
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {tool.flags.map(f => (
            <div key={f.flag} style={{ display: 'flex', gap: '0.85rem', padding: '0.45rem 0.65rem',
              borderRadius: 4, background: 'rgba(255,255,255,0.02)', alignItems: 'flex-start' }}>
              <code style={{ color: '#00ff41', fontSize: 11, minWidth: 130, flexShrink: 0,
                fontFamily: 'inherit' }}>{f.flag}</code>
              <span style={{ color: 'rgba(226,232,240,0.62)', fontSize: 11 }}>{f.description}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Kullanım Örnekleri">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {tool.examples.map((ex, i) => (
            <div key={i} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ background: '#0d0d0d', padding: '0.65rem 0.9rem' }}>
                <pre style={{ margin: 0, color: '#e2e8f0', fontSize: 11, fontFamily: 'inherit',
                  whiteSpace: 'pre-wrap' }}>{ex.command}</pre>
              </div>
              <div style={{ padding: '0.45rem 0.9rem', background: 'rgba(255,255,255,0.015)',
                color: 'rgba(148,163,184,0.65)', fontSize: 10 }}>
                {ex.description}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '1.25rem' }}>
        {tool.tags.map(tag => (
          <span key={tag} style={{ padding: '2px 9px', borderRadius: 10, fontSize: 10,
            background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.55)',
            border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'inherit' }}>
            #{tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Setup Tab ────────────────────────────────────────────────────────────────

function SetupTab() {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <SectionHeader
          eyebrow="GERÇEK SUNUCU"
          title="Terminal Kurulum Rehberi"
          subtitle="node-pty + WebSocket ile tarayıcıdan gerçek Linux shell"
        />

        <InfoBox type="warning">
          Bu kurulum bir <strong>VPS veya yerel sunucu</strong> gerektirir.
          Vercel gibi serverless platformlarda çalışmaz (process spawn + persistent WebSocket).
          <br /><br />
          Önerilen: <strong>DigitalOcean Droplet $6/ay</strong> veya yerel Ubuntu makinesi.
        </InfoBox>

        <Section title="1. Sunucu Kurulumu">
          <CodeBlock label="Ubuntu 22.04 — Gereksinimler" code={`# Node.js 20 kur
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs build-essential python3

# node-pty için derleme araçları
sudo apt install -y libpty-dev`} />
        </Section>

        <Section title="2. Terminal Server Oluştur">
          <CodeBlock label="terminal-server/server.js" code={`const { WebSocketServer } = require('ws')
const pty = require('node-pty')

const wss = new WebSocketServer({ port: 3001 })

wss.on('connection', (ws) => {
  const shell = pty.spawn('bash', [], {
    name: 'xterm-256color',
    cols: 120, rows: 35,
    cwd: '/home/operator',
    env: { ...process.env, PS1: '\\u@breach-lab:\\w$ ', HOME: '/home/operator' },
  })

  shell.onData((data) => ws.send(data))
  ws.on('message', (data) => shell.write(data))
  ws.on('close', () => shell.kill())
})`} />

          <CodeBlock label="Bağımlılıklar" code={`cd terminal-server
npm init -y
npm install ws node-pty
node server.js`} />
        </Section>

        <Section title="3. Güvenli Kullanıcı Ortamı">
          <CodeBlock label="Sandbox kullanıcı oluştur" code={`sudo useradd -m -s /bin/bash operator
sudo passwd operator
sudo mkdir -p /home/operator/challenges
sudo chown -R operator:operator /home/operator`} />
        </Section>

        <Section title="4. Next.js'e Bağla">
          <CodeBlock label=".env.local" code={`NEXT_PUBLIC_TERMINAL_WS=ws://sunucu-ip:3001`} />
          <CodeBlock label="src/app/community/page.tsx" code={`<Terminal wsUrl={process.env.NEXT_PUBLIC_TERMINAL_WS} onFlagSubmit={handleFlagSubmit} />`} />
        </Section>

        <Section title="5. Production — Nginx + SSL">
          <CodeBlock label="/etc/nginx/sites-available/breach-lab" code={`server {
  listen 443 ssl;
  server_name terminal.siteniz.com;
  ssl_certificate /etc/letsencrypt/live/terminal.siteniz.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/terminal.siteniz.com/privkey.pem;

  location /terminal {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
  }
}`} />
          <InfoBox type="info">
            SSL ile WebSocket adresi <code>wss://</code> olur:
            <br />
            <code>NEXT_PUBLIC_TERMINAL_WS=wss://terminal.siteniz.com/terminal</code>
          </InfoBox>
        </Section>

        <Section title="Mimariye Genel Bakış">
          <div style={{ padding: '1rem 1.25rem', background: 'rgba(0,255,65,0.03)',
            borderRadius: 8, border: '1px solid rgba(0,255,65,0.1)', fontFamily: 'inherit',
            fontSize: 12, color: 'rgba(226,232,240,0.65)', lineHeight: 2.2 }}>
            <div style={{ color: '#00ff41' }}>⬡ Tarayıcı (Terminal component)</div>
            <div style={{ paddingLeft: '1.2rem', color: '#4b5563' }}>↕ WebSocket (ws:// / wss://)</div>
            <div style={{ color: '#60a5fa' }}>⬡ Node.js Server (node-pty)</div>
            <div style={{ paddingLeft: '1.2rem', color: '#4b5563' }}>↕ PTY (pseudo-terminal)</div>
            <div style={{ color: '#f59e0b' }}>⬡ Bash Process (/home/operator)</div>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, subtitle }: {
  eyebrow: string; title: string; subtitle: string
}) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <p style={{ color: 'rgba(0,255,65,0.45)', fontSize: 10, letterSpacing: '0.2em',
        textTransform: 'uppercase', marginBottom: '0.35rem', margin: '0 0 4px' }}>
        {eyebrow}
      </p>
      <h2 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 20,
        fontFamily: 'inherit', margin: '0 0 0.35rem' }}>
        {title}
      </h2>
      <p style={{ color: 'rgba(148,163,184,0.65)', fontSize: 12, margin: 0 }}>{subtitle}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <h3 style={{ color: '#4ade80', fontFamily: 'inherit', fontSize: 12,
        fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 0.65rem',
        borderBottom: '1px solid rgba(0,255,65,0.12)', paddingBottom: '0.4rem' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div style={{ marginBottom: '0.85rem', borderRadius: 6, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ padding: '0.35rem 0.85rem', background: 'rgba(255,255,255,0.03)',
        color: 'rgba(148,163,184,0.5)', fontSize: 10, fontFamily: 'inherit',
        borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {label}
      </div>
      <pre style={{ margin: 0, padding: '0.65rem 0.85rem', background: '#080808',
        color: '#d1d5db', fontSize: 11, fontFamily: 'inherit',
        overflowX: 'auto', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
        {code}
      </pre>
    </div>
  )
}

function InfoBox({ type, children }: { type: 'warning' | 'info'; children: React.ReactNode }) {
  const color = type === 'warning' ? '#f59e0b' : '#60a5fa'
  return (
    <div style={{ padding: '0.85rem 1.1rem', borderRadius: 6, marginBottom: '1.25rem',
      border: `1px solid ${color}25`, background: `${color}06`,
      color: 'rgba(226,232,240,0.72)', fontSize: 12, lineHeight: 1.7,
      borderLeft: `3px solid ${color}` }}>
      {children}
    </div>
  )
}
