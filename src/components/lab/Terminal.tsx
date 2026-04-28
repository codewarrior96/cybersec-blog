'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AnsiText from './AnsiText'
import { runCommand, VALID_FLAGS } from '@/lib/lab/engine'
import { deserializeEvidenceLog, evidenceStorageKey, serializeEvidenceLog } from '@/lib/lab/evidence'
import { resolvePath, getNode } from '@/lib/lab/filesystem'
import { initMutableFs } from '@/lib/lab/mutation'
import type { EvidenceEvent, EvidenceLog } from '@/lib/lab/evidence'
import type { CommandContext, PendingCommand, TerminalExecution, TerminalLine, TerminalCommandSource } from '@/lib/lab/types'

const HOME = '/home/operator'
const EVIDENCE_SCENARIO_ID = 'breach-lab-default'

type WsStatus = 'simulated' | 'connecting' | 'connected' | 'disconnected'

const WS_META: Record<WsStatus, { label: string; color: string }> = {
  simulated:    { label: 'SIMULATED',  color: '#22d3ee' },
  connecting:   { label: 'CONNECTING', color: '#fbbf24' },
  connected:    { label: 'LINKED',     color: '#00ff41' },
  disconnected: { label: 'OFFLINE',    color: '#ef4444' },
}

let _lid = 0
function mkLine(text: string, isPrompt = false): TerminalLine {
  return { id: _lid++, text, isPrompt }
}

function buildPrompt(cwd: string): string {
  return `\x1b[1;32moperator\x1b[0m@\x1b[1;36mbreach-lab\x1b[0m:\x1b[1;34m${cwd.replace(HOME, '~')}\x1b[0m$ `
}

// Known top-level commands the engine routes (registry + switch-case + manpages).
// Hardcoded because the engine uses a switch — no introspection API. Keep
// alphabetically sorted for clean cycle order.
const KNOWN_COMMANDS: readonly string[] = [
  'aircrack-ng', 'aireplay-ng', 'airodump-ng', 'amass', 'arp', 'awk',
  'base64', 'bash', 'binwalk', 'burp', 'burpsuite',
  'cat', 'cd', 'chmod', 'chown', 'clear', 'crontab', 'curl',
  'date', 'df', 'dig', 'dirb', 'du',
  'echo', 'enum4linux', 'env', 'exit',
  'ffuf', 'file', 'find', 'free', 'ftp',
  'gdb', 'ghidra', 'gobuster', 'grep',
  'hashcat', 'head', 'help', 'history', 'hostname', 'htop', 'hydra',
  'id', 'ifconfig', 'iostat', 'ip',
  'john',
  'kill',
  'last', 'logout', 'ls', 'lsof',
  'man', 'marketplace', 'mkdir', 'modules', 'mount', 'msfconsole', 'msfvenom', 'mv',
  'nc', 'netcat', 'netstat', 'nikto', 'nmap', 'nslookup', 'nuclei',
  'options',
  'ping', 'ps', 'pwd', 'python', 'python3',
  'r2', 'radare2', 'recon-ng', 'responder', 'rm', 'route', 'rsync',
  'scp', 'sed', 'sessions', 'shodan', 'sort', 'sqlmap', 'ss', 'ssh',
  'ssh2john', 'stat', 'strings', 'sublist3r', 'submit', 'sudo',
  'tail', 'tar', 'tcpdump', 'telnet', 'theharvester', 'top', 'touch', 'traceroute', 'tree', 'tshark',
  'umount', 'uname', 'uniq', 'unshadow', 'uptime', 'use',
  'vmstat',
  'w', 'wfuzz', 'wget', 'which', 'who', 'whoami', 'wireshark', 'wpscan',
  'xxd',
]

interface TabResult {
  value: string
  matches: string[]
  /** Index within matches that produced `value`. */
  index: number
}

function tabComplete(input: string, cwd: string, cycleStart: number): TabResult | null {
  const parts = input.split(' ')
  const last = parts[parts.length - 1]

  // Command completion when no whitespace yet (only the command word being typed)
  if (parts.length === 1) {
    const partial = last
    if (!partial) return null
    const matches = KNOWN_COMMANDS.filter(c => c.startsWith(partial))
    if (matches.length === 0) return null
    const idx = ((cycleStart % matches.length) + matches.length) % matches.length
    return { value: matches[idx], matches, index: idx }
  }

  // Path completion for second+ token
  const dirPart = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : ''
  const partial = last.slice(dirPart.length)

  const node = getNode(resolvePath(cwd, dirPart || '.'))
  if (node?.type !== 'dir') return null

  const matches = Object.keys(node.children).filter(key => key.startsWith(partial)).sort()
  if (matches.length === 0) return null
  const idx = ((cycleStart % matches.length) + matches.length) % matches.length
  const completed = matches[idx]
  const isDir = node.children[completed]?.type === 'dir'
  parts[parts.length - 1] = dirPart + completed + (isDir ? '/' : '')
  return { value: parts.join(' '), matches, index: idx }
}

