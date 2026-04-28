'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { TOOLS, CHALLENGES, TOOL_CATEGORIES, TRAINING_SETS } from '@/lib/lab/content'
import { VALID_FLAGS, isValidFlag } from '@/lib/lab/engine'
import { RingEvidenceLog } from '@/lib/lab/evidence'
import { validateChallengeWithMode } from '@/lib/lab/validation/adapter'
import { challengeContracts } from '@/lib/lab/validation/contracts'
import { humanize } from '@/lib/lab/validation/humanize'
import { challengeModes } from '@/lib/lab/validation/modes'
import type { EvidenceLog } from '@/lib/lab/evidence'
import type { ValidationResult } from '@/lib/lab/validation/types'
import type { ToolCard, Challenge, Difficulty, PendingCommand, TrainingSet, Lesson, LessonDifficulty, TerminalExecution, TerminalLine, LessonMission } from '@/lib/lab/types'

const Terminal = dynamic(() => import('@/components/lab/Terminal'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentTab  = 'curriculum' | 'tools' | 'ctf'
type MobileTab   = ContentTab | 'terminal'
type ToolCategory = typeof TOOL_CATEGORIES[number]
type CTFSubmitState = 'valid' | 'invalid' | 'duplicate' | 'blocked'

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_META: Record<Difficulty, { label: string; color: string }> = {
  beginner:     { label: 'Beginner',     color: 'rgb(var(--route-accent-rgb))' },
  intermediate: { label: 'Intermediate', color: '#f59e0b' },
  advanced:     { label: 'Advanced',     color: '#ef4444' },
  expert:       { label: 'Expert',       color: '#7c3aed' },
}

const CONTENT_TABS: { id: ContentTab; icon: string; label: string }[] = [
  { id: 'curriculum', icon: '[]', label: 'Curriculum'    },
  { id: 'tools',      icon: '{}', label: 'Tools'         },
  { id: 'ctf',        icon: '##', label: 'CTF Missions'  },
]

const MOBILE_TABS: { id: MobileTab; icon: string; label: string }[] = [
  { id: 'curriculum', icon: '[]', label: 'Curriculum' },
  { id: 'tools',      icon: '{}', label: 'Tools'      },
  { id: 'ctf',        icon: '##', label: 'CTF'        },
  { id: 'terminal',   icon: '>_', label: 'Terminal'   },
]

const STORAGE_KEYS = {
  unlocked: 'breach-unlocked',
  hints: 'breach-hints',
  flags: 'breach-flags',
} as const

const LAB_HOME = '/home/operator'
const DEFAULT_VISIBLE_SUBMITTED_FLAGS = new Set<string>()
const DEFAULT_VISIBLE_UNLOCKED_LEVELS = new Set<number>([1])
const DEFAULT_VISIBLE_REVEALED_HINTS: Record<number, number> = {}

function readStoredNumberSet(key: string, fallback: readonly number[]): Set<number> {
  if (typeof window === 'undefined') return new Set(fallback)

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return new Set(fallback)

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set(fallback)

    const values = parsed.map(value => {
      if (typeof value === 'number') return value
      if (typeof value === 'string') return Number(value)
      return Number.NaN
    })

    if (values.some(value => Number.isNaN(value))) return new Set(fallback)
    return new Set(values)
  } catch {
    return new Set(fallback)
  }
}

function readStoredStringSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return new Set()

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) {
      return new Set()
    }

    return new Set(parsed)
  } catch {
    return new Set()
  }
}

