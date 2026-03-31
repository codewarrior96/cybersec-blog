import { CRITICAL_EFFECT_TOKENS, msToSeconds } from '@/lib/soc-runtime/critical-effects'

interface CriticalOverlayFxProps {
  cycle: number
}

export default function CriticalOverlayFx({ cycle }: CriticalOverlayFxProps) {
  const primaryScanDuration = msToSeconds(CRITICAL_EFFECT_TOKENS.primaryScanDurationMs)
  const secondaryScanDuration = msToSeconds(CRITICAL_EFFECT_TOKENS.secondaryScanDurationMs)
  const secondaryScanDelay = msToSeconds(CRITICAL_EFFECT_TOKENS.secondaryScanDelayMs)
  const overlayDuration = msToSeconds(CRITICAL_EFFECT_TOKENS.overlayDurationMs)
  const rgb = CRITICAL_EFFECT_TOKENS.colorRgb

  return (
    <div
      key={cycle}
      className="fixed inset-0 pointer-events-none critical-alert-active"
      style={{
        zIndex: 48,
        animation: `critical-pulse ${overlayDuration} ease-in-out forwards`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 7,
          background:
            `linear-gradient(90deg, transparent 0%, rgba(${rgb},0.6) 8%, rgba(${rgb},1) 25%, #ff6666 45%, #ffffff 50%, #ff6666 55%, rgba(${rgb},1) 75%, rgba(${rgb},0.6) 92%, transparent 100%)`,
          boxShadow: `0 0 40px 20px rgba(${rgb},0.80), 0 0 120px 60px rgba(${rgb},0.35)`,
          animation: `critical-scan-sweep ${primaryScanDuration} ${CRITICAL_EFFECT_TOKENS.scanEasing} forwards`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 6,
          background:
            `linear-gradient(90deg, transparent 0%, rgba(${rgb},0.5) 10%, rgba(${rgb},0.87) 30%, #ff8888 50%, rgba(255,255,255,0.67) 55%, #ff8888 60%, rgba(${rgb},0.87) 80%, rgba(${rgb},0.5) 90%, transparent 100%)`,
          boxShadow: `0 0 30px 14px rgba(${rgb},0.70), 0 0 90px 45px rgba(${rgb},0.28)`,
          animation: `critical-scan-sweep ${secondaryScanDuration} ${CRITICAL_EFFECT_TOKENS.scanEasing} ${secondaryScanDelay} forwards`,
          opacity: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          animation: `critical-border-flash ${overlayDuration} ease-in-out forwards`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 25%, rgba(${rgb},0.30) 70%, rgba(${rgb},0.55) 100%)`,
          animation: `critical-vignette ${overlayDuration} ease-in-out forwards`,
        }}
      />
    </div>
  )
}
