'use client'

interface Segment {
  text:   string
  color?: string
  bold?:  boolean
  dim?:   boolean
}

const CODE_MAP: Record<string, Partial<Segment>> = {
  '0': { color: undefined, bold: false, dim: false },
  '1': { bold: true },
  '2': { dim: true },
  '31': { color: '#ef4444' },
  '32': { color: '#00ff41' },
  '33': { color: '#fbbf24' },
  '34': { color: '#60a5fa' },
  '35': { color: '#c084fc' },
  '36': { color: '#22d3ee' },
  '90': { color: '#6b7280' },
  '91': { color: '#f87171' },
  '92': { color: '#4ade80' },
  '93': { color: '#fde047' },
}

function parseAnsi(text: string): Segment[] {
  const segments: Segment[] = []
  const re = /\x1b\[([0-9;]*)m/g
  let last  = 0
  let state: Segment = { text: '' }

  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ ...state, text: text.slice(last, match.index) })
    }

    for (const code of match[1].split(';')) {
      const mapped = CODE_MAP[code]
      if (mapped) Object.assign(state, mapped)
    }

    last = match.index + match[0].length
  }

  if (last < text.length) {
    segments.push({ ...state, text: text.slice(last) })
  }

  return segments
}

interface Props {
  text: string
}

export default function AnsiText({ text }: Props) {
  const segments = parseAnsi(text)

  return (
    <span>
      {segments.map((seg, i) => (
        <span
          key={i}
          style={{
            color:      seg.color,
            fontWeight: seg.bold ? 700 : undefined,
            opacity:    seg.dim  ? 0.5 : undefined,
          }}
        >
          {seg.text}
        </span>
      ))}
    </span>
  )
}
