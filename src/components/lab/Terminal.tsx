'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AnsiText from './AnsiText'
import { runCommand, VALID_FLAGS } from '@/lib/lab/engine'
import { RingEvidenceLog, deserializeEvidenceLog, evidenceStorageKey, serializeEvidenceLog } from '@/lib/lab/evidence'
import { resolvePath, getNode } from '@/lib/lab/filesystem'
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

function tabComplete(input: string, cwd: string): string | null {
  const parts = input.split(' ')
  const last = parts[parts.length - 1]
  const dirPart = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : ''
  const partial = last.slice(dirPart.length)

  const node = getNode(resolvePath(cwd, dirPart || '.'))
  if (node?.type !== 'dir') return null

  const matches = Object.keys(node.children).filter(key => key.startsWith(partial))
  if (matches.length !== 1) return null

  const completed = matches[0]
  const isDir = node.children[completed]?.type === 'dir'
  parts[parts.length - 1] = dirPart + completed + (isDir ? '/' : '')
  return parts.join(' ')
}

interface Props {
  wsUrl?: string
  onFlagSubmit?: (flag: string) => void
  onEvidenceLogUpdate?: (log: EvidenceLog) => void
  pendingCommand?: PendingCommand | null
  onCommandConsumed?: () => void
  onCommandExecuted?: (execution: TerminalExecution) => void
}

export default function Terminal({ wsUrl, onFlagSubmit, onEvidenceLogUpdate, pendingCommand, onCommandConsumed, onCommandExecuted }: Props) {
  const resolvedWsUrl = wsUrl ?? process.env.NEXT_PUBLIC_TERMINAL_WS
  const [cwd, setCwd] = useState(HOME)
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [wsStatus, setWsStatus] = useState<WsStatus>('simulated')
  const [evidenceLog, setEvidenceLog] = useState<EvidenceLog>(new RingEvidenceLog())

  const cwdRef = useRef(cwd)
  const wsRef = useRef<WebSocket | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  cwdRef.current = cwd

  useEffect(() => {
    if (!pendingCommand) return
    execute(pendingCommand.cmd, 'assisted')
    onCommandConsumed?.()
  }, [pendingCommand?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return

    const key = evidenceStorageKey(EVIDENCE_SCENARIO_ID)
    setEvidenceLog(deserializeEvidenceLog(window.localStorage.getItem(key)))
  }, [])

  useEffect(() => {
    onEvidenceLogUpdate?.(evidenceLog)
  }, [evidenceLog, onEvidenceLogUpdate])

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
  }, [])

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
    }

    // Evidence currently emitted only in simulated mode. Future: capture from WebSocket protocol.
    const output = runCommand(raw, ctx, handleEvidenceEvent)

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
  }, [handleEvidenceEvent, history, onCommandExecuted, onFlagSubmit])

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'Enter': {
        const cmd = input
        setHistIdx(-1)
        setInput('')
        execute(cmd, 'manual')
        break
      }
      case 'ArrowUp': {
        event.preventDefault()
        const idx = Math.min(histIdx + 1, history.length - 1)
        setHistIdx(idx)
        setInput(history[idx] ?? '')
        break
      }
      case 'ArrowDown': {
        event.preventDefault()
        const idx = Math.max(histIdx - 1, -1)
        setHistIdx(idx)
        setInput(idx < 0 ? '' : history[idx] ?? '')
        break
      }
      case 'Tab': {
        event.preventDefault()
        const completed = tabComplete(input, cwdRef.current)
        if (completed) setInput(completed)
        break
      }
      case 'c': {
        if (event.ctrlKey) {
          event.preventDefault()
          setInput('')
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

  return (
    <div className="lab-terminal" onClick={() => inputRef.current?.focus()}>
      <div className="lab-terminal__chrome">
        <div className="lab-terminal__window-actions">
          {['#ff5f56', '#ffbd2e', '#27c93f'].map(color => (
            <span key={color} className="lab-terminal__window-dot" style={{ background: color }} />
          ))}
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
          <span className="lab-terminal__dock-hint">Enter to run - Up/Down for history</span>
        </div>
        <div className="lab-terminal__input-shell">
          <span className="lab-terminal__prompt">
            <AnsiText text={prompt} />
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="lab-terminal__input"
          />
          <span className="lab-terminal__input-shortcuts">UP/DOWN - TAB</span>
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
      `}</style>
    </div>
  )
}