function readStoredHintMap(key: string): Record<number, number> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    const entries = Object.entries(parsed).map(([level, value]) => {
      const numericLevel = Number(level)
      const numericValue = typeof value === 'number' ? value : Number(value)
      return [numericLevel, numericValue] as const
    })

    if (entries.some(([level, value]) => Number.isNaN(level) || Number.isNaN(value))) return {}

    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabPage() {
  const [mounted,        setMounted]        = useState(false)
  const [contentTab,     setContentTab]     = useState<ContentTab>('curriculum')
  const [mobileTab,      setMobileTab]      = useState<MobileTab>('curriculum')
  const [submittedFlags, setSubmittedFlags] = useState<Set<string>>(new Set())
  const [evidenceLog,    setEvidenceLog]    = useState<EvidenceLog>(new RingEvidenceLog())
  const [ctfValidationMessages, setCtfValidationMessages] = useState<Record<number, string>>({})
  const [terminalCwd,     setTerminalCwd]     = useState(LAB_HOME)
  const [terminalLines,   setTerminalLines]   = useState<TerminalLine[]>([])
  const [terminalInput,   setTerminalInput]   = useState('')
  const [terminalHistory, setTerminalHistory] = useState<string[]>([])
  const [terminalHistIdx, setTerminalHistIdx] = useState(-1)

  // ── Çapraz panel komut enjeksiyonu ──────────────────────────────────────
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null)
  const sendToTerminal = useCallback((cmd: string) => {
    setPendingCommand({ cmd, id: Date.now() })
  }, [])
  const handleCommandConsumed = useCallback(() => setPendingCommand(null), [])
  const [terminalExecutions, setTerminalExecutions] = useState<TerminalExecution[]>([])
  const handleCommandExecuted = useCallback((execution: TerminalExecution) => {
    setTerminalExecutions(prev => [...prev.slice(-79), execution])
  }, [])

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
    setSubmittedFlags(readStoredStringSet(STORAGE_KEYS.flags))
    setUnlockedLevels(readStoredNumberSet(STORAGE_KEYS.unlocked, [1]))
    setRevealedHints(readStoredHintMap(STORAGE_KEYS.hints))
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(STORAGE_KEYS.unlocked, JSON.stringify(Array.from(unlockedLevels)))
    } catch { /* ignore */ }
  }, [mounted, unlockedLevels])

  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(STORAGE_KEYS.hints, JSON.stringify(revealedHints))
    } catch { /* ignore */ }
  }, [mounted, revealedHints])

  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(STORAGE_KEYS.flags, JSON.stringify(Array.from(submittedFlags)))
    } catch { /* ignore */ }
  }, [mounted, submittedFlags])

  // ── Global flag submit ───────────────────────────────────────────────────
  function handleFlagSubmit(flag: string) {
    setSubmittedFlags(prev => new Set([...Array.from(prev), flag]))
  }

  // ── CTF flag submit + level unlock ───────────────────────────────────────
  function validationMessageFromResult(result: ValidationResult): string {
    if (result.missing[0]) return `Not done yet: ${humanize(result.missing[0])}.`
    if (result.forbidden[0]) return `This approach is not accepted: ${humanize(result.forbidden[0])}.`
    if (result.temporalFailures.length > 0) {
      return 'Complete the terminal evidence for this mission first, then resubmit the flag.'
    }
    return 'Terminal evidence missing — solve the mission in the terminal and the flag will reveal automatically.'
  }

  function handleCTFFlag(flag: string, level: number): CTFSubmitState {
    const alreadyAccepted = unlockedLevels.has(level + 1) && submittedFlags.has(flag)
    if (alreadyAccepted || submittedFlags.has(flag)) return 'duplicate'
    if (!isValidFlag(flag)) return 'invalid'

    const mode = challengeModes[level] ?? 'legacy_flag_only'
    const result = validateChallengeWithMode(mode, flag, challengeContracts[level], evidenceLog)

    if (!result.passed) {
      setCtfValidationMessages(prev => ({ ...prev, [level]: validationMessageFromResult(result) }))
      return 'blocked'
    }

    setCtfValidationMessages(prev => {
      if (!prev[level]) return prev
      const next = { ...prev }
      delete next[level]
      return next
    })

    setUnlockedLevels(prev => {
      const next = new Set([...Array.from(prev), level + 1])
      return next
    })
    handleFlagSubmit(flag)
    return 'valid'
  }

  function handleTerminalFlagSubmit(flag: string) {
    const challenge = CHALLENGES.find(item => item.flagKey === flag)
    if (!challenge) return
    handleCTFFlag(flag, challenge.level)
  }

  function handleTerminalFlagRevealed(level: number, flag: string) {
    setSubmittedFlags(prev => {
      if (prev.has(flag)) return prev
      return new Set([...Array.from(prev), flag])
    })
    setUnlockedLevels(prev => {
      if (prev.has(level + 1)) return prev
      return new Set([...Array.from(prev), level + 1])
    })
    setCtfValidationMessages(prev => {
      if (!prev[level]) return prev
      const next = { ...prev }
      delete next[level]
      return next
    })
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

  const visibleSubmittedFlags = mounted ? submittedFlags : DEFAULT_VISIBLE_SUBMITTED_FLAGS
  const visibleUnlockedLevels = mounted ? unlockedLevels : DEFAULT_VISIBLE_UNLOCKED_LEVELS
  const visibleRevealedHints = mounted ? revealedHints : DEFAULT_VISIBLE_REVEALED_HINTS
  const progress = visibleSubmittedFlags.size
  const total    = VALID_FLAGS.size
  const alreadyRevealed = new Set(
    CHALLENGES
      .filter(ch => visibleSubmittedFlags.has(ch.flagKey))
      .map(ch => ch.level),
  )
  const terminalSessionProps = {
    cwd: terminalCwd,
    setCwd: setTerminalCwd,
    lines: terminalLines,
    setLines: setTerminalLines,
    input: terminalInput,
    setInput: setTerminalInput,
    history: terminalHistory,
    setHistory: setTerminalHistory,
    histIdx: terminalHistIdx,
    setHistIdx: setTerminalHistIdx,
    evidenceLog,
    setEvidenceLog,
    unlockedLevels: visibleUnlockedLevels,
    alreadyRevealed,
  }

  function renderContent(tab: ContentTab, isMobile = false) {
    if (tab === 'curriculum') return (
      <CurriculumTab
        terminalExecutions={terminalExecutions}
        onSendCommand={isMobile
        ? cmd => { sendToTerminal(cmd); setMobileTab('terminal') }
        : sendToTerminal}
      />
    )
    if (tab === 'tools') return (
      <ToolsTab
        initialToolId={selectedToolId}
        onSendCommand={isMobile
          ? cmd => { sendToTerminal(cmd); setMobileTab('terminal') }
          : sendToTerminal}
        onSelectTool={setSelectedToolId}
        isMobile={isMobile}
      />
    )
    if (tab === 'ctf') return (
      <CTFTab
        unlockedLevels={visibleUnlockedLevels}
        revealedHints={visibleRevealedHints}
        submittedFlags={visibleSubmittedFlags}
        validationMessages={ctfValidationMessages}
        onFlagSubmit={handleCTFFlag}
        onSendCommand={isMobile
          ? cmd => { sendToTerminal(cmd); setMobileTab('terminal') }
          : sendToTerminal}
        onRevealHint={revealNextHint}
      />
    )
    return null
  }

  // display intentionally omitted — Tailwind hidden/flex classes control visibility
  const shellStyle: React.CSSProperties = {
    height: 'calc(100vh - 64px)',
    flexDirection: 'column',
    background: 'rgb(var(--route-bg-rgb))', color: 'rgb(var(--route-text-rgb))',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    overflow: 'hidden',
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          DESKTOP — 2-column: sol içerik + sağ sabit terminal
          ═══════════════════════════════════════════════════════ */}
      <div className="community-shell hidden md:flex flex-col" style={shellStyle}>
        <DesktopTopBar activeTab={contentTab} onTabChange={setContentTab} progress={progress} total={total} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* Sol — içerik */}
          <div className="community-content-pane" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {renderContent(contentTab)}
          </div>
          {/* Ayırıcı */}
          <div className="community-split-divider" />
          {/* Sağ — terminal (her zaman görünür) */}
          <div className="community-terminal-pane" style={{ width: '44%', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <TerminalPanelBar />
            <div style={{ flex: 1, minHeight: 0 }}>
            <Terminal
                {...terminalSessionProps}
                isActive={mobileTab !== 'terminal'}
                pendingCommand={pendingCommand}
                onCommandConsumed={handleCommandConsumed}
                onFlagSubmit={handleTerminalFlagSubmit}
                onFlagRevealed={handleTerminalFlagRevealed}
                onCommandExecuted={handleCommandExecuted}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MOBİL — tam ekran + alt navigasyon
          ═══════════════════════════════════════════════════════ */}
      <div className="community-shell flex md:hidden flex-col" style={shellStyle}>
        <MobileTopBar activeTab={mobileTab} progress={progress} total={total} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {mobileTab === 'terminal'
            ? <Terminal
                {...terminalSessionProps}
                isActive={mobileTab === 'terminal'}
                pendingCommand={pendingCommand}
                onCommandConsumed={handleCommandConsumed}
                onFlagSubmit={handleTerminalFlagSubmit}
                onFlagRevealed={handleTerminalFlagRevealed}
                onCommandExecuted={handleCommandExecuted}
              />
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
    <div className="community-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, letterSpacing: '0.1em' }}>[]</span>
        <span style={{ color: 'rgb(var(--route-accent-rgb))', fontWeight: 800, letterSpacing: '0.18em', fontSize: 12 }}>
          BREACH LAB
        </span>
        <span style={{ padding: '1px 7px', borderRadius: 3, fontSize: 9, fontWeight: 700,
          background: 'rgb(var(--route-accent-rgb) / 0.08)', color: 'rgb(var(--route-accent-rgb) / 0.65)',
          border: '1px solid rgb(var(--route-accent-rgb) / 0.16)' }}>CYBER SECURITY</span>
      </div>

      <div className="community-tab-group">
        {CONTENT_TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => onTabChange(tab.id)} className="community-tab-btn" data-active={isActive}>
              <span style={{ fontSize: 13 }}>{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'rgb(var(--route-accent-rgb) / 0.82)', fontSize: 11 }}>
          OPS <strong>{progress}</strong>/{total}
        </span>
        <div className="route-progress" style={{ width: 64, height: 4 }}>
          <div style={{
            width: `${total ? (progress / total) * 100 : 0}%`, height: '100%',
            background: 'linear-gradient(90deg, rgb(var(--route-accent-rgb)), rgb(var(--route-accent-alt-rgb)))',
            borderRadius: 2, transition: 'width 0.5s',
            boxShadow: progress > 0 ? '0 0 8px rgb(var(--route-accent-rgb) / 0.55)' : 'none',
          }} />
        </div>
      </div>
    </div>
  )
}

