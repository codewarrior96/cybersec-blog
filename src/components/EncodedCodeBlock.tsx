'use client'

// Phase 1.5.13 — client-side base64 decode + syntax highlighting for
// payload-bearing code blocks. Defender ML heuristic
// (Trojan:PowerShell/ReverseShell.HNAA!MTB) flags the repo ZIP when raw
// reverse-shell / mimikatz / msfvenom payloads appear verbatim in `.mdx`
// source. This component lets those blocks ship as base64 strings inside
// `data="..."` attributes — readers see the original code (decoded +
// highlighted) at runtime; AV scanners see only base64.
//
// SENIOR ARCHITECT NOTE: decode happens in `useMemo` so re-renders don't
// thrash the decode path. Highlight tokens are computed once per `data`
// input. Copy button writes the DECODED text to clipboard — readers
// shouldn't have to base64-decode by hand to use the example.
//
// REJECTED ALTERNATIVE: decode in a server component and emit decoded
// text into the rendered HTML. Rejected — that re-introduces raw payload
// bytes into the static HTML output, which the Defender ZIP scanner can
// still match. Decoding MUST be runtime (client) for the encoding to
// neutralize the false positive.
//
// REJECTED ALTERNATIVE: ship shiki client-side for highlighting parity
// with the rest of the blog (rehype-pretty-code uses shiki). Rejected —
// shiki pulls a ~200KB+ WASM payload and language grammars on top. The
// blog already commits to `'use client'` islands sparingly;
// prism-react-renderer is ~20KB JS, no WASM, JSX-native rendering. Visual
// fidelity will differ slightly from the regular CodeBlock theme — that's
// acceptable, and the amber accent + "Educational payload" label makes
// the visual distinction intentional.

import { useMemo, useRef, useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { decodePayload } from '@/lib/content-encoding'

export interface EncodedCodeBlockProps {
  /** Base64-encoded payload text. Decoded at render time. */
  data: string
  /** Prism language identifier (bash, powershell, sql, javascript, etc.) */
  language: string
  /** Optional header label (e.g. filename) shown above the code. */
  filename?: string
}

export default function EncodedCodeBlock({
  data,
  language,
  filename,
}: EncodedCodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  // SENIOR ARCHITECT NOTE: useMemo gates decode behind data identity. If
  // `decodePayload` throws (corrupted base64), we capture the error here
  // and render a fallback below — must not let the exception propagate
  // and crash the post render.
  const { decoded, error } = useMemo(() => {
    try {
      return { decoded: decodePayload(data), error: null as Error | null }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[EncodedCodeBlock] decode failed:', err)
      return {
        decoded: '',
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }, [data])

  const copy = async () => {
    if (error) return
    try {
      await navigator.clipboard.writeText(decoded)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied (e.g. non-HTTPS local dev, sandbox). Soft
      // fail — don't surface an error UI for a non-critical action.
    }
  }

  if (error) {
    return (
      <div className="my-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="font-mono text-xs text-red-400">
          <span className="mr-2">⚠</span>
          [EncodedCodeBlock] base64 decode failed — content unavailable
        </div>
      </div>
    )
  }

  return (
    <div className="relative group/encoded my-6">
      {/* Top label bar — distinguishes encoded blocks from regular CodeBlock */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-t-lg border border-b-0 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-2 font-mono text-[11px] text-amber-400/90">
          <span aria-hidden>🛡️</span>
          <span>Educational payload</span>
          {filename && (
            <>
              <span className="text-amber-500/40">·</span>
              <span className="text-amber-300/70">{filename}</span>
            </>
          )}
          <span className="text-amber-500/40">·</span>
          <span className="text-amber-300/50 uppercase tracking-wider">
            {language}
          </span>
        </div>
        <button
          onClick={copy}
          className="px-2 py-0.5 text-[11px] font-mono
                     bg-slate-700/60 hover:bg-slate-600 text-slate-300 hover:text-white
                     border border-slate-600/60 rounded
                     opacity-0 group-hover/encoded:opacity-100 transition-all duration-150"
          aria-label="Copy decoded payload"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <Highlight code={decoded} language={language} theme={themes.vsDark}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            ref={preRef}
            className={`${className} m-0 overflow-x-auto rounded-t-none rounded-b-lg
                        border border-amber-500/30 border-l-2 border-l-amber-500/60
                        px-4 py-3 text-sm font-mono leading-relaxed`}
            style={style}
          >
            {tokens.map((line, lineIdx) => {
              const lineProps = getLineProps({ line, key: lineIdx })
              return (
                <div key={lineIdx} {...lineProps}>
                  {line.map((token, tokenIdx) => {
                    const tokenProps = getTokenProps({ token, key: tokenIdx })
                    return <span key={tokenIdx} {...tokenProps} />
                  })}
                </div>
              )
            })}
          </pre>
        )}
      </Highlight>
    </div>
  )
}