interface Props {
  wsUrl?: string
  onFlagSubmit?: (flag: string) => void
  onFlagRevealed?: (level: number, flag: string) => void
  pendingCommand?: PendingCommand | null
  onCommandConsumed?: () => void
  onCommandExecuted?: (execution: TerminalExecution) => void
  isActive?: boolean
  cwd: string
  setCwd: Dispatch<SetStateAction<string>>
  lines: TerminalLine[]
  setLines: Dispatch<SetStateAction<TerminalLine[]>>
  input: string
  setInput: Dispatch<SetStateAction<string>>
  history: string[]
  setHistory: Dispatch<SetStateAction<string[]>>
  histIdx: number
  setHistIdx: Dispatch<SetStateAction<number>>
  evidenceLog: EvidenceLog
  setEvidenceLog: Dispatch<SetStateAction<EvidenceLog>>
  unlockedLevels: ReadonlySet<number>
  alreadyRevealed: ReadonlySet<number>
}

export default function Terminal({
  wsUrl,
  onFlagSubmit,
  onFlagRevealed,
  pendingCommand,
  onCommandConsumed,
  onCommandExecuted,
  isActive = true,
  cwd,
  setCwd,
  lines,
  setLines,
  input,
  setInput,
  history,
  setHistory,
  histIdx,
  setHistIdx,
  evidenceLog,
  setEvidenceLog,
  unlockedLevels,
  alreadyRevealed,
}: Props) {
  const resolvedWsUrl = wsUrl ?? process.env.NEXT_PUBLIC_TERMINAL_WS
  const [wsStatus, setWsStatus] = useState<WsStatus>('simulated')

  // ── Popout window state (session-scoped, no localStorage) ─────────────────
  type WindowMode = 'inline' | 'floating' | 'minimized'
  const [windowMode, setWindowMode] = useState<WindowMode>('inline')
  const [popoutPos, setPopoutPos] = useState<{ x: number; y: number }>({ x: 80, y: 80 })
  const [popoutSize, setPopoutSize] = useState<{ w: number; h: number }>({ w: 720, h: 480 })
  const dragStateRef = useRef<{ kind: 'move' | 'resize'; offX: number; offY: number; startW: number; startH: number } | null>(null)

  // ── History search (Ctrl+R) ────────────────────────────────────────────────
  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCursor, setSearchCursor] = useState(0)

  // ── Tab completion cycle ───────────────────────────────────────────────────
  const tabCycleRef = useRef<{ original: string; matches: string[]; idx: number } | null>(null)

  const cwdRef = useRef(cwd)
  const wsRef = useRef<WebSocket | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  cwdRef.current = cwd

  useEffect(() => {
    if (!pendingCommand || !isActive) return
    execute(pendingCommand.cmd, 'assisted')
    onCommandConsumed?.()
  }, [pendingCommand?.id, isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return

    const key = evidenceStorageKey(EVIDENCE_SCENARIO_ID)
    setEvidenceLog(deserializeEvidenceLog(window.localStorage.getItem(key)))
  }, [setEvidenceLog])

  useEffect(() => {
    if (!resolvedWsUrl) {
      setWsStatus('simulated')
      return
    }

    setWsStatus('connecting')
    const ws = new WebSocket(resolvedWsUrl)
    wsRef.current = ws

    ws.onopen = () => setWsStatus('connected')
    ws.onclose = () => {
      setWsStatus('disconnected')
      wsRef.current = null
    }
    ws.onerror = () => {
      setWsStatus('disconnected')
      wsRef.current = null
    }
    ws.onmessage = (event: MessageEvent<string>) => {
      setLines(prev => [...prev, mkLine(event.data)])
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [resolvedWsUrl])

  useEffect(() => {
    if (lines.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines])

  const handleEvidenceEvent = useCallback((event: EvidenceEvent) => {
    setEvidenceLog(prev => {
      const next = prev.append(event)

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(evidenceStorageKey(EVIDENCE_SCENARIO_ID), serializeEvidenceLog(next))
        } catch (err) {
          console.warn('[BREACH LAB] Evidence persist failed:', err)
        }
      }

      return next
    })

    for (const primitive of event.primitives) {
      if (primitive.type === 'flag_revealed') {
        onFlagRevealed?.(primitive.level, primitive.flag)
      }
    }
  }, [setEvidenceLog, onFlagRevealed])

  const execute = useCallback((raw: string, source: TerminalCommandSource = 'manual') => {
    const cwdBefore = cwdRef.current
    const prompt = buildPrompt(cwdBefore)
    setLines(prev => [...prev, mkLine(`${prompt}${raw}`, true)])
    setHistory(prev => (raw.trim() ? [raw, ...prev.slice(0, 99)] : prev))

    if (!raw.trim()) return

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(raw + '\n')
      onCommandExecuted?.({
        raw,
        source,
        cwdBefore,
        cwdAfter: cwdBefore,
        output: [],
        timestamp: Date.now(),
      })
      return
    }

    let nextCwd = cwdBefore
    const ctx: CommandContext = {
      cwd: cwdBefore,
      setCwd: path => {
        nextCwd = path
      },
      history,
      mutableFs: initMutableFs(),
    }

    // Evidence currently emitted only in simulated mode. Future: capture from WebSocket protocol.
    const output = runCommand(raw, ctx, handleEvidenceEvent, {
      evidenceLog,
      unlockedLevels,
      alreadyRevealed,
    })

    if (output[0] === '__CLEAR__') {
      setLines([])
      onCommandExecuted?.({
        raw,
        source,
        cwdBefore,
        cwdAfter: nextCwd,
        output: [],
        timestamp: Date.now(),
      })
      return
    }

    if (output.length) {
      setLines(prev => [...prev, ...output.map(text => mkLine(text))])
    }

    if (nextCwd !== cwdBefore) setCwd(nextCwd)

    const match = raw.trim().match(/^submit\s+(FLAG\{[^}]+\})/)
    if (match && VALID_FLAGS.has(match[1])) onFlagSubmit?.(match[1])
    onCommandExecuted?.({
      raw,
      source,
      cwdBefore,
      cwdAfter: nextCwd,
      output,
      timestamp: Date.now(),
    })
  }, [evidenceLog, unlockedLevels, alreadyRevealed, handleEvidenceEvent, history, onCommandExecuted, onFlagSubmit, setCwd, setHistory, setInput, setLines])

  // ── Popout window handlers ───────────────────────────────────────────────
  const onChromeMouseDown = useCallback((event: React.MouseEvent) => {
    if (windowMode !== 'floating') return
    if (event.button !== 0) return
    // Don't start drag if user clicked a window-action button
    const target = event.target as HTMLElement
    if (target.closest('.lab-terminal__window-dot')) return
    event.preventDefault()
    dragStateRef.current = {
      kind: 'move',
      offX: event.clientX - popoutPos.x,
      offY: event.clientY - popoutPos.y,
      startW: popoutSize.w,
      startH: popoutSize.h,
    }
  }, [windowMode, popoutPos.x, popoutPos.y, popoutSize.w, popoutSize.h])

  const onResizeMouseDown = useCallback((event: React.MouseEvent) => {
    if (windowMode !== 'floating') return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    dragStateRef.current = {
      kind: 'resize',
      offX: event.clientX,
      offY: event.clientY,
      startW: popoutSize.w,
      startH: popoutSize.h,
    }
  }, [windowMode, popoutSize.w, popoutSize.h])

  useEffect(() => {
    if (windowMode !== 'floating') return

    function onMove(e: MouseEvent) {
      const drag = dragStateRef.current
      if (!drag) return
      if (drag.kind === 'move') {
        const maxX = Math.max(0, window.innerWidth - 200)
        const maxY = Math.max(0, window.innerHeight - 60)
        setPopoutPos({
          x: Math.min(maxX, Math.max(0, e.clientX - drag.offX)),
          y: Math.min(maxY, Math.max(0, e.clientY - drag.offY)),
        })
      } else {
        const minW = 400
        const minH = 300
        const maxW = window.innerWidth - 40
        const maxH = window.innerHeight - 40
        setPopoutSize({
          w: Math.min(maxW, Math.max(minW, drag.startW + (e.clientX - drag.offX))),
          h: Math.min(maxH, Math.max(minH, drag.startH + (e.clientY - drag.offY))),
        })
      }
    }
    function onUp() {
      dragStateRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [windowMode])

  const handleClose = useCallback(() => setWindowMode('inline'), [])
  const handleMinimize = useCallback(() => setWindowMode('minimized'), [])
  const togglePopout = useCallback(() => {
    setWindowMode(prev => {
      if (prev === 'floating') return 'inline'
      if (prev === 'inline') {
        // Center on first popout
        const cw = typeof window !== 'undefined' ? window.innerWidth : 1200
        const ch = typeof window !== 'undefined' ? window.innerHeight : 800
        setPopoutPos({
          x: Math.max(40, Math.floor((cw - popoutSize.w) / 2)),
          y: Math.max(40, Math.floor((ch - popoutSize.h) / 2)),
        })
        return 'floating'
      }
      // From minimized → restore to floating
      return 'floating'
    })
  }, [popoutSize.w, popoutSize.h])

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // ── Ctrl+R: reverse history search overlay ─────────────────────────────
    if (event.ctrlKey && event.key.toLowerCase() === 'r') {
      event.preventDefault()
      if (!searchActive) {
        setSearchActive(true)
        setSearchQuery('')
        setSearchCursor(0)
      } else {
        // Already active — cycle to next older match
        const matches = history.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase()))
        if (matches.length > 0) {
          setSearchCursor((searchCursor + 1) % matches.length)
        }
      }
      return
    }

    if (searchActive) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSearchActive(false)
        setSearchQuery('')
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const matches = history.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase()))
        const picked = matches[searchCursor] ?? ''
        setSearchActive(false)
        setSearchQuery('')
        if (picked) {
          setInput('')
          execute(picked, 'manual')
        }
        return
      }
      if (event.key === 'Backspace') {
        event.preventDefault()
        setSearchQuery(searchQuery.slice(0, -1))
        setSearchCursor(0)
        return
      }
      if (event.key.length === 1 && !event.metaKey && !event.altKey) {
        event.preventDefault()
        setSearchQuery(searchQuery + event.key)
        setSearchCursor(0)
        return
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Tab') {
        event.preventDefault()
        return
      }
    }

    switch (event.key) {
      case 'Enter': {
        const cmd = input
        setHistIdx(-1)
        setInput('')
        tabCycleRef.current = null
        execute(cmd, 'manual')
        break
      }
      case 'ArrowUp': {
        event.preventDefault()
        const idx = Math.min(histIdx + 1, history.length - 1)
        setHistIdx(idx)
        setInput(history[idx] ?? '')
        tabCycleRef.current = null
        break
      }
      case 'ArrowDown': {
        event.preventDefault()
        const idx = Math.max(histIdx - 1, -1)
        setHistIdx(idx)
        setInput(idx < 0 ? '' : history[idx] ?? '')
        tabCycleRef.current = null
        break
      }
      case 'Tab': {
        event.preventDefault()
        // Cycle through matches if same partial, else fresh complete
        const cycle = tabCycleRef.current
        const baseInput = cycle && cycle.original ? cycle.original : input
        const startIdx = cycle ? cycle.idx + 1 : 0
        const result = tabComplete(baseInput, cwdRef.current, startIdx)
        if (!result) {
          tabCycleRef.current = null
          break
        }
        if (result.matches.length === 1) {
          setInput(result.value)
          tabCycleRef.current = null
        } else {
          setInput(result.value)
          tabCycleRef.current = { original: baseInput, matches: result.matches, idx: result.index }
        }
        break
      }
      case 'c': {
        if (event.ctrlKey) {
          event.preventDefault()
          setInput('')
          tabCycleRef.current = null
        }
        break
      }
      case 'l': {
        if (event.ctrlKey) {
          event.preventDefault()
          setLines([])
        }
        break
      }
    }
  }

  // Compute current reverse-search match for overlay
  const searchMatches = searchActive
    ? history.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase()))
    : []
  const searchPick = searchMatches[searchCursor] ?? ''

  const { label: wsLabel, color: wsColor } = WS_META[wsStatus]
  const prompt = buildPrompt(cwd)
  const quickActions = [
    { label: 'Help Index', command: 'help' },
    { label: 'Challenge Deck', command: 'cd challenges && cat README.txt' },
    { label: 'Tool Shelf', command: 'ls /opt/tools' },
    { label: 'Return Home', command: 'cd /home/operator' },
  ]
  const shellLabel = wsStatus === 'simulated' ? 'Training runtime' : 'Remote shell link'
  const bufferEmpty = lines.length === 0
  const showWelcomeState = bufferEmpty && history.length === 0
  const showClearedState = bufferEmpty && history.length > 0

  // Render minimized "dock tab" when popout is collapsed
  if (windowMode === 'minimized') {
    return (
      <>
        <div className="lab-terminal__inline-placeholder" onClick={() => setWindowMode('floating')}>
          <span className="lab-terminal__placeholder-dot" />
          Terminal popped out — click to restore
        </div>
        <button
          type="button"
          className="lab-terminal__min-tab"
          onClick={() => setWindowMode('floating')}
          aria-label="Restore terminal"
        >
          <span className="lab-terminal__min-dot" />
          <span className="lab-terminal__min-label">TERMINAL</span>
          <span className="lab-terminal__min-cmd">{cwd.replace(HOME, '~')}</span>
        </button>
        <style jsx>{`
          .lab-terminal__inline-placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            height: 100%;
            min-height: 200px;
            color: rgb(0 255 65 / 0.55);
            font-family: "JetBrains Mono", "Fira Code", monospace;
            font-size: 12px;
            letter-spacing: 0.06em;
            cursor: pointer;
            background: linear-gradient(180deg, rgb(4 9 7 / 0.6), rgb(2 4 4 / 0.7));
            border: 1px dashed rgb(0 255 65 / 0.18);
            border-radius: 16px;
          }
          .lab-terminal__placeholder-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #00ff41;
            box-shadow: 0 0 14px #00ff41;
            animation: lab-terminal-pulse 1.6s ease-in-out infinite;
          }
          @keyframes lab-terminal-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
          .lab-terminal__min-tab {
            position: fixed;
            right: 24px;
            bottom: 24px;
            width: 240px;
            height: 40px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 14px;
            background: rgb(0 20 5 / 0.95);
            border: 1px solid rgb(0 255 65 / 0.35);
            border-radius: 999px;
            color: #00ff41;
            font-family: "JetBrains Mono", "Fira Code", monospace;
            font-size: 11px;
            letter-spacing: 0.1em;
            cursor: pointer;
            box-shadow: 0 8px 24px rgb(0 0 0 / 0.6), 0 0 18px rgb(0 255 65 / 0.18);
            backdrop-filter: blur(8px);
            z-index: 50;
            transition: transform 0.18s ease, border-color 0.18s ease;
          }
          .lab-terminal__min-tab:hover {
            transform: translateY(-2px);
            border-color: rgb(0 255 65 / 0.6);
          }
          .lab-terminal__min-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #00ff41;
            box-shadow: 0 0 12px #00ff41;
            flex-shrink: 0;
          }
          .lab-terminal__min-label {
            font-weight: 800;
          }
          .lab-terminal__min-cmd {
            color: rgb(0 255 65 / 0.55);
            font-size: 10px;
            margin-left: auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 110px;
          }
        `}</style>
      </>
    )
  }

  const isFloating = windowMode === 'floating'
  const floatingStyle: React.CSSProperties = isFloating
    ? {
        position: 'fixed',
        top: popoutPos.y,
        left: popoutPos.x,
        width: popoutSize.w,
        height: popoutSize.h,
        zIndex: 50,
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid rgb(0 255 65 / 0.32)',
        boxShadow: '0 24px 60px rgb(0 0 0 / 0.65), 0 0 28px rgb(0 255 65 / 0.18)',
      }
    : {}

  const inlinePlaceholder = isFloating ? (
    <div className="lab-terminal__inline-placeholder" onClick={() => setWindowMode('inline')}>
      <span className="lab-terminal__placeholder-dot" />
      Terminal popped out — click to dock
    </div>
  ) : null

  return (
    <>
      {inlinePlaceholder}
      <div
        className="lab-terminal"
        onClick={() => inputRef.current?.focus()}
        style={floatingStyle}
        data-mode={windowMode}
      >
      <div className="lab-terminal__chrome" onMouseDown={onChromeMouseDown}>
        <div className="lab-terminal__window-actions">
          <button
            type="button"
            className="lab-terminal__window-dot lab-terminal__window-dot--close"
            aria-label="Dock terminal inline"
            onClick={(e) => { e.stopPropagation(); handleClose() }}
            style={{ background: '#ff5f56' }}
            title="Dock inline"
          />
          <button
            type="button"
            className="lab-terminal__window-dot lab-terminal__window-dot--min"
            aria-label="Minimize terminal"
            onClick={(e) => { e.stopPropagation(); handleMinimize() }}
            style={{ background: '#ffbd2e' }}
            title="Minimize"
            disabled={!isFloating}
          />
          <button
            type="button"
            className="lab-terminal__window-dot lab-terminal__window-dot--pop"
            aria-label={isFloating ? 'Dock terminal' : 'Pop out terminal'}
            onClick={(e) => { e.stopPropagation(); togglePopout() }}
            style={{ background: '#27c93f' }}
            title={isFloating ? 'Dock' : 'Pop out'}
          />
        </div>
        <div className="lab-terminal__identity">
          <span className="lab-terminal__eyebrow">Operator channel</span>
          <span className="lab-terminal__location">operator@breach-lab:{cwd.replace(HOME, '~')}</span>
        </div>
        <div className="lab-terminal__status">
          <span className="lab-terminal__status-dot" style={{ background: wsColor, boxShadow: `0 0 18px ${wsColor}` }} />
          <span className="lab-terminal__status-label" style={{ color: wsColor }}>{wsLabel}</span>
        </div>
      </div>

      <div className="lab-terminal__meta">
        <div className="lab-terminal__meta-cluster">
          <div className="lab-terminal__chip">
            <span className="lab-terminal__chip-label">Runtime</span>
            <span className="lab-terminal__chip-value">{shellLabel}</span>
          </div>
          <div className="lab-terminal__chip">
            <span className="lab-terminal__chip-label">Workspace</span>
            <span className="lab-terminal__chip-value">{cwd.replace(HOME, '~') || '~'}</span>
          </div>
          <div className="lab-terminal__chip">
            <span className="lab-terminal__chip-label">History</span>
            <span className="lab-terminal__chip-value">{history.length} commands</span>
          </div>
        </div>
        <span className="lab-terminal__meta-shortcut">TAB complete - Ctrl+L clear - Ctrl+C reset input</span>
      </div>

      <div className="lab-terminal__body">
        <div className="lab-terminal__action-row">
          {quickActions.map(action => (
            <button
              key={action.command}
              type="button"
              className="lab-terminal__action-card"
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                execute(action.command, 'assisted')
                inputRef.current?.focus()
              }}
            >
              <span className="lab-terminal__action-title">{action.label}</span>
              <span className="lab-terminal__action-command">{action.command}</span>
            </button>
          ))}
        </div>

        <div className="lab-terminal__viewport-shell">
          <div className="lab-terminal__viewport-glow" />
          <div className="lab-terminal__scanlines" />
          <div className="lab-terminal__viewport">
            {showWelcomeState ? (
              <div className="lab-terminal__welcome">
                <span className="lab-terminal__welcome-kicker">Breach Lab</span>
                <strong className="lab-terminal__welcome-title">Operator console is live and ready.</strong>
                <p className="lab-terminal__welcome-copy">
                  Use the command deck for guided exploration or drop straight into a custom workflow below.
                </p>
              </div>
            ) : showClearedState ? (
              <div className="lab-terminal__empty-state">
                <span className="lab-terminal__empty-kicker">Session buffer cleared</span>
                <strong className="lab-terminal__empty-title">Console is ready for the next command.</strong>
                <span className="lab-terminal__empty-copy">Use the command deck above or type a custom instruction below.</span>
              </div>
            ) : (
              lines.map(line => (
                <div key={line.id} className={`lab-terminal__line${line.isPrompt ? ' lab-terminal__line--prompt' : ''}`}>
                  <AnsiText text={line.text} />
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      <div className="lab-terminal__dock">
        <div className="lab-terminal__dock-header">
          <span className="lab-terminal__dock-kicker">Command dock</span>
          <span className="lab-terminal__dock-hint">Enter - run · ↑/↓ history · TAB complete · Ctrl+R search</span>
        </div>
        {searchActive && (
          <div className="lab-terminal__search-overlay">
            <span className="lab-terminal__search-prompt">(reverse-i-search)</span>
            <span className="lab-terminal__search-query">`{searchQuery}`</span>
            <span className="lab-terminal__search-sep">:</span>
            <span className="lab-terminal__search-match">
              {searchPick || <span className="lab-terminal__search-empty">no match</span>}
            </span>
            {searchMatches.length > 1 && (
              <span className="lab-terminal__search-counter">[{searchCursor + 1}/{searchMatches.length}]</span>
            )}
            <span className="lab-terminal__search-hint">Enter accept · Esc cancel · Ctrl+R next</span>
          </div>
        )}
        <div className="lab-terminal__input-shell">
          <span className="lab-terminal__prompt">
            <AnsiText text={prompt} />
          </span>
          <input
            ref={inputRef}
            value={searchActive ? searchPick : input}
            onChange={event => { if (!searchActive) setInput(event.target.value) }}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="lab-terminal__input"
            data-search-active={searchActive ? 'true' : 'false'}
          />
          <span className="lab-terminal__input-shortcuts">UP/DOWN · TAB · Ctrl+R</span>
        </div>
      </div>

      <style jsx>{`
        .lab-terminal {
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          overflow: hidden;
          background:
            radial-gradient(circle at top center, rgb(var(--route-accent-rgb) / 0.1), transparent 36%),
            linear-gradient(180deg, #08110c 0%, #060807 46%, #040505 100%);
          color: rgb(var(--route-text-rgb));
          font-family: "JetBrains Mono", "Fira Code", monospace;
        }

        .lab-terminal__chrome,
        .lab-terminal__meta,
        .lab-terminal__dock {
          position: relative;
          z-index: 1;
        }

        .lab-terminal__chrome {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 16px;
          background:
            linear-gradient(180deg, rgb(255 255 255 / 0.04), rgb(255 255 255 / 0.015)),
            linear-gradient(180deg, rgb(5 10 8 / 0.98), rgb(8 11 10 / 0.94));
          border-bottom: 1px solid rgb(var(--route-accent-rgb) / 0.12);
          box-shadow: inset 0 -1px 0 rgb(255 255 255 / 0.02);
        }

        .lab-terminal__window-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .lab-terminal__window-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          box-shadow: 0 0 14px rgb(0 0 0 / 0.35);
        }

        .lab-terminal__identity {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .lab-terminal__eyebrow {
          color: rgb(var(--route-muted-rgb) / 0.58);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
        }

        .lab-terminal__location {
          overflow: hidden;
          max-width: 100%;
          color: rgb(203 213 225 / 0.72);
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 11px;
          letter-spacing: 0.06em;
        }

        .lab-terminal__status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 999px;
          border: 1px solid rgb(255 255 255 / 0.08);
          background: rgb(255 255 255 / 0.03);
          flex-shrink: 0;
          backdrop-filter: blur(14px);
        }

        .lab-terminal__status-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
        }

        .lab-terminal__status-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .lab-terminal__meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid rgb(var(--route-accent-rgb) / 0.08);
          background: linear-gradient(180deg, rgb(6 12 10 / 0.94), rgb(5 9 8 / 0.88));
        }

        .lab-terminal__meta-cluster {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .lab-terminal__chip {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          padding: 8px 11px;
          border: 1px solid rgb(255 255 255 / 0.07);
          border-radius: 999px;
          background: linear-gradient(180deg, rgb(255 255 255 / 0.028), rgb(255 255 255 / 0.012));
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.03);
        }

        .lab-terminal__chip-label {
          color: rgb(var(--route-muted-rgb) / 0.54);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .lab-terminal__chip-value {
          color: rgb(226 232 240 / 0.84);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .lab-terminal__meta-shortcut {
          color: rgb(var(--route-muted-rgb) / 0.48);
          font-size: 10px;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        .lab-terminal__body {
          position: relative;
          z-index: 1;
          display: flex;
          flex: 1;
          min-height: 0;
          flex-direction: column;
          gap: 12px;
          padding: 14px;
        }

        .lab-terminal__action-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .lab-terminal__action-card {
          position: relative;
          overflow: hidden;
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          padding: 12px 14px;
          border: 1px solid rgb(var(--route-accent-rgb) / 0.14);
          border-radius: 16px;
          background:
            linear-gradient(180deg, rgb(var(--route-accent-rgb) / 0.11), rgb(var(--route-accent-rgb) / 0.04)),
            linear-gradient(180deg, rgb(255 255 255 / 0.02), rgb(255 255 255 / 0.005));
          color: inherit;
          text-align: left;
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
          cursor: pointer;
        }

        .lab-terminal__action-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 20%, rgb(255 255 255 / 0.11) 50%, transparent 80%);
          opacity: 0;
          transform: translateX(-120%);
          transition: transform 280ms ease, opacity 180ms ease;
          pointer-events: none;
        }

        .lab-terminal__action-card:hover {
          transform: translateY(-1px);
          border-color: rgb(var(--route-accent-rgb) / 0.28);
          box-shadow: 0 18px 28px rgb(0 0 0 / 0.22), 0 0 0 1px rgb(var(--route-accent-rgb) / 0.08);
        }

        .lab-terminal__action-card:hover::after {
          opacity: 1;
          transform: translateX(110%);
        }

        .lab-terminal__action-title {
          color: rgb(240 253 244 / 0.96);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .lab-terminal__action-command {
          color: rgb(191 219 254 / 0.72);
          font-size: 11px;
          line-height: 1.5;
          word-break: break-word;
        }

        .lab-terminal__viewport-shell {
          position: relative;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          border: 1px solid rgb(255 255 255 / 0.08);
          border-radius: 22px;
          background:
            linear-gradient(180deg, rgb(4 9 7 / 0.96), rgb(2 4 4 / 0.98)),
            radial-gradient(circle at top, rgb(var(--route-accent-rgb) / 0.08), transparent 42%);
          box-shadow:
            inset 0 1px 0 rgb(255 255 255 / 0.03),
            0 24px 40px rgb(0 0 0 / 0.28);
        }

        .lab-terminal__viewport-glow {
          position: absolute;
          inset: 0 auto auto 10%;
          width: 55%;
          height: 160px;
          background: radial-gradient(circle, rgb(var(--route-accent-rgb) / 0.16), transparent 72%);
          filter: blur(30px);
          pointer-events: none;
        }

        .lab-terminal__scanlines {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(to bottom, transparent 0%, rgb(255 255 255 / 0.02) 50%, transparent 100%);
          background-size: 100% 4px;
          opacity: 0.13;
          mix-blend-mode: screen;
          pointer-events: none;
        }

        .lab-terminal__viewport {
          position: relative;
          z-index: 1;
          height: 100%;
          overflow-y: auto;
          padding: 18px 20px 24px;
          font-size: 13px;
          line-height: 1.78;
          scrollbar-width: thin;
        }

        .lab-terminal__line {
          white-space: pre-wrap;
          word-break: break-all;
          color: rgb(226 232 240 / 0.8);
        }

        .lab-terminal__line--prompt {
          color: rgb(248 250 252 / 0.95);
        }

        .lab-terminal__welcome {
          display: flex;
          min-height: 100%;
          flex-direction: column;
          justify-content: center;
          gap: 14px;
        }

        .lab-terminal__welcome-kicker {
          color: rgb(var(--route-accent-rgb) / 0.74);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.24em;
          text-transform: uppercase;
        }

        .lab-terminal__welcome-title {
          color: rgb(248 250 252 / 0.94);
          font-size: 22px;
          line-height: 1.2;
          max-width: 440px;
        }

        .lab-terminal__welcome-copy {
          max-width: 520px;
          margin: 0;
          color: rgb(148 163 184 / 0.78);
          font-size: 12px;
          line-height: 1.8;
        }

        .lab-terminal__empty-state {
          display: flex;
          min-height: 100%;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 10px;
          color: rgb(var(--route-muted-rgb) / 0.72);
        }

        .lab-terminal__empty-kicker {
          color: rgb(var(--route-accent-rgb) / 0.74);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.24em;
          text-transform: uppercase;
        }

        .lab-terminal__empty-title {
          color: rgb(248 250 252 / 0.92);
          font-size: 18px;
          line-height: 1.3;
        }

        .lab-terminal__empty-copy {
          max-width: 420px;
          color: rgb(148 163 184 / 0.74);
          font-size: 12px;
          line-height: 1.7;
        }

        .lab-terminal__dock {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 14px 14px;
        }

        .lab-terminal__dock-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 4px;
        }

        .lab-terminal__dock-kicker {
          color: rgb(var(--route-accent-rgb) / 0.72);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .lab-terminal__dock-hint {
          color: rgb(var(--route-muted-rgb) / 0.48);
          font-size: 10px;
          letter-spacing: 0.06em;
        }

        .lab-terminal__input-shell {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid rgb(255 255 255 / 0.08);
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgb(7 10 10 / 0.96), rgb(4 5 6 / 0.94)),
            linear-gradient(180deg, rgb(255 255 255 / 0.03), rgb(255 255 255 / 0.01));
          box-shadow:
            inset 0 1px 0 rgb(255 255 255 / 0.04),
            0 18px 34px rgb(0 0 0 / 0.24);
          overflow: hidden;
        }

        .lab-terminal__prompt {
          flex-shrink: 0;
          max-width: 48%;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .lab-terminal__input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          outline: none;
          color: rgb(248 250 252 / 0.95);
          font-family: inherit;
          font-size: 13px;
          caret-color: rgb(var(--route-accent-rgb));
        }

        .lab-terminal__input-shortcuts {
          flex-shrink: 0;
          color: rgb(var(--route-muted-rgb) / 0.45);
          font-size: 10px;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        @media (max-width: 1100px) {
          .lab-terminal__meta {
            flex-direction: column;
            align-items: flex-start;
          }

          .lab-terminal__meta-shortcut {
            white-space: normal;
          }

          .lab-terminal__action-row {
            grid-template-columns: 1fr;
          }

        }

        /* ── Reverse history search overlay (Ctrl+R) ──────────────── */
        .lab-terminal__search-overlay {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          margin: 0 0 8px 0;
          border-radius: 12px;
          background: linear-gradient(180deg, rgb(40 26 0 / 0.65), rgb(28 18 0 / 0.7));
          border: 1px solid rgb(245 158 11 / 0.4);
          color: rgb(252 211 77 / 0.9);
          font-family: "JetBrains Mono", "Fira Code", monospace;
          font-size: 11px;
          letter-spacing: 0.04em;
        }
        .lab-terminal__search-prompt {
          color: #f59e0b;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .lab-terminal__search-query {
          color: #fbbf24;
        }
        .lab-terminal__search-sep {
          color: rgb(252 211 77 / 0.5);
        }
        .lab-terminal__search-match {
          color: rgb(248 250 252 / 0.95);
          font-weight: 600;
          flex: 1;
          min-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .lab-terminal__search-empty {
          color: rgb(239 68 68 / 0.9);
          font-style: italic;
        }
        .lab-terminal__search-counter {
          color: rgb(252 211 77 / 0.7);
          font-size: 10px;
        }
        .lab-terminal__search-hint {
          color: rgb(252 211 77 / 0.45);
          font-size: 10px;
          margin-left: auto;
        }
        .lab-terminal__input[data-search-active="true"] {
          color: #fbbf24;
          font-style: italic;
        }

        /* ── Popout window UX ──────────────────────────────────────── */
        .lab-terminal[data-mode="floating"] {
          height: 100% !important;
        }
        .lab-terminal[data-mode="floating"] .lab-terminal__chrome {
          cursor: move;
          user-select: none;
        }
        .lab-terminal__window-dot {
          position: relative;
          width: 14px;
          height: 14px;
          padding: 0;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          box-shadow: 0 0 6px rgb(0 0 0 / 0.4);
          transition: filter 0.15s ease, transform 0.12s ease;
        }
        .lab-terminal__window-dot:hover:not(:disabled) {
          filter: brightness(1.25);
          transform: scale(1.1);
        }
        .lab-terminal__window-dot:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .lab-terminal__window-dot::after {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 999px;
          border: 1px solid rgb(0 255 65 / 0);
          transition: border-color 0.15s ease;
        }
        .lab-terminal__window-dot:hover:not(:disabled)::after {
          border-color: rgb(0 255 65 / 0.6);
        }
        @media (max-width: 767px) {
          .lab-terminal__window-dot--min,
          .lab-terminal__window-dot--pop {
            display: none;
          }
        }
        .lab-terminal__resize-handle {
          position: absolute;
          right: 2px;
          bottom: 2px;
          width: 18px;
          height: 18px;
          cursor: nwse-resize;
          z-index: 4;
          background:
            linear-gradient(135deg, transparent 50%, rgb(0 255 65 / 0.4) 50%, rgb(0 255 65 / 0.4) 60%, transparent 60%, transparent 70%, rgb(0 255 65 / 0.6) 70%, rgb(0 255 65 / 0.6) 80%, transparent 80%);
          border-bottom-right-radius: 16px;
        }
      `}</style>
      {isFloating && (
        <div
          className="lab-terminal__resize-handle"
          onMouseDown={onResizeMouseDown}
          aria-label="Resize terminal"
        />
      )}
    </div>
    </>
  )
}