function TerminalPanelBar() {
  return (
    <div className="community-panelbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 11 }}>{'>_'}</span>
        <span style={{ color: 'rgb(var(--route-muted-rgb) / 0.8)', fontSize: 10, letterSpacing: '0.12em', fontWeight: 700 }}>
          LIVE TERMINAL
        </span>
      </div>
      <span style={{ color: 'rgb(var(--route-muted-rgb) / 0.52)', fontSize: 9, letterSpacing: '0.08em' }}>TAB - UP/DOWN - Ctrl+L</span>
    </div>
  )
}

// ─── Mobile Top Bar ───────────────────────────────────────────────────────────

function MobileTopBar({ activeTab, progress, total }: {
  activeTab: MobileTab; progress: number; total: number
}) {
  const current = MOBILE_TABS.find(t => t.id === activeTab)
  return (
    <div className="community-mobilebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'rgb(var(--route-accent-rgb))', fontSize: 13, letterSpacing: '0.1em' }}>[]</span>
        <span style={{ color: 'rgb(var(--route-accent-rgb))', fontWeight: 800, fontSize: 12, letterSpacing: '0.12em' }}>
          BREACH LAB
        </span>
        {current && <span style={{ color: 'rgb(var(--route-muted-rgb) / 0.72)', fontSize: 11 }}>/ {current.icon} {current.label}</span>}
      </div>
      <span style={{ color: 'rgb(var(--route-accent-rgb) / 0.82)', fontSize: 11 }}>OPS {progress}/{total}</span>
    </div>
  )
}

