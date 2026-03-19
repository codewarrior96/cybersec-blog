'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface ThreatCountry {
  name: string
  count: number
}

interface ThreatAttack {
  sourceCountry: string
  sourceIP: string
  time: string
  type: string
  severity: 'critical' | 'high' | 'low'
}

interface ThreatGlobeProps {
  countries: ThreatCountry[]
  attacks: ThreatAttack[]
  onCountrySelect?: (country: ThreatCountry) => void
}

interface Coord {
  lat: number
  lon: number
}

interface ArcPulse {
  id: number
  from: Coord
  createdAt: number
  lifetime: number
  color: string
}

interface Hotspot {
  id: string
  coord: Coord
  intensity: number
  count: number
}

interface HotspotHitbox {
  name: string
  count: number
  x: number
  y: number
  r: number
}

const COUNTRY_POINTS: Record<string, Coord> = {
  usa: { lat: 39.8, lon: -98.6 },
  china: { lat: 35.8, lon: 104.1 },
  russia: { lat: 61.5, lon: 105.3 },
  brazil: { lat: -14.2, lon: -51.9 },
  germany: { lat: 51.2, lon: 10.4 },
  iran: { lat: 32.4, lon: 53.6 },
  turkiye: { lat: 39.0, lon: 35.2 },
  india: { lat: 21.0, lon: 78.9 },
  canada: { lat: 56.1, lon: -106.3 },
  australia: { lat: -25.3, lon: 133.8 },
  uk: { lat: 55.0, lon: -3.4 },
  france: { lat: 46.2, lon: 2.2 },
  italy: { lat: 41.8, lon: 12.5 },
  spain: { lat: 40.4, lon: -3.7 },
  japan: { lat: 36.2, lon: 138.2 },
  korea: { lat: 36.5, lon: 127.8 },
  netherlands: { lat: 52.1, lon: 5.3 },
  poland: { lat: 52.1, lon: 19.4 },
  ukraine: { lat: 48.3, lon: 31.2 },
  singapore: { lat: 1.35, lon: 103.8 },
}

const COUNTRY_ALIASES: Record<string, string> = {
  us: 'usa',
  unitedstates: 'usa',
  unitedstatesofamerica: 'usa',
  russianfederation: 'russia',
  turkey: 'turkiye',
  turkiye: 'turkiye',
  tuerkiye: 'turkiye',
  unitedkingdom: 'uk',
  greatbritain: 'uk',
  britain: 'uk',
  republicofkorea: 'korea',
  southkorea: 'korea',
}

const TARGET_HUB = COUNTRY_POINTS.turkiye

function normalizeCountryName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '')
}

