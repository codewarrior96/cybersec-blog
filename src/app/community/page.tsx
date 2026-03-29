'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { MODULES, TOOLS, CHALLENGES, TOOL_CATEGORIES } from '@/lib/lab/content'
import { VALID_FLAGS, isValidFlag } from '@/lib/lab/engine'
import type { Module, ToolCard, Challenge, Difficulty, PendingCommand } from '@/lib/lab/types'

const Terminal = dynamic(() => import('@/components/lab/Terminal'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentTab  = 'curriculum' | 'tools' | 'ctf'
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
  { id: 'curriculum', icon: '📚', label: 'Müfredat'      },
  { id: 'tools',      icon: '🛠',  label: 'Araçlar'      },
  { id: 'ctf',        icon: '🚩', label: 'CTF Görevleri' },
]

const MOBILE_TABS: { id: MobileTab; icon: string; label: string }[] = [
  { id: 'curriculum', icon: '📚', label: 'Müfredat'      },
  { id: 'tools',      icon: '🛠',  label: 'Araçlar'      },
  { id: 'ctf',        icon: '🚩', label: 'CTF'           },
  { id: 'terminal',   icon: '⌨',  label: 'Terminal'     },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabPage() {
  const [contentTab,     setContentTab]     = useState<ContentTab>('curriculum')
  const [mobileTab,      setMobileTab]      = useState<MobileTab>('curriculum')
  const [submittedFlags, setSubmittedFlags] = useState<Set<string>>(new Set())

  // ── Çapraz panel komut enjeksiyonu ──────────────────────────────────────
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null)
  const sendToTerminal = useCallback((cmd: string) => {
    setPendingCommand({ cmd, id: Date.now() })
  }, [])
  const handleCommandConsumed = useCallback(() => setPendingCommand(null), [])

  // ── Araçlar sekmesi çapraz navigasyon ────────────────────────────────────
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const navigateToTool = useCallback((toolId: string) => {
    setContentTab('tools')
    setMobileTab('tools')
    setSelectedToolId(toolId)
  }, [])

  // ── CTF ilerleme (localStorage kalıcı) ───────────────────────────────────
  const [unlockedLevels, setUnlockedLevels] = useState<Set<number>>(new Set([1]))
  const [revealedHints,  setRevealedHints]  = useState<Record<number, number>>({})

  useEffect(() => {
    try {
      const ul = localStorage.getItem('breach-unlocked')
      if (ul) setUnlockedLevels(new Set(JSON.parse(ul) as number[]))
      const rh = localStorage.getItem('breach-hints')
      if (rh) setRevealedHints(JSON.parse(rh) as Record<number, number>)
    } catch { /* ignore parse errors */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('breach-unlocked', JSON.stringify(Array.from(unlockedLevels)))
    } catch { /* ignore */ }
  }, [unlockedLevels])

  useEffect(() => {
    try {
      localStorage.setItem('breach-hints', JSON.stringify(revealedHints))
    } catch { /* ignore */ }
  }, [revealedHints])

  // ── Global flag submit ───────────────────────────────────────────────────
  function handleFlagSubmit(flag: string) {
    setSubmittedFlags(prev => new Set([...Array.from(prev), flag]))
  }

  // ── CTF flag submit + level unlock ───────────────────────────────────────
  function handleCTFFlag(flag: string, level: number): 'valid' | 'invalid' | 'duplicate' {
    if (submittedFlags.has(flag)) return 'duplicate'
    if (!isValidFlag(flag)) return 'invalid'
    setUnlockedLevels(prev => {
      const next = new Set([...Array.from(prev), level + 1])
      return next
    })
    handleFlagSubmit(flag)
    return 'valid'
  }

  // ── Hint reveal ──────────────────────────────────────────────────────────
  function revealNextHint(level: number) {
    setRevealedHints(prev => {
      const current = prev[level] ?? 0
      const max     = (CHALLENGES.find(c => c.level === level)?.hints.length ?? 0)
      if (current >= max) return prev
      return { ...prev, [level]: current + 1 }
    })
  }

  const progress = submittedFlags.size
  const total    = VALID_FLAGS.size

  function renderContent(tab: ContentTab, isMobile = false) {
    if (tab === 'curriculum') return (
      <CurriculumTab onNavigateToTool={navigateToTool} />
    )
    if (tab === 'tools') return (
      <ToolsTab
        initialToolId={selectedToolId}
        onSendCommand={sendToTerminal}
        onSelectTool={setSelectedToolId}
        isMobile={isMobile}
      />
    )
    if (tab === 'ctf') return (
      <CTFTab
        unlockedLevels={unlockedLevels}
        revealedHints={revealedHints}
        submittedFlags={submittedFlags}
        onFlagSubmit={handleCTFFlag}
        onSendCommand={cmd => { sendToTerminal(cmd); setMobileTab('terminal') }}
        onRevealHint={revealNextHint}
      />
    )
    return null
  }

  // display intentionally omitted — Tailwind hidden/flex classes control visibility
  const shellStyle: React.CSSProperties = {
    height: 'calc(100vh - 64px)',
    flexDirection: 'column',
    background: '#000', color: '#e2e8f0',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    overflow: 'hidden',
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          DESKTOP — 2-column: sol içerik + sağ sabit terminal
          ═══════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col" style={shellStyle}>
        <DesktopTopBar activeTab={contentTab} onTabChange={setContentTab} progress={progress} total={total} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* Sol — içerik */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {renderContent(contentTab)}
          </div>
          {/* Ayırıcı */}
          <div style={{ width: 1, background: 'linear-gradient(to bottom, #1a2e1a 0%, #0d200d 100%)', flexShrink: 0 }} />
          {/* Sağ — terminal (her zaman görünür) */}
          <div style={{ width: '44%', flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#030303' }}>
            <TerminalPanelBar />
            <div style={{ flex: 1, minHeight: 0 }}>
              <Terminal
                pendingCommand={pendingCommand}
                onCommandConsumed={handleCommandConsumed}
                onFlagSubmit={handleFlagSubmit}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MOBİL — tam ekran + alt navigasyon
          ═══════════════════════════════════════════════════════ */}
      <div className="flex md:hidden flex-col" style={shellStyle}>
        <MobileTopBar activeTab={mobileTab} progress={progress} total={total} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {mobileTab === 'terminal'
            ? <Terminal pendingCommand={pendingCommand} onCommandConsumed={handleCommandConsumed} onFlagSubmit={handleFlagSubmit} />
            : renderContent(mobileTab as ContentTab, true)
          }
        </div>
        <MobileBottomNav activeTab={mobileTab} onTabChange={setMobileTab} />
      </div>
    </>
  )
}

// ─── Desktop Top Bar ──────────────────────────────────────────────────────────

function DesktopTopBar({ activeTab, onTabChange, progress, total }: {
  activeTab: ContentTab; onTabChange: (t: ContentTab) => void; progress: number; total: number
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: 46, flexShrink: 0,
      background: '#060906', borderBottom: '1px solid #172517',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 15 }}>⬡</span>
        <span style={{ color: '#00ff41', fontWeight: 800, letterSpacing: '0.18em', fontSize: 12 }}>
          BREACH LAB
        </span>
        <span style={{ padding: '1px 7px', borderRadius: 3, fontSize: 9, fontWeight: 700,
          background: 'rgba(0,255,65,0.07)', color: 'rgba(0,255,65,0.45)',
          border: '1px solid rgba(0,255,65,0.15)' }}>SİBER GÜVENLİK</span>
      </div>

      <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.03)',
        padding: '3px 4px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)' }}>
        {CONTENT_TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
              padding: '5px 16px', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.04em',
              background: isActive ? 'rgba(0,255,65,0.12)' : 'transparent',
              border: isActive ? '1px solid rgba(0,255,65,0.25)' : '1px solid transparent',
              borderRadius: 5,
              color: isActive ? '#00ff41' : '#6b7280',
              transition: 'all 0.15s', outline: 'none',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 13 }}>{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#4ade80', fontSize: 11 }}>
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

function TerminalPanelBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 14px', flexShrink: 0,
      background: '#040604', borderBottom: '1px solid #0f1f0f',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 11 }}>⌨</span>
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
        {current && <span style={{ color: '#374151', fontSize: 11 }}>/ {current.icon} {current.label}</span>}
      </div>
      <span style={{ color: '#4ade80', fontSize: 11 }}>🚩 {progress}/{total}</span>
    </div>
  )
}