function MobileBottomNav({ activeTab, onTabChange }: {
  activeTab: MobileTab; onTabChange: (t: MobileTab) => void
}) {
  return (
    <div className="community-bottom-nav">
      {MOBILE_TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button key={tab.id} onClick={() => onTabChange(tab.id)} className="community-bottom-nav-btn" data-active={isActive}>
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            <span className="community-bottom-nav-label">
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
  validationMessages, onFlagSubmit, onSendCommand, onRevealHint,
}: {
  unlockedLevels: Set<number>
  revealedHints: Record<number, number>
  submittedFlags: Set<string>
  validationMessages: Record<number, string>
  onFlagSubmit: (flag: string, level: number) => CTFSubmitState
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
            <p style={{ color: 'rgb(var(--route-accent-rgb) / 0.65)', fontSize: 10, letterSpacing: '0.2em', margin: '0 0 4px' }}>
              PRACTICE MISSIONS
            </p>
            <h2 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 20, fontFamily: 'inherit', margin: 0 }}>
              CTF Missions
            </h2>
            <p style={{ color: 'rgba(148,163,184,0.65)', fontSize: 12, margin: '4px 0 0' }}>
              Solve missions in the terminal — flags reveal automatically when prerequisites are met
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgb(var(--route-accent-rgb) / 0.82)', fontSize: 20, fontWeight: 800 }}>{completed}/{CHALLENGES.length}</div>
            <div style={{ color: 'rgb(var(--route-muted-rgb) / 0.72)', fontSize: 10, letterSpacing: '0.1em' }}>COMPLETED</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(0,255,65,0.08)', borderRadius: 2, marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{
            width: `${CHALLENGES.length ? (completed / CHALLENGES.length) * 100 : 0}%`,
            height: '100%', background: 'linear-gradient(90deg, rgb(var(--route-accent-rgb)), rgb(var(--route-accent-alt-rgb)))',
            borderRadius: 2, transition: 'width 0.6s ease',
          }} />
        </div>

        {/* Challenge grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(420px, 100%), 1fr))', gap: '1rem' }}>
          {CHALLENGES.map(ch => (
            <ChallengeCard
              key={ch.level}
              challenge={ch}
              isUnlocked={unlockedLevels.has(ch.level)}
              isCompleted={submittedFlags.has(ch.flagKey)}
              hintsRevealed={revealedHints[ch.level] ?? 0}
              validationMessage={validationMessages[ch.level]}
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

type HintSegment = { kind: 'text' | 'code'; value: string }

function splitHintSegments(hint: string): HintSegment[] {
  return hint
    .split(/(`[^`]+`)/g)
    .filter(Boolean)
    .map((segment): HintSegment => segment.startsWith('`') && segment.endsWith('`')
      ? { kind: 'code', value: segment.slice(1, -1) }
      : { kind: 'text', value: segment })
}

function ChallengeCard({
  challenge: ch, isUnlocked, isCompleted, hintsRevealed,
  validationMessage, onFlagSubmit, onSendCommand, onRevealHint,
}: {
  challenge: Challenge
  isUnlocked: boolean
  isCompleted: boolean
  hintsRevealed: number
  validationMessage?: string
  onFlagSubmit: (flag: string) => CTFSubmitState
  onSendCommand: () => void
  onRevealHint: () => void
}) {
  const [flagInput,  setFlagInput]  = useState('')
  const [submitState, setSubmitState] = useState<'idle' | CTFSubmitState>('idle')
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  function handleSubmit() {
    if (!flagInput.trim()) return
    const result = onFlagSubmit(flagInput.trim())
    setSubmitState(result)
    if (result === 'valid') setFlagInput('')
    setTimeout(() => setSubmitState('idle'), result === 'blocked' ? 4500 : 2500)
  }

  async function copyCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command)
      setCopiedCommand(command)
      setTimeout(() => {
        setCopiedCommand(current => current === command ? null : current)
      }, 1000)
    } catch {
      // Clipboard support is best-effort; avoid showing false success feedback.
    }
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
          Complete the previous mission to unlock this one.
        </div>
      ) : isCompleted ? (
        <div style={{ padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'rgb(var(--route-accent-rgb))', fontSize: 14 }}>✓</span>
          <span style={{ color: 'rgb(var(--route-accent-rgb) / 0.82)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>AUTO-COMPLETED</span>
          <code style={{ marginLeft: 'auto', color: 'rgba(0,255,65,0.5)', fontSize: 10 }}>{ch.flagKey}</code>
        </div>
      ) : (
        <div style={{ padding: '0.85rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Terminale git butonu */}
          <button onClick={onSendCommand} style={{
            padding: '6px 12px', borderRadius: 5, cursor: 'pointer',
            background: 'rgb(var(--route-accent-rgb) / 0.08)', border: '1px solid rgba(0,255,65,0.2)',
            color: 'rgb(var(--route-accent-rgb) / 0.82)', fontSize: 11, fontFamily: 'inherit', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content',
            outline: 'none',
          }}>
            <span>⌨</span> Open in Terminal
          </button>

          {/* Hint section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10, letterSpacing: '0.1em' }}>
                HINT {hintsRevealed}/{ch.hints.length}
              </span>
              {hintsRevealed < ch.hints.length && (
                <button onClick={onRevealHint} style={{
                  padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  color: '#f59e0b', fontSize: 10, fontFamily: 'inherit',
                  outline: 'none',
                }}>
                  💡 Reveal Hint
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
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {splitHintSegments(hint).map((segment, segmentIndex) => {
                        if (segment.kind === 'text') {
                          return <span key={`${i}-text-${segmentIndex}`}>{segment.value}</span>
                        }

                        const copied = copiedCommand === segment.value
                        return (
                          <button
                            key={`${i}-code-${segmentIndex}`}
                            type="button"
                            title="Copy command"
                            onClick={() => { void copyCommand(segment.value) }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              margin: '0 3px',
                              padding: '1px 5px',
                              borderRadius: 4,
                              border: `1px solid ${copied ? 'rgba(0,255,65,0.72)' : 'rgba(0,255,65,0.24)'}`,
                              background: copied ? 'rgba(0,255,65,0.16)' : 'rgba(0,255,65,0.08)',
                              color: copied ? '#bbf7d0' : 'rgb(var(--route-accent-rgb))',
                              fontFamily: 'inherit',
                              fontSize: 10,
                              cursor: 'copy',
                              boxShadow: copied ? '0 0 12px rgba(0,255,65,0.28)' : 'none',
                              transition: 'border-color 0.18s, background 0.18s, box-shadow 0.18s',
                            }}
                          >
                            {segment.value}
                          </button>
                        )
                      })}
                    </span>
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
                  flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${
                    submitState === 'valid'   ? '#00ff41' :
                    submitState === 'invalid' ? '#ef4444' :
                    submitState === 'blocked' ? '#f59e0b' :
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
                color: 'rgb(var(--route-accent-rgb))', fontSize: 12, fontFamily: 'inherit', fontWeight: 700,
                outline: 'none', flexShrink: 0,
              }}>
                Submit
              </button>
            </div>
            {submitState === 'invalid' && (
              <p style={{ color: '#ef4444', fontSize: 10, margin: '4px 0 0' }}>❌ Invalid flag, try again.</p>
            )}
            {submitState === 'duplicate' && (
              <p style={{ color: '#f59e0b', fontSize: 10, margin: '4px 0 0' }}>⚠ This flag was already submitted.</p>
            )}
            {submitState === 'blocked' && (
              <p style={{ color: '#f59e0b', fontSize: 10, lineHeight: 1.5, margin: '4px 0 0' }}>
                {validationMessage ?? 'Complete the terminal evidence first, then retry.'}
              </p>
            )}
            {submitState === 'valid' && (
              <p style={{ color: 'rgb(var(--route-accent-rgb))', fontSize: 10, margin: '4px 0 0' }}>✓ Correct! Next mission unlocked.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Curriculum Tab ───────────────────────────────────────────────────────────

const LESSON_DIFF_META: Record<LessonDifficulty, { label: string; color: string; bg: string }> = {
  kolay: { label: 'EASY',   color: 'rgb(var(--route-accent-rgb) / 0.82)', bg: 'rgba(74,222,128,0.08)' },
  orta:  { label: 'MEDIUM', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)'  },
  zor:   { label: 'HARD',   color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
}

const DIFF_ORDER: LessonDifficulty[] = ['kolay', 'orta', 'zor']
const CURRICULUM_STORAGE_KEY = 'breach-curriculum-v3'
const LEGACY_CURRICULUM_STORAGE_KEY = 'breach-curriculum-v2'

type MissionProofSnapshot = {
  matchedIds: string[]
  manualCount: number
}

type CurriculumProgressSnapshot = {
  completed: string[]
  missionProof: Record<string, MissionProofSnapshot>
}

function normalizeLabText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function includesAll(text: string, values: string[]): boolean {
  return values.every(value => text.includes(normalizeLabText(value)))
}

function validateLessonMission(mission: LessonMission, executions: TerminalExecution[]) {
  const manualExecutions = executions.filter(execution => execution.source === 'manual')
  const matched = mission.validation.filter(check => {
    if (check.type === 'cwdEquals') {
      return manualExecutions.some(execution => normalizeLabText(execution.cwdAfter) === normalizeLabText(check.values[0] ?? ''))
    }

    if (check.type === 'commandIncludesAll') {
      return manualExecutions.some(execution => includesAll(normalizeLabText(execution.raw), check.values))
    }

    if (check.type === 'commandIncludesAny') {
      return manualExecutions.some(execution => {
        const raw = normalizeLabText(execution.raw)
        return check.values.some(value => raw.includes(normalizeLabText(value)))
      })
    }

    const outputs = manualExecutions.map(execution => normalizeLabText(execution.output.join('\n')))
    return outputs.some(output => includesAll(output, check.values))
  })

  return {
    matched,
    missing: mission.validation.filter(check => !matched.some(item => item.id === check.id)),
    passed: matched.length === mission.validation.length,
    manualCount: manualExecutions.length,
  }
}

function useCurriculumProgress() {
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [missionProof, setMissionProof] = useState<Record<string, MissionProofSnapshot>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CURRICULUM_STORAGE_KEY) ?? localStorage.getItem(LEGACY_CURRICULUM_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as CurriculumProgressSnapshot | string[]
      if (Array.isArray(parsed)) {
        setCompleted(new Set(parsed))
        return
      }

      setCompleted(new Set(parsed.completed ?? []))
      setMissionProof(parsed.missionProof ?? {})
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      const snapshot: CurriculumProgressSnapshot = {
        completed: Array.from(completed),
        missionProof,
      }
      localStorage.setItem(CURRICULUM_STORAGE_KEY, JSON.stringify(snapshot))
    } catch { /* ignore */ }
  }, [completed, missionProof])

  const markComplete = (lessonId: string, proof?: MissionProofSnapshot) => {
    setCompleted(prev => {
      if (prev.has(lessonId)) return prev
      const next = new Set(prev)
      next.add(lessonId)
      return next
    })

    if (proof) {
      setMissionProof(prev => ({ ...prev, [lessonId]: proof }))
    }
  }

  const storeMissionProof = (lessonId: string, proof: MissionProofSnapshot) => {
    setMissionProof(prev => {
      if (prev[lessonId]) return prev
      return { ...prev, [lessonId]: proof }
    })
  }

  return { completed, missionProof, markComplete, storeMissionProof }
}