function resolveCountryPoint(name: string): Coord | null {
  const normalized = normalizeCountryName(name)
  const key = COUNTRY_ALIASES[normalized] ?? normalized
  return COUNTRY_POINTS[key] ?? null
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function interpolateLon(from: number, to: number, t: number) {
  let delta = to - from
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return from + delta * t
}

function geoToVector(coord: Coord, rotation: number) {
  const lat = toRadians(coord.lat)
  const lon = toRadians(coord.lon) + rotation
  const cosLat = Math.cos(lat)
  return {
    x: cosLat * Math.cos(lon),
    y: Math.sin(lat),
    z: cosLat * Math.sin(lon),
  }
}

function projectPoint(
  vector: { x: number; y: number; z: number },
  cx: number,
  cy: number,
  radius: number,
  altitude = 0,
) {
  const depthScale = 1 + vector.z * 0.22
  const scaledRadius = radius * (1 + altitude)
  return {
    x: cx + vector.x * scaledRadius * depthScale,
    y: cy + vector.y * scaledRadius * depthScale,
    z: vector.z,
  }
}

export default function ThreatGlobe({ countries, attacks, onCountrySelect }: ThreatGlobeProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number | null>(null)
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
  const pulsesRef = useRef<ArcPulse[]>([])
  const pulseSeqRef = useRef(1)
  const latestAttackRef = useRef<string | null>(null)
  const hotspotHitboxesRef = useRef<HotspotHitbox[]>([])
  const hasRenderedFrameRef = useRef(false)
  const [fallbackMode, setFallbackMode] = useState(false)

  const hotspots = useMemo<Hotspot[]>(() => {
    if (!countries.length) return []
    const maxCount = Math.max(...countries.map((c) => c.count), 1)
    return countries
      .slice(0, 8)
      .map((country) => {
        const coord = resolveCountryPoint(country.name)
        if (!coord) return null
        return {
          id: country.name,
          coord,
          count: country.count,
          intensity: Math.max(0.2, country.count / maxCount),
        }
      })
      .filter((item): item is Hotspot => item !== null)
  }, [countries])

  const density = useMemo(() => {
    if (!countries.length) return 0
    const total = countries.reduce((sum, country) => sum + country.count, 0)
    const max = Math.max(...countries.map((country) => country.count), 1)
    return Math.min(100, Math.round((total / (max * countries.length)) * 100))
  }, [countries])

  useEffect(() => {
    const latest = attacks[0]
    if (!latest) return

    const fingerprint = `${latest.time}|${latest.sourceIP}|${latest.type}`
    if (latestAttackRef.current === fingerprint) return
    latestAttackRef.current = fingerprint

    const from = resolveCountryPoint(latest.sourceCountry)
    if (!from) return

    const color =
      latest.severity === 'critical'
        ? '#ef4444'
        : latest.severity === 'high'
          ? '#f59e0b'
          : '#00ff41'

    pulsesRef.current = [
      {
        id: pulseSeqRef.current++,
        from,
        createdAt: performance.now(),
        lifetime: 2600,
        color,
      },
      ...pulsesRef.current,
    ].slice(0, 20)
  }, [attacks])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pickCountry = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const hitboxes = hotspotHitboxesRef.current
      let best: HotspotHitbox | null = null
      let bestDistance = Number.POSITIVE_INFINITY

      for (const hitbox of hitboxes) {
        const dx = x - hitbox.x
        const dy = y - hitbox.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance <= hitbox.r && distance < bestDistance) {
          best = hitbox
          bestDistance = distance
        }
      }

      if (best && onCountrySelect) {
        onCountrySelect({ name: best.name, count: best.count })
      }
    }

    const updateCursor = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const active = hotspotHitboxesRef.current.some((hitbox) => {
        const dx = x - hitbox.x
        const dy = y - hitbox.y
        return Math.sqrt(dx * dx + dy * dy) <= hitbox.r
      })
      canvas.style.cursor = active ? 'pointer' : 'default'
    }

    const onClick = (event: MouseEvent) => {
      pickCountry(event.clientX, event.clientY)
    }

    const onMove = (event: MouseEvent) => {
      updateCursor(event.clientX, event.clientY)
    }

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      pickCountry(touch.clientX, touch.clientY)
    }

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      updateCursor(touch.clientX, touch.clientY)
    }

    const onLeave = () => {
      canvas.style.cursor = 'default'
    }

    canvas.addEventListener('click', onClick)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('mouseleave', onLeave)

    return () => {
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.style.cursor = 'default'
    }
  }, [onCountrySelect])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    hasRenderedFrameRef.current = false
    setFallbackMode(false)

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const width = Math.max(10, Math.floor(rect.width))
      const height = Math.max(10, Math.floor(rect.height))
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = { width, height, dpr }
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    window.addEventListener('resize', resize)
    const fallbackWatchdog = window.setTimeout(() => {
      if (!hasRenderedFrameRef.current) {
        setFallbackMode(true)
      }
    }, 1600)

    const drawParallel = (rotation: number, lat: number, cx: number, cy: number, radius: number) => {
      ctx.beginPath()
      let drawing = false
      for (let lon = -180; lon <= 180; lon += 6) {
        const point = projectPoint(geoToVector({ lat, lon }, rotation), cx, cy, radius)
        if (point.z <= -0.1) {
          drawing = false
          continue
        }
        if (!drawing) {
          ctx.moveTo(point.x, point.y)
          drawing = true
        } else {
          ctx.lineTo(point.x, point.y)
        }
      }
      ctx.stroke()
    }

    const drawMeridian = (rotation: number, lon: number, cx: number, cy: number, radius: number) => {
      ctx.beginPath()
      let drawing = false
      for (let lat = -75; lat <= 75; lat += 5) {
        const point = projectPoint(geoToVector({ lat, lon }, rotation), cx, cy, radius)
        if (point.z <= -0.1) {
          drawing = false
          continue
        }
        if (!drawing) {
          ctx.moveTo(point.x, point.y)
          drawing = true
        } else {
          ctx.lineTo(point.x, point.y)
        }
      }
      ctx.stroke()
    }

    const drawHub = (rotation: number, cx: number, cy: number, radius: number, ts: number) => {
      const hubVec = geoToVector(TARGET_HUB, rotation)
      const hub = projectPoint(hubVec, cx, cy, radius)
      if (hub.z <= -0.1) return
      const pulse = 0.6 + 0.4 * Math.sin(ts * 0.004)
      const outer = 10 + pulse * 4
      const grad = ctx.createRadialGradient(hub.x, hub.y, 0, hub.x, hub.y, outer)
      grad.addColorStop(0, 'rgba(0,255,65,0.95)')
      grad.addColorStop(1, 'rgba(0,255,65,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(hub.x, hub.y, outer, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#00ff41'
      ctx.beginPath()
      ctx.arc(hub.x, hub.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawPulses = (rotation: number, cx: number, cy: number, radius: number, ts: number) => {
      const active: ArcPulse[] = []
      for (const pulse of pulsesRef.current) {
        const age = ts - pulse.createdAt
        if (age >= pulse.lifetime) continue
        const progress = age / pulse.lifetime
        active.push(pulse)

        ctx.strokeStyle = pulse.color
        ctx.lineWidth = 1.2
        ctx.globalAlpha = 0.72 * (1 - progress)
        ctx.beginPath()

        let started = false
        const segments = 28
        const maxStep = Math.max(2, Math.floor(segments * progress))
        for (let step = 0; step <= maxStep; step += 1) {
          const t = step / segments
          const lat = pulse.from.lat + (TARGET_HUB.lat - pulse.from.lat) * t
          const lon = interpolateLon(pulse.from.lon, TARGET_HUB.lon, t)
          const altitude = Math.sin(Math.PI * t) * 0.34
          const point = projectPoint(geoToVector({ lat, lon }, rotation), cx, cy, radius, altitude)
          if (point.z <= -0.12) {
            started = false
            continue
          }
          if (!started) {
            ctx.moveTo(point.x, point.y)
            started = true
          } else {
            ctx.lineTo(point.x, point.y)
          }
        }

        ctx.stroke()
      }

      pulsesRef.current = active
      ctx.globalAlpha = 1
    }

    const render = (ts: number) => {
      const { width, height } = sizeRef.current
      if (!width || !height) {
        frameRef.current = window.requestAnimationFrame(render)
        return
      }

      ctx.clearRect(0, 0, width, height)

      const cx = width >= 1200 ? width * 0.38 : width * 0.5
      const cy = height * 0.5
      const radius = Math.max(82, Math.min(height * 0.42, width * 0.18))
      const rotation = ts * 0.00025

      const bg = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius * 2.1)
      bg.addColorStop(0, 'rgba(6,48,26,0.5)')
      bg.addColorStop(0.6, 'rgba(3,16,10,0.2)')
      bg.addColorStop(1, 'rgba(5,8,8,0)')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      const halo = ctx.createRadialGradient(cx, cy, radius * 0.75, cx, cy, radius * 1.55)
      halo.addColorStop(0, 'rgba(0,255,65,0.28)')
      halo.addColorStop(1, 'rgba(0,255,65,0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 1.45, 0, Math.PI * 2)
      ctx.fill()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(-0.2)
      ctx.scale(1, 0.38)
      ctx.strokeStyle = 'rgba(0,255,65,0.26)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(0, 0, radius * 1.48, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      const globe = ctx.createRadialGradient(
        cx - radius * 0.34,
        cy - radius * 0.5,
        radius * 0.05,
        cx,
        cy,
        radius * 1.12,
      )
      globe.addColorStop(0, 'rgba(20,100,52,0.98)')
      globe.addColorStop(0.65, 'rgba(8,42,25,0.96)')
      globe.addColorStop(1, 'rgba(3,12,8,0.99)')
      ctx.fillStyle = globe
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = 'rgba(0,255,65,0.58)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.stroke()

      ctx.strokeStyle = 'rgba(0,255,65,0.22)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2)
      ctx.stroke()

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.clip()

      ctx.strokeStyle = 'rgba(0,255,65,0.28)'
      ctx.lineWidth = 0.8
      for (let lat = -60; lat <= 60; lat += 20) {
        drawParallel(rotation, lat, cx, cy, radius)
      }

      ctx.strokeStyle = 'rgba(0,255,65,0.18)'
      for (let lon = -160; lon <= 160; lon += 20) {
        drawMeridian(rotation, lon, cx, cy, radius)
      }

      drawPulses(rotation, cx, cy, radius, ts)

      const hitboxes: HotspotHitbox[] = []
      hotspots.forEach((spot, index) => {
        const vec = geoToVector(spot.coord, rotation)
        const point = projectPoint(vec, cx, cy, radius)
        if (point.z <= -0.08) return

        const pulse = 0.65 + 0.35 * Math.sin(ts * 0.0034 + index * 0.9)
        const intensity = spot.intensity * pulse
        const glowRadius = 8 + intensity * 10

        const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius)
        const hotColor = intensity > 0.7 ? '245,158,11' : '0,255,65'
        glow.addColorStop(0, `rgba(${hotColor},0.8)`)
        glow.addColorStop(1, `rgba(${hotColor},0)`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(point.x, point.y, glowRadius, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = intensity > 0.7 ? '#f59e0b' : '#00ff41'
        ctx.beginPath()
        ctx.arc(point.x, point.y, 1.8 + intensity * 2.4, 0, Math.PI * 2)
        ctx.fill()

        hitboxes.push({
          name: spot.id,
          count: spot.count,
          x: point.x,
          y: point.y,
          r: Math.max(10, glowRadius * 0.65),
        })
      })
      hotspotHitboxesRef.current = hitboxes

      const scannerY = cy + Math.sin(ts * 0.0022) * radius * 0.75
      const scanner = ctx.createLinearGradient(0, scannerY - 1, 0, scannerY + 1)
      scanner.addColorStop(0, 'rgba(0,255,65,0)')
      scanner.addColorStop(0.5, 'rgba(0,255,65,0.35)')
      scanner.addColorStop(1, 'rgba(0,255,65,0)')
      ctx.strokeStyle = scanner
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(cx - radius, scannerY)
      ctx.lineTo(cx + radius, scannerY)
      ctx.stroke()

      ctx.restore()

      drawHub(rotation, cx, cy, radius, ts)
      hasRenderedFrameRef.current = true
      frameRef.current = window.requestAnimationFrame(render)
    }

    frameRef.current = window.requestAnimationFrame(render)

    return () => {
      window.clearTimeout(fallbackWatchdog)
      window.removeEventListener('resize', resize)
      observer.disconnect()
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [hotspots])

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        height: 300,
        borderRadius: 8,
        border: '1px solid #15301f',
        background: 'radial-gradient(circle at 50% 35%, rgba(0,255,65,0.07), rgba(4,8,8,0.95))',
        overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 10,
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#4d7c4d',
          letterSpacing: '0.12em',
          pointerEvents: 'none',
        }}
      >
        THREAT GLOBE v3
      </div>

      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#00ff41',
          letterSpacing: '0.12em',
          pointerEvents: 'none',
        }}
      >
        LIVE DENSITY {density}%
      </div>

      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 12,
          width: 'min(260px, 44%)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            height: 6,
            width: '100%',
            border: '1px solid #1a2a1a',
            background: 'rgba(0,0,0,0.45)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${density}%`,
              background: 'linear-gradient(90deg, #00ff41, #f59e0b)',
              boxShadow: '0 0 10px rgba(0,255,65,0.35)',
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 24,
          fontSize: 9,
          fontFamily: 'monospace',
          color: 'rgba(148,163,184,0.82)',
          letterSpacing: '0.08em',
          pointerEvents: 'none',
        }}
      >
        TAP HOTSPOT FOR DETAILS
      </div>

      {fallbackMode && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: '50%',
              border: '2px solid rgba(0,255,65,0.65)',
              background: 'radial-gradient(circle at 30% 25%, rgba(92,255,144,0.52), rgba(7,20,13,0.98))',
              boxShadow: '0 0 28px rgba(0,255,65,0.45), inset 0 0 24px rgba(0,255,65,0.2)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, 110px)',
              color: '#f59e0b',
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: '0.09em',
            }}
          >
            FALLBACK MODE ACTIVE
          </div>
        </div>
      )}

      {hotspots.length === 0 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#64748b',
            letterSpacing: '0.1em',
            pointerEvents: 'none',
          }}
        >
          NO GEO HOTSPOT DATA
        </div>
      )}
    </div>
  )
}
