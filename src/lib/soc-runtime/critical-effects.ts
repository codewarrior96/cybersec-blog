export const CRITICAL_EFFECT_TOKENS = {
  colorHex: '#ef4444',
  colorRgb: '239,68,68',
  overlayDurationMs: 7000,
  primaryScanDurationMs: 1600,
  secondaryScanDurationMs: 1700,
  secondaryScanDelayMs: 1800,
  scanEasing: 'cubic-bezier(0.3,0,0.7,1)',
} as const

export function msToSeconds(ms: number): string {
  return `${ms / 1000}s`
}