function isSetUnlocked(setIndex: number, sets: TrainingSet[], completed: Set<string>): boolean {
  if (setIndex === 0) return true
  const prev = sets[setIndex - 1]
  return prev.lessons.every(l => completed.has(l.id))
}

function setProgress(set: TrainingSet, completed: Set<string>): number {
  return set.lessons.filter(l => completed.has(l.id)).length
}

function isDifficultyUnlocked(set: TrainingSet, difficulty: LessonDifficulty, completed: Set<string>): boolean {
  const difficultyIndex = DIFF_ORDER.indexOf(difficulty)
  if (difficultyIndex <= 0) return true

  return DIFF_ORDER.slice(0, difficultyIndex).every(level =>
    set.lessons.filter(lesson => lesson.difficulty === level).every(lesson => completed.has(lesson.id))
  )
}

function isLessonUnlocked(lessons: Lesson[], lessonIndex: number, completed: Set<string>): boolean {
  if (lessonIndex === 0) return true
  return completed.has(lessons[lessonIndex - 1].id)
}

function CurriculumTab({ onSendCommand, terminalExecutions }: { onSendCommand: (cmd: string) => void; terminalExecutions: TerminalExecution[] }) {
  const { completed, missionProof, markComplete, storeMissionProof } = useCurriculumProgress()
  const [activeSet, setActiveSet] = useState<string>(TRAINING_SETS[0].id)
  const [activeDiff, setActiveDiff] = useState<LessonDifficulty>('kolay')

  const currentSet = TRAINING_SETS.find(s => s.id === activeSet) ?? TRAINING_SETS[0]
  const unlockedDifficulties = DIFF_ORDER.filter(difficulty => isDifficultyUnlocked(currentSet, difficulty, completed))
  const lessons = currentSet.lessons.filter(l => l.difficulty === activeDiff)
  const totalCompleted = TRAINING_SETS.reduce((acc, s) => acc + setProgress(s, completed), 0)
  const totalLessons   = TRAINING_SETS.reduce((acc, s) => acc + s.lessons.length, 0)

  useEffect(() => {
    if (!isDifficultyUnlocked(currentSet, activeDiff, completed)) {
      setActiveDiff(unlockedDifficulties[0] ?? 'kolay')
    }
  }, [activeDiff, completed, currentSet, unlockedDifficulties])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Global header ── */}
      <div style={{ padding: '1.2rem 1.5rem 0.8rem', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
          <div>
            <p style={{ color: 'rgba(0,255,65,0.5)', fontSize: 9, letterSpacing: '0.18em', margin: 0 }}>TRAINING SETS</p>
            <h2 style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 800, margin: '2px 0 0', letterSpacing: '0.04em' }}>
              Learning Path
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: 'rgb(var(--route-accent-rgb) / 0.82)', fontSize: 18, fontWeight: 800 }}>{totalCompleted}</span>
            <span style={{ color: '#475569', fontSize: 12 }}>/{totalLessons}</span>
            <p style={{ color: '#475569', fontSize: 9, margin: '2px 0 0', letterSpacing: '0.1em' }}>LESSONS COMPLETED</p>
          </div>
        </div>

        {/* ── Set tabs ── */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TRAINING_SETS.map((set, i) => {
            const unlocked  = isSetUnlocked(i, TRAINING_SETS, completed)
            const prog      = setProgress(set, completed)
            const done      = prog === set.lessons.length
            const isActive  = activeSet === set.id
            return (
              <button key={set.id}
                onClick={() => { if (unlocked) setActiveSet(set.id) }}
                disabled={!unlocked}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 7, cursor: unlocked ? 'pointer' : 'not-allowed',
                  border: isActive ? `1px solid ${set.color}50` : '1px solid rgba(255,255,255,0.07)',
                  background: isActive ? `${set.color}12` : unlocked ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.3)',
                  color: !unlocked ? '#334155' : isActive ? set.color : '#64748b',
                  fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                  opacity: unlocked ? 1 : 0.45,
                }}>
                <span>{unlocked ? set.icon : '🔒'}</span>
                <span>{set.title}</span>
                {unlocked && (
                  <span style={{ fontSize: 9, background: done ? `${set.color}20` : 'rgba(255,255,255,0.06)',
                    color: done ? set.color : '#475569', border: `1px solid ${done ? set.color + '30' : 'transparent'}`,
                    borderRadius: 3, padding: '1px 5px' }}>
                    {prog}/{set.lessons.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Set detail ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Set info bar */}
        <div style={{ padding: '0.7rem 1.5rem', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: currentSet.color, fontWeight: 700, fontSize: 12 }}>{currentSet.title}</span>
            <span style={{ color: '#475569', fontSize: 11, marginLeft: 8 }}>{currentSet.subtitle}</span>
          </div>
          {/* Difficulty pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            {DIFF_ORDER.map(d => {
              const m = LESSON_DIFF_META[d]
              const count = currentSet.lessons.filter(l => l.difficulty === d).length
              const doneC = currentSet.lessons.filter(l => l.difficulty === d && completed.has(l.id)).length
              const unlocked = isDifficultyUnlocked(currentSet, d, completed)
              return (
                <button key={d} onClick={() => { if (unlocked) setActiveDiff(d) }} disabled={!unlocked}
                  style={{ padding: '3px 10px', borderRadius: 5,
                    background: activeDiff === d ? m.bg : 'transparent',
                    border: `1px solid ${activeDiff === d ? m.color + '50' : 'rgba(255,255,255,0.07)'}`,
                    color: !unlocked ? '#334155' : activeDiff === d ? m.color : '#475569',
                    fontFamily: 'inherit', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    transition: 'all 0.12s',
                    opacity: unlocked ? 1 : 0.46,
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                  }}>
                  {m.label} <span style={{ opacity: 0.7 }}>{doneC}/{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Lessons list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem',
          scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
          {currentSet.overview && (
            <div style={{
              marginBottom: '1rem',
              border: `1px solid ${currentSet.color}20`,
              borderRadius: 12,
              background: 'linear-gradient(180deg, rgba(6,10,8,0.96), rgba(4,6,5,0.92))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.9fr)',
                gap: '1rem',
                padding: '1rem 1.1rem',
              }}>
                <div>
                  <p style={{ color: currentSet.color, fontSize: 9, letterSpacing: '0.2em', margin: '0 0 6px', fontWeight: 800 }}>
                    OPERATION BRIEFING
                  </p>
                  <h3 style={{ color: '#f8fafc', fontSize: 18, lineHeight: 1.25, margin: 0, fontWeight: 800 }}>
                    {currentSet.overview.heading}
                  </h3>
                  <p style={{ color: 'rgba(148,163,184,0.82)', fontSize: 12, lineHeight: 1.75, margin: '10px 0 0' }}>
                    {currentSet.overview.summary}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: '0.85rem 0.9rem',
                    background: 'rgba(255,255,255,0.02)',
                  }}>
                    <p style={{ color: '#64748b', fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', margin: '0 0 8px' }}>
                      LEARNING MODEL
                    </p>
                    <p style={{ color: 'rgba(226,232,240,0.8)', fontSize: 11, lineHeight: 1.7, margin: 0 }}>
                      {currentSet.overview.assessment}
                    </p>
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                padding: '0 1.1rem 1rem',
              }}>
                {currentSet.overview.pillars.map(pillar => (
                  <span key={pillar} style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: `${currentSet.color}0f`,
                    color: 'rgba(226,232,240,0.78)',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    fontWeight: 700,
                  }}>
                    {pillar}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {lessons.map((lesson, i) => (
              <LessonCard key={lesson.id} lesson={lesson} index={i}
                isCompleted={completed.has(lesson.id)}
                isUnlocked={isLessonUnlocked(lessons, i, completed)}
                proofSnapshot={missionProof[lesson.id]}
                onComplete={(proof) => markComplete(lesson.id, proof)}
                onStoreMissionProof={(proof) => storeMissionProof(lesson.id, proof)}
                onPractice={lesson.practiceCmd ? () => onSendCommand(lesson.practiceCmd!) : undefined}
                terminalExecutions={terminalExecutions}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function LessonCard({ lesson, index, isCompleted, isUnlocked, proofSnapshot, onComplete, onStoreMissionProof, onPractice, terminalExecutions }: {
  lesson: Lesson
  index: number
  isCompleted: boolean
  isUnlocked: boolean
  proofSnapshot?: MissionProofSnapshot
  onComplete: (proof?: MissionProofSnapshot) => void
  onStoreMissionProof: (proof: MissionProofSnapshot) => void
  onPractice?: () => void
  terminalExecutions: TerminalExecution[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [revealedHints, setRevealedHints] = useState(0)
  const [validationState, setValidationState] = useState<'idle' | 'failed' | 'passed'>('idle')
  const m = LESSON_DIFF_META[lesson.difficulty]
  const missionStatus = lesson.mission ? validateLessonMission(lesson.mission, terminalExecutions) : null
  const totalChecks = lesson.mission?.validation.length ?? 0
  const persistedMatchedIds = new Set(
    proofSnapshot?.matchedIds
    ?? (lesson.mission && isCompleted ? lesson.mission.validation.map(check => check.id) : [])
  )
  const liveMatchedIds = new Set(missionStatus?.matched.map(item => item.id) ?? [])
  const matchedIds = new Set(
    isCompleted
      ? [...Array.from(persistedMatchedIds), ...Array.from(liveMatchedIds)]
      : Array.from(liveMatchedIds)
  )
  const matchedCount = matchedIds.size
  const displayManualCount = isCompleted
    ? Math.max(proofSnapshot?.manualCount ?? 0, missionStatus?.manualCount ?? 0, matchedCount > 0 ? 1 : 0)
    : (missionStatus?.manualCount ?? 0)

  useEffect(() => {
    if (!lesson.mission || !isCompleted || proofSnapshot) return
    onStoreMissionProof({
      matchedIds: lesson.mission.validation.map(check => check.id),
      manualCount: Math.max(missionStatus?.manualCount ?? 0, 1),
    })
  }, [isCompleted, lesson.mission, missionStatus?.manualCount, onStoreMissionProof, proofSnapshot])

  const handleValidate = () => {
    if (!lesson.mission || !missionStatus) return
    if (missionStatus.passed) {
      setValidationState('passed')
      if (!isCompleted) {
        onComplete({
          matchedIds: lesson.mission.validation.map(check => check.id),
          manualCount: Math.max(missionStatus.manualCount, 1),
        })
      }
      return
    }
    setValidationState('failed')
  }

  const revealNextHint = () => {
    if (!lesson.mission) return
    setRevealedHints(prev => Math.min(prev + 1, lesson.mission!.hints.length))
  }

  const resetMissionState = () => {
    setValidationState('idle')
    setRevealedHints(0)
  }

  return (
    <div
      style={{
        border: `1px solid ${isCompleted ? 'rgba(74,222,128,0.28)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 14,
        overflow: 'hidden',
        background: isCompleted
          ? 'linear-gradient(180deg, rgba(9,42,20,0.98), rgba(4,18,9,0.96))'
          : isUnlocked
            ? 'linear-gradient(180deg, rgba(7,10,9,0.95), rgba(4,6,6,0.9))'
            : 'linear-gradient(180deg, rgba(5,7,8,0.9), rgba(3,4,5,0.88))',
        boxShadow: isCompleted ? '0 0 0 1px rgba(74,222,128,0.12), inset 0 0 42px rgba(34,197,94,0.08)' : 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
        opacity: isUnlocked || isCompleted ? 1 : 0.48,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.95rem',
          padding: '0.9rem 1rem',
          cursor: isUnlocked || isCompleted ? 'pointer' : 'not-allowed',
        }}
        onClick={() => {
          if (!isUnlocked && !isCompleted) return
          setExpanded(v => !v)
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            border: `1px solid ${isCompleted ? 'rgba(74,222,128,0.45)' : isUnlocked ? 'rgba(71,85,105,0.72)' : 'rgba(51,65,85,0.5)'}`,
            background: isCompleted ? 'rgba(34,197,94,0.14)' : isUnlocked ? 'rgba(2,6,8,0.75)' : 'rgba(2,6,8,0.58)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: isCompleted ? '#86efac' : isUnlocked ? '#94a3b8' : '#475569',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.08em',
          }}
        >
          {isCompleted ? 'OK' : String(index + 1).padStart(2, '0')}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#475569', fontSize: 10, fontWeight: 700 }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span
              style={{
                color: isCompleted ? '#86efac' : '#f8fafc',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.01em',
                textDecoration: isCompleted ? 'line-through' : 'none',
                opacity: isCompleted ? 0.78 : 1,
              }}
            >
              {lesson.title}
            </span>
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 8,
                fontWeight: 800,
                background: m.bg,
                color: m.color,
                border: `1px solid ${m.color}30`,
                letterSpacing: '0.08em',
              }}
            >
              {m.label}
            </span>
            {!isUnlocked && !isCompleted && (
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 8,
                  fontWeight: 800,
                  background: 'rgba(15,23,42,0.95)',
                  color: '#64748b',
                  border: '1px solid rgba(255,255,255,0.08)',
                  letterSpacing: '0.08em',
                }}
              >
                LOCKED
              </span>
            )}
            {lesson.mission && (
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 8,
                  fontWeight: 800,
                background: (isCompleted || missionStatus?.passed) ? 'rgba(74,222,128,0.12)' : 'rgba(15,23,42,0.95)',
                color: (isCompleted || missionStatus?.passed) ? '#86efac' : '#94a3b8',
                border: `1px solid ${(isCompleted || missionStatus?.passed) ? 'rgba(74,222,128,0.22)' : 'rgba(255,255,255,0.08)'}`,
                letterSpacing: '0.08em',
              }}
            >
                EVIDENCE {matchedCount}/{totalChecks}
              </span>
            )}
          </div>
          <p
            style={{
              color: isCompleted ? 'rgba(187,247,208,0.82)' : '#64748b',
              fontSize: 11,
              margin: '4px 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {lesson.description}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {isCompleted && (
            <span style={{
              padding: '3px 8px',
              borderRadius: 999,
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(74,222,128,0.24)',
              color: '#86efac',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.12em',
            }}>
              COMPLETED
            </span>
          )}
          <span style={{ color: '#475569', fontSize: 10 }}>{lesson.duration} min</span>
          <span
            style={{
              color: expanded ? 'rgb(var(--route-accent-rgb) / 0.82)' : '#334155',
              fontSize: 14,
              transition: 'transform 0.2s ease, color 0.2s ease',
              transform: expanded ? 'rotate(90deg)' : 'none',
            }}
          >
            ›
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {lesson.mission ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
                  gap: '0.9rem',
                  marginTop: '0.95rem',
                }}
              >
                <div
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: '0.9rem',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <p style={{ color: 'rgb(var(--route-accent-rgb) / 0.82)', fontSize: 9, letterSpacing: '0.18em', margin: '0 0 8px', fontWeight: 800 }}>
                    OPERATION BRIEFING
                  </p>
                  <p style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700, lineHeight: 1.55, margin: 0 }}>
                    {lesson.mission.objective}
                  </p>
                  <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 11, lineHeight: 1.75, margin: '10px 0 0' }}>
                    {lesson.mission.operatorBrief}
                  </p>
                </div>

                <div
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: '0.9rem',
                    background: 'rgba(2,6,8,0.78)',
                  }}
                >
                  <p style={{ color: '#94a3b8', fontSize: 9, letterSpacing: '0.18em', margin: '0 0 8px', fontWeight: 800 }}>
                    MISSION DETAILS
                  </p>
                  <p style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.7, margin: 0 }}>{lesson.mission.task}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: '0.8rem' }}>
                    {lesson.mission.evidence.map(item => (
                      <span
                        key={item}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#cbd5e1',
                          fontSize: 10,
                          lineHeight: 1.4,
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: '0.9rem',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: '0.95rem',
                  background: 'linear-gradient(180deg, rgba(1,8,6,0.94), rgba(3,8,6,0.85))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ color: '#94a3b8', fontSize: 9, letterSpacing: '0.18em', margin: 0, fontWeight: 800 }}>
                      VALIDATION CENTER
                    </p>
                    <p style={{ color: 'rgba(148,163,184,0.76)', fontSize: 11, margin: '8px 0 0', lineHeight: 1.7 }}>
                      Type your own commands into the terminal for this mission. The system only collects evidence from manual entries.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: (isCompleted || missionStatus?.passed) ? '#86efac' : '#e2e8f0', fontSize: 18, fontWeight: 800, margin: 0 }}>
                      {matchedCount}/{totalChecks}
                    </p>
                    <p style={{ color: '#475569', fontSize: 10, margin: '3px 0 0', letterSpacing: '0.08em' }}>
                      MANUAL COMMANDS {displayManualCount}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, marginTop: '0.85rem' }}>
                  {lesson.mission.validation.map(check => {
                    const isMatched = matchedIds.has(check.id)
                    return (
                      <div
                        key={check.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '0.7rem 0.85rem',
                          borderRadius: 10,
                          border: `1px solid ${isMatched ? 'rgba(74,222,128,0.22)' : 'rgba(255,255,255,0.07)'}`,
                          background: isMatched ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            border: `1px solid ${isMatched ? 'rgba(74,222,128,0.45)' : 'rgba(100,116,139,0.4)'}`,
                            background: isMatched ? 'rgba(74,222,128,0.14)' : 'rgba(2,6,8,0.9)',
                            color: isMatched ? '#86efac' : '#64748b',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {isMatched ? '✓' : ''}
                        </span>
                        <span style={{ color: isMatched ? '#dcfce7' : '#cbd5e1', fontSize: 11, lineHeight: 1.6 }}>
                          {check.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {validationState === 'failed' && missionStatus && missionStatus.missing.length > 0 && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      padding: '0.8rem 0.9rem',
                      borderRadius: 10,
                      border: '1px solid rgba(248,113,113,0.22)',
                      background: 'rgba(127,29,29,0.16)',
                    }}
                  >
                    <p style={{ color: '#fda4af', fontSize: 10, letterSpacing: '0.14em', fontWeight: 800, margin: '0 0 6px' }}>
                      MISSING EVIDENCE
                    </p>
                    <p style={{ color: '#fecdd3', fontSize: 11, margin: 0, lineHeight: 1.7 }}>
                      {missionStatus.missing.map(check => check.label).join(' | ')}
                    </p>
                  </div>
                )}

                {validationState === 'passed' && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      padding: '0.85rem 0.95rem',
                      borderRadius: 10,
                      border: '1px solid rgba(74,222,128,0.2)',
                      background: 'rgba(20,83,45,0.16)',
                    }}
                  >
                    <p style={{ color: '#86efac', fontSize: 10, letterSpacing: '0.18em', fontWeight: 800, margin: '0 0 6px' }}>
                      WHY THIS WORKED
                    </p>
                    <p style={{ color: '#dcfce7', fontSize: 11, margin: 0, lineHeight: 1.8 }}>
                      {lesson.mission.reflection}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: '0.95rem' }}>
                  <button
                    onClick={handleValidate}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: 'rgba(0,255,65,0.1)',
                      border: '1px solid rgba(0,255,65,0.24)',
                      color: 'rgb(var(--route-accent-rgb) / 0.9)',
                      fontFamily: 'inherit',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                    }}
                  >
                    VERIFY SOLUTION
                  </button>
                  <button
                    onClick={revealNextHint}
                    disabled={revealedHints >= lesson.mission.hints.length}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      cursor: revealedHints >= lesson.mission.hints.length ? 'default' : 'pointer',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: revealedHints >= lesson.mission.hints.length ? '#475569' : '#e2e8f0',
                      fontFamily: 'inherit',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      opacity: revealedHints >= lesson.mission.hints.length ? 0.55 : 1,
                    }}
                  >
                    {revealedHints >= lesson.mission.hints.length ? 'ALL HINTS REVEALED' : `SHOW HINT ${revealedHints}/${lesson.mission.hints.length}`}
                  </button>
                  {validationState !== 'idle' && (
                    <button
                      onClick={resetMissionState}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#94a3b8',
                        fontFamily: 'inherit',
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                      }}
                    >
                      CLEAR STATE
                    </button>
                  )}
                </div>

                {revealedHints > 0 && (
                  <div style={{ display: 'grid', gap: 8, marginTop: '0.95rem' }}>
                    {lesson.mission.hints.slice(0, revealedHints).map((hint, hintIndex) => (
                      <div
                        key={`${lesson.id}-hint-${hintIndex}`}
                        style={{
                          padding: '0.78rem 0.9rem',
                          borderRadius: 10,
                          border: '1px solid rgba(251,191,36,0.18)',
                          background: 'rgba(120,53,15,0.14)',
                        }}
                      >
                        <p style={{ color: '#fbbf24', fontSize: 9, letterSpacing: '0.18em', margin: '0 0 6px', fontWeight: 800 }}>
                          HINT {String(hintIndex + 1).padStart(2, '0')}
                        </p>
                        <p style={{ color: '#fde68a', fontSize: 11, lineHeight: 1.7, margin: 0 }}>{hint}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 12, margin: '0.8rem 0 0.9rem', lineHeight: 1.6 }}>
                {lesson.description}
              </p>
              {lesson.practiceCmd && onPractice && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(0,255,65,0.12)',
                    borderRadius: 8,
                    padding: '0.6rem 0.8rem',
                  }}
                >
                  <code style={{ flex: 1, color: 'rgb(var(--route-accent-rgb) / 0.82)', fontSize: 11, fontFamily: 'monospace' }}>
                    $ {lesson.practiceCmd}
                  </code>
                  <button
                    onClick={onPractice}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: 'rgba(0,255,65,0.1)',
                      border: '1px solid rgba(0,255,65,0.25)',
                      color: 'rgb(var(--route-accent-rgb) / 0.82)',
                      fontFamily: 'inherit',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    SEND TO TERMINAL
                  </button>
                </div>
              )}
              <button
                onClick={() => onComplete()}
                style={{
                  marginTop: '0.8rem',
                  padding: '7px 14px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  background: isCompleted ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
                  border: `1px solid ${isCompleted ? 'rgba(248,113,113,0.25)' : 'rgba(74,222,128,0.25)'}`,
                  color: isCompleted ? '#f87171' : '#4ade80',
                  fontFamily: 'inherit',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                }}
              >
                {isCompleted ? 'MARK INCOMPLETE' : 'MARK COMPLETE'}
              </button>
            </>
          )}
        </div>
      )}
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
  const [category, setCategory] = useState<ToolCategory>('All')
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
    const matchCat = category === 'All' || t.category === category
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
            color: 'rgb(var(--route-accent-rgb) / 0.82)', fontSize: 12, fontFamily: 'inherit',
            cursor: 'pointer', flexShrink: 0, outline: 'none',
          }}>
            ← Tool list
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tools..."
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tools..."
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
          <h2 style={{ color: 'rgb(var(--route-accent-rgb))', fontFamily: 'inherit', fontSize: 20, fontWeight: 800, margin: 0 }}>
            {tool.name}
          </h2>
          <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 10,
            background: 'rgba(0,255,65,0.08)', color: 'rgb(var(--route-accent-rgb) / 0.82)', border: '1px solid rgba(0,255,65,0.2)' }}>
            {tool.category}
          </span>
          <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 10,
            background: `${diffColor}10`, color: diffColor, border: `1px solid ${diffColor}25` }}>
            {diffLabel}
          </span>
        </div>
        {/* Versiyon & OS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ color: 'rgb(var(--route-muted-rgb) / 0.8)', fontSize: 11 }}>v{tool.version}</span>
          <span style={{ color: 'rgb(var(--route-muted-rgb) / 0.52)' }}>·</span>
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

      <CodeBlock label="Install" code={tool.install} />

      <Section title="Key Flags">
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {tool.flags.map(f => (
            <div key={f.flag} style={{ display: 'flex', gap: '0.85rem', padding: '0.45rem 0.65rem',
              borderRadius: 4, background: 'rgba(255,255,255,0.02)', alignItems: 'flex-start' }}>
              <code style={{ color: 'rgb(var(--route-accent-rgb))', fontSize: 11, minWidth: 130, flexShrink: 0, fontFamily: 'inherit' }}>
                {f.flag}
              </code>
              <span style={{ color: 'rgba(226,232,240,0.62)', fontSize: 11 }}>{f.description}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Usage Examples">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {tool.examples.map((ex, i) => (
            <div key={i} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ background: '#0d0d0d', padding: '0.65rem 0.9rem',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <pre style={{ margin: 0, color: '#e2e8f0', fontSize: 11, fontFamily: 'inherit',
                  whiteSpace: 'pre-wrap', flex: 1 }}>{ex.command}</pre>
                <button onClick={() => onSendCommand(ex.command.split('\n')[0])}
                  title="Send to terminal"
                  style={{
                    flexShrink: 0, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                    background: 'rgb(var(--route-accent-rgb) / 0.08)', border: '1px solid rgb(var(--route-accent-rgb) / 0.16)',
                    color: 'rgb(var(--route-accent-rgb) / 0.82)', fontSize: 10, fontFamily: 'inherit',
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
      <p style={{ color: 'rgb(var(--route-accent-rgb) / 0.65)', fontSize: 10, letterSpacing: '0.2em',
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
      <h3 style={{ color: 'rgb(var(--route-accent-rgb) / 0.82)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
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


