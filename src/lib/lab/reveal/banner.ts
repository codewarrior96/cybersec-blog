import type { RevealEvent } from './types'

const BOX_INNER_WIDTH = 53 // characters between the box borders, padding included
const NEON_OPEN = '\x1b[1;38;2;0;255;65m'
const NEON_RESET = '\x1b[0m'

function ruleLine(corner: 'top' | 'bottom'): string {
  const left = corner === 'top' ? '╔' : '╚'
  const right = corner === 'top' ? '╗' : '╝'
  return `${NEON_OPEN}${left}${'═'.repeat(BOX_INNER_WIDTH + 4)}${right}${NEON_RESET}`
}

/**
 * Build a single banner row. Padding is computed from the plain (unstyled)
 * content length so embedded ANSI escapes never throw off alignment.
 */
function row(plain: string): string {
  const visible = plain.length >= BOX_INNER_WIDTH ? plain.slice(0, BOX_INNER_WIDTH) : plain
  const padding = ' '.repeat(Math.max(0, BOX_INNER_WIDTH - visible.length))
  return `${NEON_OPEN}║${NEON_RESET}  ${visible}${padding}  ${NEON_OPEN}║${NEON_RESET}`
}

/**
 * Render a CRT-style neon green ASCII banner announcing the level
 * completion. Width is fixed so terminal wrapping stays predictable.
 */
export function formatBanner(event: RevealEvent): string {
  const header = `✓ MISSION ACCOMPLISHED — LEVEL ${event.level}: ${event.levelTitle}`
  const flagLine = event.flag
  const nextLine = event.nextLevelTitle
    ? `→ LEVEL ${event.level + 1}: ${event.nextLevelTitle} unlocked`
    : '→ ALL CHALLENGES COMPLETE'

  return [
    ruleLine('top'),
    row(header),
    row(''),
    row(flagLine),
    row(''),
    row(nextLine),
    ruleLine('bottom'),
  ].join('\n')
}