function MobileBottomNav({ activeTab, onTabChange }: {
  activeTab: MobileTab; onTabChange: (t: MobileTab) => void
}) {
  return (
    <div style={{ display: 'flex', flexShrink: 0, background: '#060906', borderTop: '1px solid #172517' }}>
      {MOBILE_TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
            flex: 1, padding: '10px 4px', cursor: 'pointer',
            background: isActive ? 'rgba(0,255,65,0.07)' : 'transparent',
            border: 'none',
            borderTop: `2px solid ${isActive ? '#00ff41' : 'transparent'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            outline: 'none', transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            <span style={{ fontSize: 9, fontFamily: 'inherit', fontWeight: 700,
              letterSpacing: '0.06em', color: isActive ? '#00ff41' : '#4b5563' }}>
              {tab.label.toUpperCase()}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── CTF Tab ─────────────────────────────────────────────────────────────────

function CTFTab({
  unlockedLevels, revealedHints, submittedFlags,
  onFlagSubmit, onSendCommand, onRevealHint,
}: {
  unlockedLevels: Set<number>
  revealedHints: Record<number, number>
  submittedFlags: Set<string>
  onFlagSubmit: (flag: string, level: number) => 'valid' | 'invalid' | 'duplicate'
  onSendCommand: (cmd: string) => void
  onRevealHint: (level: number) => void
}) {
  const completed = CHALLENGES.filter(ch => submittedFlags.has(ch.flagKey)).length

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '1.25rem', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <p style={{ color: 'rgba(0,255,65,0.45)', fontSize: 10, letterSpacing: '0.2em', margin: '0 0 4px' }}>
              PRATİK GÖREVLER
            </p>
            <h2 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 20, fontFamily: 'inherit', margin: 0 }}>
              CTF Görevleri
            </h2>
            <p style={{ color: 'rgba(148,163,184,0.65)', fontSize: 12, margin: '4px 0 0' }}>
              Terminali kullanarak görevleri çöz, bayrak gönder, ilerle
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#4ade80', fontSize: 20, fontWeight: 800 }}>{completed}/{CHALLENGES.length}</div>
            <div style={{ color: '#374151', fontSize: 10, letterSpacing: '0.1em' }}>TAMAMLANDI</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(0,255,65,0.08)', borderRadius: 2, marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{
            width: `${CHALLENGES.length ? (completed / CHALLENGES.length) * 100 : 0}%`,
            height: '100%', background: 'linear-gradient(90deg, #00ff41, #4ade80)',
            borderRadius: 2, transition: 'width 0.6s ease',
          }} />
        </div>

        {/* Challenge grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' }}>
          {CHALLENGES.map(ch => (
            <ChallengeCard
              key={ch.level}
              challenge={ch}
              isUnlocked={unlockedLevels.has(ch.level)}
              isCompleted={submittedFlags.has(ch.flagKey)}
              hintsRevealed={revealedHints[ch.level] ?? 0}
              onFlagSubmit={flag => onFlagSubmit(flag, ch.level)}
              onSendCommand={() => onSendCommand(`cd /home/operator/${ch.path}`)}
              onRevealHint={() => onRevealHint(ch.level)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ChallengeCard({
  challenge: ch, isUnlocked, isCompleted, hintsRevealed,
  onFlagSubmit, onSendCommand, onRevealHint,
}: {
  challenge: Challenge
  isUnlocked: boolean
  isCompleted: boolean
  hintsRevealed: number
  onFlagSubmit: (flag: string) => 'valid' | 'invalid' | 'duplicate'
  onSendCommand: () => void
  onRevealHint: () => void
}) {
  const [flagInput,  setFlagInput]  = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'valid' | 'invalid' | 'duplicate'>('idle')

  function handleSubmit() {
    if (!flagInput.trim()) return
    const result = onFlagSubmit(flagInput.trim())
    setSubmitState(result)
    if (result === 'valid') setFlagInput('')
    setTimeout(() => setSubmitState('idle'), 2500)
  }

  const borderColor = isCompleted ? '#00ff41'
    : isUnlocked    ? ch.color + '40'
    : 'rgba(255,255,255,0.07)'

  const bg = isCompleted ? 'rgba(0,255,65,0.04)'
    : isUnlocked    ? ch.color + '05'
    : 'rgba(255,255,255,0.01)'

  return (
    <div style={{
      border: `1px solid ${borderColor}`, borderRadius: 8, overflow: 'hidden',
      background: bg, opacity: isUnlocked ? 1 : 0.45,
      transition: 'opacity 0.3s, border-color 0.3s',
    }}>
      {/* Card header */}
      <div style={{ padding: '0.85rem 1.1rem', borderBottom: `1px solid ${borderColor}88` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: ch.color, fontWeight: 800, fontSize: 22, fontFamily: 'inherit' }}>
              {String(ch.level).padStart(2, '0')}
            </span>
            <div>
              <div style={{ color: isCompleted ? '#00ff41' : '#e2e8f0', fontWeight: 700, fontSize: 13 }}>
                {ch.title}
              </div>
              <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700,
                background: ch.color + '18', color: ch.color }}>
                {ch.difficulty}
              </span>
            </div>
          </div>
          <span style={{ fontSize: 18 }}>
            {isCompleted ? '✅' : isUnlocked ? '🔓' : '🔒'}
          </span>
        </div>
        <p style={{ color: 'rgba(226,232,240,0.6)', fontSize: 11, lineHeight: 1.5, margin: '0.5rem 0 0' }}>
          {ch.description}
        </p>
      </div>

      {/* Card body */}
      {!isUnlocked ? (
        <div style={{ padding: '0.85rem 1.1rem', color: 'rgba(148,163,184,0.4)', fontSize: 11, fontStyle: 'italic' }}>
          Bu görevi açmak için önceki görevi tamamla.
        </div>
      ) : isCompleted ? (
        <div style={{ padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#00ff41', fontSize: 14 }}>✓</span>
          <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }}>Görev Tamamlandı</span>
          <code style={{ marginLeft: 'auto', color: 'rgba(0,255,65,0.5)', fontSize: 10 }}>{ch.flagKey}</code>
        </div>
      ) : (
        <div style={{ padding: '0.85rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Terminale git butonu */}
          <button onClick={onSendCommand} style={{
            padding: '6px 12px', borderRadius: 5, cursor: 'pointer',
            background: 'rgba(0,255,65,0.07)', border: '1px solid rgba(0,255,65,0.2)',
            color: '#4ade80', fontSize: 11, fontFamily: 'inherit', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content',
            outline: 'none',
          }}>
            <span>⌨</span> Terminalde Aç
          </button>

          {/* İpucu bölümü */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10, letterSpacing: '0.1em' }}>
                İPUCU {hintsRevealed}/{ch.hints.length}
              </span>
              {hintsRevealed < ch.hints.length && (
                <button onClick={onRevealHint} style={{
                  padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  color: '#f59e0b', fontSize: 10, fontFamily: 'inherit',
                  outline: 'none',
                }}>
                  💡 İpucu Göster
                </button>
              )}
            </div>
            {hintsRevealed > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ch.hints.slice(0, hintsRevealed).map((hint, i) => (
                  <div key={i} style={{
                    padding: '5px 8px', borderRadius: 4,
                    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                    color: 'rgba(226,232,240,0.75)', fontSize: 11,
                    display: 'flex', gap: 6,
                  }}>
                    <span style={{ color: '#f59e0b', flexShrink: 0 }}>{i + 1}.</span>
                    {hint}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Flag submit */}
          <div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={flagInput}
                onChange={e => setFlagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="FLAG{...}"
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${
                    submitState === 'valid'   ? '#00ff41' :
                    submitState === 'invalid' ? '#ef4444' :
                    'rgba(255,255,255,0.1)'
                  }`,
                  borderRadius: 5, padding: '6px 10px',
                  color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit',
                  outline: 'none', transition: 'border-color 0.2s',
                }}
              />
              <button onClick={handleSubmit} style={{
                padding: '6px 14px', borderRadius: 5, cursor: 'pointer',
                background: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.25)',
                color: '#00ff41', fontSize: 12, fontFamily: 'inherit', fontWeight: 700,
                outline: 'none',
              }}>
                Gönder
              </button>
            </div>
            {submitState === 'invalid' && (
              <p style={{ color: '#ef4444', fontSize: 10, margin: '4px 0 0' }}>❌ Geçersiz flag, tekrar dene.</p>
            )}
            {submitState === 'duplicate' && (
              <p style={{ color: '#f59e0b', fontSize: 10, margin: '4px 0 0' }}>⚠ Bu flag zaten gönderildi.</p>
            )}
            {submitState === 'valid' && (
              <p style={{ color: '#00ff41', fontSize: 10, margin: '4px 0 0' }}>✓ Doğru! Sonraki görev açıldı.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Curriculum Tab ───────────────────────────────────────────────────────────

function CurriculumTab({ onNavigateToTool }: { onNavigateToTool: (toolId: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '1.5rem', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <SectionHeader eyebrow="ÖĞRENME YOLU" title="Başlangıçtan Uzmanlığa"
          subtitle="Siber güvenlikte sıfırdan profesyonel seviyeye kapsamlı müfredat" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {MODULES.map((mod, i) => (
            <ModuleCard key={mod.id} module={mod} index={i}
              isExpanded={expanded === mod.id}
              onToggle={() => setExpanded(prev => prev === mod.id ? null : mod.id)}
              onNavigateToTool={onNavigateToTool}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ModuleCard({ module: mod, index, isExpanded, onToggle, onNavigateToTool }: {
  module: Module; index: number; isExpanded: boolean; onToggle: () => void
  onNavigateToTool: (toolId: string) => void
}) {
  const { label: diffLabel, color: diffColor } = DIFFICULTY_META[mod.difficulty]
  const relatedTools = TOOLS.filter(t => mod.toolIds.includes(t.id))

  return (
    <div style={{ display: 'flex', gap: '0.85rem', paddingLeft: '0.4rem' }}>
      <div style={{ flexShrink: 0, width: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 8, background: `${mod.color}12`,
          border: `1px solid ${mod.color}35`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 20 }}>{mod.icon}</div>
      </div>

      <div style={{ flex: 1, border: `1px solid ${isExpanded ? mod.color + '40' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.2s' }}>
        <button onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: '0.85rem 1.1rem',
          background: isExpanded ? `${mod.color}07` : 'rgba(255,255,255,0.015)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ color: '#64748b', fontSize: 10, fontWeight: 700 }}>{String(index + 1).padStart(2, '0')}</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>{mod.title}</span>
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
                <p style={{ color: 'rgba(0,255,65,0.55)', fontSize: 10, letterSpacing: '0.12em', margin: '0 0 6px' }}>KONULAR</p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {mod.topics.map(topic => (
                    <li key={topic} style={{ color: 'rgba(226,232,240,0.72)', fontSize: 11, display: 'flex', gap: '0.4rem' }}>
                      <span style={{ color: mod.color, flexShrink: 0 }}>›</span>{topic}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p style={{ color: 'rgba(0,255,65,0.55)', fontSize: 10, letterSpacing: '0.12em', margin: '0 0 6px' }}>KAYNAKLAR</p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {mod.resources.map(r => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#60a5fa', fontSize: 11, textDecoration: 'none', display: 'flex', gap: '0.3rem' }}>
                        <span>↗</span>{r.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* İlgili araçlar */}
            {relatedTools.length > 0 && (
              <div style={{ marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: `1px solid ${mod.color}15` }}>
                <p style={{ color: 'rgba(0,255,65,0.55)', fontSize: 10, letterSpacing: '0.12em', margin: '0 0 8px' }}>
                  İLGİLİ ARAÇLAR
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {relatedTools.map(tool => (
                    <button key={tool.id} onClick={() => onNavigateToTool(tool.id)}
                      style={{
                        padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
                        background: 'rgba(0,255,65,0.06)', border: '1px solid rgba(0,255,65,0.18)',
                        color: '#4ade80', fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
                        outline: 'none', transition: 'all 0.12s',
                      }}>
                      {tool.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tools Tab ────────────────────────────────────────────────────────────────

function ToolsTab({ initialToolId, onSendCommand, onSelectTool, isMobile = false }: {
  initialToolId: string | null
  onSendCommand: (cmd: string) => void
  onSelectTool: (id: string | null) => void
  isMobile?: boolean
}) {
  const [category, setCategory] = useState<ToolCategory>('Tümü')
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<ToolCard | null>(
    () => initialToolId ? (TOOLS.find(t => t.id === initialToolId) ?? null) : null
  )

  useEffect(() => {
    if (initialToolId) {
      const tool = TOOLS.find(t => t.id === initialToolId)
      if (tool) setSelected(tool)
    }
  }, [initialToolId])

  const filtered = TOOLS.filter(t => {
    const matchCat = category === 'Tümü' || t.category === category
    const q = search.toLowerCase()
    const matchSearch = !q || t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) || t.tags.some(tag => tag.includes(q))
    return matchCat && matchSearch
  })

  const noScrollbar: React.CSSProperties = { scrollbarWidth: 'none', msOverflowStyle: 'none' }

  function selectTool(tool: ToolCard) {
    setSelected(tool)
    onSelectTool(tool.id)
  }

  // ── Mobil: master-detail akışı ──────────────────────────────────────────────
  if (isMobile) {
    // Araç seçili → detay ekranı (tam genişlik)
    if (selected) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <button onClick={() => { setSelected(null); onSelectTool(null) }} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 14px', background: '#060906',
            border: 'none', borderBottom: '1px solid #172517',
            color: '#4ade80', fontSize: 12, fontFamily: 'inherit',
            cursor: 'pointer', flexShrink: 0, outline: 'none',
          }}>
            ← Araç Listesi
          </button>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', ...noScrollbar }}>
            <ToolDetail tool={selected} onSendCommand={onSendCommand} />
          </div>
        </div>
      )
    }

    // Araç seçili değil → tam genişlik liste
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Arama + kategori */}
        <div style={{ padding: '0.65rem 0.85rem', flexShrink: 0, background: '#030303',
          borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Araç ara..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)', borderRadius: 5,
              padding: '0.45rem 0.7rem', color: '#e2e8f0', fontSize: 12,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {TOOL_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
                  fontFamily: 'inherit', border: '1px solid',
                  borderColor: category === cat ? '#00ff41' : 'rgba(255,255,255,0.09)',
                  background: category === cat ? 'rgba(0,255,65,0.1)' : 'transparent',
                  color: category === cat ? '#00ff41' : 'rgba(255,255,255,0.35)', outline: 'none' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        {/* Liste */}
        <div style={{ flex: 1, overflowY: 'auto', ...noScrollbar }}>
          {filtered.map(tool => (
            <button key={tool.id} onClick={() => selectTool(tool)}
              style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: 'transparent', cursor: 'pointer', outline: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#d1d5db', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                  {tool.name}
                </div>
                <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, marginTop: 2 }}>
                  {tool.category}
                </div>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Desktop: split-pane ──────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)',
        overflowY: 'auto', background: '#030303', display: 'flex', flexDirection: 'column', ...noScrollbar }}>
        <div style={{ padding: '0.75rem' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Araç ara..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)', borderRadius: 5,
              padding: '0.45rem 0.7rem', color: '#e2e8f0', fontSize: 11,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ padding: '0 0.65rem 0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
          {TOOL_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                fontFamily: 'inherit', border: '1px solid',
                borderColor: category === cat ? '#00ff41' : 'rgba(255,255,255,0.09)',
                background: category === cat ? 'rgba(0,255,65,0.1)' : 'transparent',
                color: category === cat ? '#00ff41' : 'rgba(255,255,255,0.35)', outline: 'none' }}>
              {cat}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {filtered.map(tool => (
            <button key={tool.id} onClick={() => selectTool(tool)}
              style={{ width: '100%', textAlign: 'left', padding: '0.65rem 0.85rem', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: selected?.id === tool.id ? 'rgba(0,255,65,0.06)' : 'transparent',
                cursor: 'pointer', outline: 'none',
                borderLeft: selected?.id === tool.id ? '2px solid #00ff41' : '2px solid transparent' }}>
              <div style={{ color: selected?.id === tool.id ? '#00ff41' : '#d1d5db',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>{tool.name}</div>
              <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10, marginTop: 1 }}>{tool.category}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', ...noScrollbar }}>
        {selected
          ? <ToolDetail tool={selected} onSendCommand={onSendCommand} />
          : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.18)', fontFamily: 'inherit', fontSize: 12,
              flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 32 }}>🛠</span>
              <span>Soldan bir araç seç</span>
            </div>
        }
      </div>
    </div>
  )
}

function ToolDetail({ tool, onSendCommand }: { tool: ToolCard; onSendCommand: (cmd: string) => void }) {
  const { label: diffLabel, color: diffColor } = DIFFICULTY_META[tool.difficulty]

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <h2 style={{ color: '#00ff41', fontFamily: 'inherit', fontSize: 20, fontWeight: 800, margin: 0 }}>
            {tool.name}
          </h2>
          <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 10,
            background: 'rgba(0,255,65,0.08)', color: '#4ade80', border: '1px solid rgba(0,255,65,0.2)' }}>
            {tool.category}
          </span>
          <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 10,
            background: `${diffColor}10`, color: diffColor, border: `1px solid ${diffColor}25` }}>
            {diffLabel}
          </span>
        </div>
        {/* Versiyon & OS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ color: '#4b5563', fontSize: 11 }}>v{tool.version}</span>
          <span style={{ color: '#1f2937' }}>·</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {tool.os.map(os => (
              <span key={os} style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10,
                background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.6)',
                border: '1px solid rgba(255,255,255,0.07)' }}>{os}</span>
            ))}
          </div>
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
              <code style={{ color: '#00ff41', fontSize: 11, minWidth: 130, flexShrink: 0, fontFamily: 'inherit' }}>
                {f.flag}
              </code>
              <span style={{ color: 'rgba(226,232,240,0.62)', fontSize: 11 }}>{f.description}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Kullanım Örnekleri">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {tool.examples.map((ex, i) => (
            <div key={i} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ background: '#0d0d0d', padding: '0.65rem 0.9rem',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <pre style={{ margin: 0, color: '#e2e8f0', fontSize: 11, fontFamily: 'inherit',
                  whiteSpace: 'pre-wrap', flex: 1 }}>{ex.command}</pre>
                <button onClick={() => onSendCommand(ex.command.split('\n')[0])}
                  title="Terminale gönder"
                  style={{
                    flexShrink: 0, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                    background: 'rgba(0,255,65,0.07)', border: '1px solid rgba(0,255,65,0.15)',
                    color: '#4ade80', fontSize: 10, fontFamily: 'inherit',
                    outline: 'none', whiteSpace: 'nowrap',
                  }}>
                  ⌨ Terminal
                </button>
              </div>
              <div style={{ padding: '0.45rem 0.9rem', background: 'rgba(255,255,255,0.015)',
                color: 'rgba(148,163,184,0.65)', fontSize: 10 }}>{ex.description}</div>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '1.25rem' }}>
        {tool.tags.map(tag => (
          <span key={tag} style={{ padding: '2px 9px', borderRadius: 10, fontSize: 10,
            background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.55)',
            border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'inherit' }}>#{tag}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <p style={{ color: 'rgba(0,255,65,0.45)', fontSize: 10, letterSpacing: '0.2em',
        textTransform: 'uppercase', margin: '0 0 4px' }}>{eyebrow}</p>
      <h2 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 20, fontFamily: 'inherit', margin: '0 0 4px' }}>
        {title}
      </h2>
      <p style={{ color: 'rgba(148,163,184,0.65)', fontSize: 12, margin: 0 }}>{subtitle}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <h3 style={{ color: '#4ade80', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
        letterSpacing: '0.08em', margin: '0 0 0.65rem',
        borderBottom: '1px solid rgba(0,255,65,0.12)', paddingBottom: '0.4rem' }}>{title}</h3>
      {children}
    </div>
  )
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div style={{ marginBottom: '0.85rem', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ padding: '0.35rem 0.85rem', background: 'rgba(255,255,255,0.03)',
        color: 'rgba(148,163,184,0.5)', fontSize: 10, fontFamily: 'inherit',
        borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{label}</div>
      <pre style={{ margin: 0, padding: '0.65rem 0.85rem', background: '#080808',
        color: '#d1d5db', fontSize: 11, fontFamily: 'inherit',
        overflowX: 'auto', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{code}</pre>
    </div>
  )
}
