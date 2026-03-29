'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AnsiText from './AnsiText'
import { runCommand, VALID_FLAGS } from '@/lib/lab/engine'
import { resolvePath, getNode } from '@/lib/lab/filesystem'
import type { CommandContext, TerminalLine } from '@/lib/lab/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const HOME = '/home/operator'

const MOTD: string[] = [
  '\x1b[1;32m╔══════════════════════════════════════════════════════════╗\x1b[0m',
  '\x1b[1;32m║\x1b[0m  \x1b[1mBREACH LAB\x1b[0m — Ubuntu 22.04.3 LTS Eğitim Terminali       \x1b[1;32m║\x1b[0m',
  '\x1b[1;32m║\x1b[0m  \x1b[90mGerçek sunucu için bkz. → Kurulum Rehberi sekmesi\x1b[0m        \x1b[1;32m║\x1b[0m',
  '\x1b[1;32m╚══════════════════════════════════════════════════════════╝\x1b[0m',
  '\x1b[90mYardım: \x1b[0mhelp\x1b[90m  |  Görevler: \x1b[0mcd challenges && cat README.txt\x1b[0m',
  '',
]

type WsStatus = 'simulated' | 'connecting' | 'connected' | 'disconnected'

const WS_META: Record<WsStatus, { label: string; color: string }> = {
  simulated:    { label: 'SİMÜLE',       color: '#22d3ee' },
  connecting:   { label: 'BAĞLANIYOR',   color: '#fbbf24' },
  connected:    { label: 'BAĞLI',        color: '#00ff41' },
  disconnected: { label: 'BAĞLANTI YOK', color: '#ef4444' },
}

let _lid = 0
function mkLine(text: string, isPrompt = false): TerminalLine {
  return { id: _lid++, text, isPrompt }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPrompt(cwd: string): string {
  return `\x1b[1;32moperator\x1b[0m@\x1b[1;36mbreach-lab\x1b[0m:\x1b[1;34m${cwd.replace(HOME, '~')}\x1b[0m$ `
}

function tabComplete(input: string, cwd: string): string | null {
  const parts   = input.split(' ')
  const last    = parts[parts.length - 1]
  const dirPart = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : ''
  const partial = last.slice(dirPart.length)

  const node = getNode(resolvePath(cwd, dirPart || '.'))
  if (node?.type !== 'dir') return null

  const matches = Object.keys(node.children).filter(k => k.startsWith(partial))
  if (matches.length !== 1) return null

  const completed = matches[0]
  const isDir     = node.children[completed]?.type === 'dir'
  parts[parts.length - 1] = dirPart + completed + (isDir ? '/' : '')
  return parts.join(' ')
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  wsUrl?:        string
  onFlagSubmit?: (flag: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Terminal({ wsUrl, onFlagSubmit }: Props) {
  const [cwd,     setCwd]     = useState(HOME)
  const [lines,   setLines]   = useState<TerminalLine[]>(() => MOTD.map(t => mkLine(t)))
  const [input,   setInput]   = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [wsStatus, setWsStatus] = useState<WsStatus>('simulated')

  const cwdRef    = useRef(cwd)
  const wsRef     = useRef<WebSocket | null>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  cwdRef.current = cwd

  // ── WebSocket setup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!wsUrl) { setWsStatus('simulated'); return }
    setWsStatus('connecting')

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen    = () => setWsStatus('connected')
    ws.onclose   = () => { setWsStatus('disconnected'); wsRef.current = null }
    ws.onerror   = () => { setWsStatus('disconnected'); wsRef.current = null }
    ws.onmessage = (e: MessageEvent<string>) =>
      setLines(prev => [...prev, mkLine(e.data)])

    return () => { ws.close(); wsRef.current = null }
  }, [wsUrl])

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  // ── Execute command ──────────────────────────────────────────────────────
  const execute = useCallback((raw: string) => {
    const prompt = buildPrompt(cwdRef.current)
    setLines(prev => [...prev, mkLine(`${prompt}${raw}`, true)])
    setHistory(prev => raw.trim() ? [raw, ...prev.slice(0, 99)] : prev)

    if (!raw.trim()) return

    // Send to real shell if WebSocket is connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(raw + '\n')
      return
    }

    // Simulated execution
    let nextCwd = cwdRef.current
    const ctx: CommandContext = {
      cwd: cwdRef.current,
      setCwd: (p) => { nextCwd = p },
      history,
    }

    const output = runCommand(raw, ctx)

    if (output[0] === '__CLEAR__') {
      setLines([])
      return
    }

    if (output.length) {
      setLines(prev => [...prev, ...output.map(t => mkLine(t))])
    }

    if (nextCwd !== cwdRef.current) setCwd(nextCwd)

    // Flag detection
    const m = raw.trim().match(/^submit\s+(FLAG\{[^}]+\})/)
    if (m && VALID_FLAGS.has(m[1])) onFlagSubmit?.(m[1])
  }, [history, onFlagSubmit])

  // ── Keyboard handling ────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'Enter': {
        const cmd = input
        setHistIdx(-1)
        setInput('')
        execute(cmd)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const idx = Math.min(histIdx + 1, history.length - 1)
        setHistIdx(idx)
        setInput(history[idx] ?? '')
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        const idx = Math.max(histIdx - 1, -1)
        setHistIdx(idx)
        setInput(idx < 0 ? '' : history[idx] ?? '')
        break
      }
      case 'Tab': {
        e.preventDefault()
        const completed = tabComplete(input, cwdRef.current)
        if (completed) setInput(completed)
        break
      }
      case 'c': {
        if (e.ctrlKey) { e.preventDefault(); setInput('') }
        break
      }
      case 'l': {
        if (e.ctrlKey) { e.preventDefault(); setLines([]) }
        break
      }
    }
  }

  const { label: wsLabel, color: wsColor } = WS_META[wsStatus]
  const prompt = buildPrompt(cwd)

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%',
        background: '#0a0a0a', fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px', background: '#111', borderBottom: '1px solid #1f1f1f' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ef4444', '#fbbf24', '#00ff41'].map(c => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <span style={{ color: '#4b5563', fontSize: 11 }}>
          operator@breach-lab:{cwd.replace(HOME, '~')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%',
            background: wsColor, boxShadow: `0 0 6px ${wsColor}` }} />
          <span style={{ color: wsColor, fontSize: 10, letterSpacing: '0.05em' }}>{wsLabel}</span>
        </div>
      </div>

      {/* Output */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', fontSize: 13, lineHeight: 1.65 }}>
        {lines.map(line => (
          <div key={line.id} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            color: line.isPrompt ? '#e2e8f0' : 'rgba(226,232,240,0.82)' }}>
            <AnsiText text={line.text} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderTop: '1px solid #1a1a1a', background: '#080808' }}>
        <AnsiText text={prompt} />
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#e2e8f0', fontFamily: 'inherit', fontSize: 13, caretColor: '#00ff41' }}
        />
        <span style={{ color: '#374151', fontSize: 10 }}>↑↓ · TAB</span>
      </div>
    </div>
  )
}
