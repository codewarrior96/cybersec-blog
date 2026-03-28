'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { AttackEvent } from '@/lib/dashboard-types';

/* ── Country name → [lat, lng] ── */
const CC: Record<string, [number, number]> = {
  Russia: [55.75, 37.62],         China: [39.91, 116.39],
  'United States': [38.89, -77.04], USA: [38.89, -77.04],
  Brazil: [-15.78, -47.93],       India: [28.61, 77.21],
  Germany: [52.52, 13.40],        Netherlands: [52.37, 4.90],
  Singapore: [1.35, 103.82],      Turkey: [39.93, 32.86],
  Iran: [35.69, 51.42],           'North Korea': [39.02, 125.75],
  Ukraine: [50.45, 30.52],        Romania: [44.43, 26.10],
  Vietnam: [21.03, 105.85],       Indonesia: [-6.21, 106.85],
  Pakistan: [33.72, 73.06],       Thailand: [13.75, 100.52],
  Mexico: [19.43, -99.13],        Argentina: [-34.61, -58.38],
  'South Korea': [37.57, 126.98], Japan: [35.69, 139.69],
  France: [48.86, 2.35],          'United Kingdom': [51.51, -0.13],
  Spain: [40.42, -3.70],          Italy: [41.90, 12.49],
  Poland: [52.23, 21.01],         Canada: [45.42, -75.70],
  Australia: [-35.28, 149.13],    'South Africa': [-25.75, 28.19],
  Nigeria: [9.05, 7.49],          Egypt: [30.06, 31.25],
  Israel: [31.77, 35.22],         'Saudi Arabia': [24.68, 46.72],
  Kazakhstan: [51.18, 71.45],     Belarus: [53.90, 27.57],
  Venezuela: [10.49, -66.88],     Colombia: [4.71, -74.07],
  Philippines: [14.60, 120.98],   Morocco: [34.01, -6.83],
};

/* ── Demo sources (shown when no real attacks) ── */
const DEMO: Array<{ from: [number, number]; country: string; sev: 'critical' | 'high' | 'low' }> = [
  { from: CC.Russia,           country: 'Russia',        sev: 'critical' },
  { from: CC.China,            country: 'China',         sev: 'high'     },
  { from: CC['North Korea'],   country: 'North Korea',   sev: 'critical' },
  { from: CC.Brazil,           country: 'Brazil',        sev: 'high'     },
  { from: CC.Iran,             country: 'Iran',          sev: 'high'     },
  { from: CC.India,            country: 'India',         sev: 'low'      },
  { from: CC['United States'], country: 'USA',           sev: 'low'      },
  { from: CC.Netherlands,      country: 'Netherlands',   sev: 'low'      },
];

/* ── Our defended hub ── */
const HUB: [number, number] = [39.93, 32.86]; // Ankara
const GLOBE_THETA = 0.3;                       // tilt — must match cobe theta

/* ── Arc state ── */
interface Arc {
  id: string;
  from: [number, number];
  to: [number, number];
  progress: number;
  speed: number;
  color: string;
  glow: string;
  country: string;
  severity: string;
  born: number;
}

const SEV = {
  critical: { stroke: '#ef4444', glow: '#ef4444' },
  high:     { stroke: '#f97316', glow: '#f97316' },
  low:      { stroke: '#8b5cf6', glow: '#8b5cf6' },
} as const;

function getSev(s: string) { return SEV[s as keyof typeof SEV] ?? SEV.low; }

/* ── Orthographic projection ── */
function project(
  lat: number, lng: number,
  phi: number, theta: number,
  cx: number, cy: number, r: number,
): { x: number; y: number; z: number } | null {
  const lam = lng * (Math.PI / 180) - phi;
  const p   = lat * (Math.PI / 180);
  const sP  = Math.sin(p), cP = Math.cos(p);
  const sT  = Math.sin(theta), cT = Math.cos(theta);
  const z   = sT * sP + cT * cP * Math.cos(lam);
  if (z < -0.05) return null;
  return {
    x: cx + cP * Math.sin(lam) * r,
    y: cy - (cT * sP - sT * cP * Math.cos(lam)) * r,
    z,
  };
}

/* ── Great-circle interpolation ── */
function gcPoint(
  from: [number, number], to: [number, number], t: number,
): [number, number] {
  const D = Math.PI / 180, R = 180 / Math.PI;
  const φ1 = from[0] * D, λ1 = from[1] * D;
  const φ2 = to[0]   * D, λ2 = to[1]   * D;
  const d  = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
  ));
  if (d < 0.001) return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t       * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const zz= A * Math.sin(φ1)                + B * Math.sin(φ2);
  return [R * Math.atan2(zz, Math.sqrt(x * x + y * y)), R * Math.atan2(y, x)];
}

interface ThreatMapWidgetProps {
  attacks?: AttackEvent[];
}

export default function ThreatMapWidget({ attacks = [] }: ThreatMapWidgetProps) {
  const globeRef        = useRef<HTMLCanvasElement>(null);
  const overlayRef      = useRef<HTMLCanvasElement>(null);
  const containerRef    = useRef<HTMLDivElement>(null);
  const phiRef          = useRef(0);
  const arcsRef         = useRef<Arc[]>([]);
  const demoTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef          = useRef(0);
  const globeInstanceRef = useRef<{ update: (s: Record<string, unknown>) => void; destroy: () => void } | null>(null);
  const [dims, setDims] = useState({ w: 500, h: 300 });

  /* ── Observe container size ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setDims({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Spawn arcs from real attacks ── */
  useEffect(() => {
    if (!attacks.length) return;
    for (const a of attacks) {
      const coords = CC[a.sourceCountry];
      if (!coords || arcsRef.current.find(x => x.id === String(a.id))) continue;
      const c = getSev(a.severity);
      arcsRef.current = [
        ...arcsRef.current.slice(-19),
        {
          id: String(a.id), from: coords, to: HUB,
          progress: 0, speed: 0.003 + Math.random() * 0.002,
          color: c.stroke, glow: c.glow,
          country: a.sourceCountry, severity: a.severity,
          born: Date.now(),
        },
      ];
    }
  }, [attacks]);

  /* ── Demo arcs when no real data ── */
  useEffect(() => {
    if (attacks.length) {
      if (demoTimerRef.current) { clearInterval(demoTimerRef.current); demoTimerRef.current = null; }
      return;
    }
    let idx = 0;
    const spawn = () => {
      const src = DEMO[idx % DEMO.length]; idx++;
      const c   = getSev(src.sev);
      const id  = `demo-${idx}`;
      if (!arcsRef.current.find(x => x.id === id)) {
        arcsRef.current = [
          ...arcsRef.current.slice(-12),
          {
            id, from: src.from, to: HUB,
            progress: 0, speed: 0.003 + Math.random() * 0.002,
            color: c.stroke, glow: c.glow,
            country: src.country, severity: src.sev,
            born: Date.now(),
          },
        ];
      }
    };
    spawn();
    demoTimerRef.current = setInterval(spawn, 2200);
    return () => { if (demoTimerRef.current) clearInterval(demoTimerRef.current); };
  }, [attacks.length]);

  /* ── Init cobe globe ── */
  useEffect(() => {
    const canvas = globeRef.current;
    if (!canvas || dims.w === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let globe: { destroy: () => void } | null = null;

    import('cobe').then(mod => {
      globe = mod.default(canvas, {
        devicePixelRatio: dpr,
        width:  dims.w * dpr,
        height: dims.h * dpr,
        phi: 0, theta: GLOBE_THETA,
        dark: 1, diffuse: 1.2,
        mapSamples: 22000,
        mapBrightness: 8,
        baseColor:   [0.07, 0.0, 0.22],
        markerColor: [1, 0.2, 0.2],
        glowColor:   [0.32, 0.08, 0.80],
        scale: 1.05,
        markers: [],
      });
      globeInstanceRef.current = globe as unknown as { update: (s: Record<string, unknown>) => void; destroy: () => void };
    }).catch(() => {});

    return () => {
      globe?.destroy();
      globeInstanceRef.current = null;
    };
  }, [dims.w, dims.h]);

  /* ── Overlay draw loop ── */
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || dims.w === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = dims.w, H = dims.h;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      /* Resize canvas pixels if needed */
      const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width  = pw;
        canvas.height = ph;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      /* Rotate globe */
      phiRef.current += 0.003;
      globeInstanceRef.current?.update({ phi: phiRef.current });

      const phi = phiRef.current;
      const cx  = W / 2, cy = H / 2;
      const r   = Math.min(cx, cy) * 0.9;
      const now = Date.now();

      /* ─── Arcs ─── */
      const nextArcs: Arc[] = [];
      for (const arc of arcsRef.current) {
        arc.progress += arc.speed;
        const timeToFinish = 1 / (arc.speed * 60); // seconds
        const elapsed = (now - arc.born) / 1000;
        const opacity = arc.progress >= 1
          ? Math.max(0, 1 - (elapsed - timeToFinish) / 3.5)
          : 1;
        if (opacity <= 0) continue;
        nextArcs.push(arc);

        const drawTo = Math.min(1, arc.progress);
        const segs   = 100;

        /* Draw arc path */
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= segs; i++) {
          const t   = (i / segs) * drawTo;
          const [lat, lng] = gcPoint(arc.from, arc.to, t);
          const pt  = project(lat, lng, phi, GLOBE_THETA, cx, cy, r);
          if (!pt) { started = false; continue; }
          if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
          else ctx.lineTo(pt.x, pt.y);
        }
        /* Glow pass (thick, blurred) */
        ctx.strokeStyle = arc.color;
        ctx.lineWidth   = 4;
        ctx.globalAlpha = opacity * 0.25;
        ctx.shadowBlur  = 16;
        ctx.shadowColor = arc.glow;
        ctx.stroke();

        /* Sharp pass (thin, crisp) */
        ctx.strokeStyle = arc.color;
        ctx.lineWidth   = 1.8;
        ctx.globalAlpha = opacity * 0.95;
        ctx.shadowBlur  = 10;
        ctx.shadowColor = arc.glow;
        ctx.stroke();
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;

        /* Moving head blip */
        if (arc.progress < 1) {
          const [lat, lng] = gcPoint(arc.from, arc.to, arc.progress);
          const pt = project(lat, lng, phi, GLOBE_THETA, cx, cy, r);
          if (pt) {
            /* Outer flare */
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
            ctx.fillStyle   = arc.color;
            ctx.globalAlpha = opacity * 0.3;
            ctx.shadowBlur  = 14;
            ctx.shadowColor = arc.glow;
            ctx.fill();
            /* Core */
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle   = '#ffffff';
            ctx.globalAlpha = opacity * 0.9;
            ctx.shadowBlur  = 8;
            ctx.shadowColor = arc.color;
            ctx.fill();
            ctx.shadowBlur  = 0;
            ctx.globalAlpha = 1;
          }
        }
      }
      arcsRef.current = nextArcs;

      /* ─── Attack origin blips ─── */
      const activeSrc = attacks.length
        ? attacks.map(a => ({ country: a.sourceCountry, severity: a.severity, coords: CC[a.sourceCountry] }))
        : DEMO.map(d => ({ country: d.country, severity: d.sev, coords: d.from }));

      const seen = new Set<string>();
      for (const src of activeSrc) {
        if (!src.coords || seen.has(src.country)) continue;
        seen.add(src.country);
        const pt = project(src.coords[0], src.coords[1], phi, GLOBE_THETA, cx, cy, r);
        if (!pt) continue;

        const c      = getSev(src.severity);
        const pulse  = 0.5 + 0.5 * Math.sin(now / 500 + src.coords[0] * 0.31);
        const isCrit = src.severity === 'critical';

        /* Outer pulse ring */
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5 + pulse * (isCrit ? 12 : 7), 0, Math.PI * 2);
        ctx.strokeStyle = c.stroke;
        ctx.globalAlpha = pulse * 0.45;
        ctx.lineWidth   = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;

        /* Second ring for critical */
        if (isCrit) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3 + pulse * 4, 0, Math.PI * 2);
          ctx.strokeStyle = c.stroke;
          ctx.globalAlpha = pulse * 0.7;
          ctx.lineWidth   = 0.8;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        /* Core dot */
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isCrit ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle   = c.stroke;
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = isCrit ? 22 : 14;
        ctx.shadowColor = c.glow;
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;

        /* Country label */
        ctx.font        = `bold ${isCrit ? 9 : 8}px monospace`;
        ctx.fillStyle   = c.stroke;
        ctx.globalAlpha = 0.85;
        ctx.shadowBlur  = 4;
        ctx.shadowColor = c.glow;
        ctx.fillText(src.country.toUpperCase(), pt.x + 6, pt.y - 4);
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
      }

      /* ─── Hub ─── */
      const hub = project(HUB[0], HUB[1], phi, GLOBE_THETA, cx, cy, r);
      if (hub) {
        const p = 0.5 + 0.5 * Math.sin(now / 700);

        /* Pulsing rings */
        for (let ring = 1; ring <= 3; ring++) {
          ctx.beginPath();
          ctx.arc(hub.x, hub.y, ring * 8 + p * 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#c084fc';
          ctx.globalAlpha = (0.38 / ring) * (0.6 + 0.4 * p);
          ctx.lineWidth   = 0.8;
          ctx.stroke();
        }

        /* Core dot */
        ctx.beginPath();
        ctx.arc(hub.x, hub.y, 5, 0, Math.PI * 2);
        ctx.fillStyle   = '#c084fc';
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 18;
        ctx.shadowColor = 'rgba(192,132,252,0.9)';
        ctx.fill();
        ctx.shadowBlur  = 0;

        /* Label */
        ctx.font        = 'bold 9px monospace';
        ctx.fillStyle   = '#c084fc';
        ctx.globalAlpha = 0.9;
        ctx.fillText('◈ ANKARA', hub.x + 8, hub.y - 4);
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [attacks, dims]);

  /* ── UI data ── */
  const recent     = attacks.slice(-3).reverse();
  const critCount  = attacks.filter(a => a.severity === 'critical').length;
  const origins    = new Set(attacks.map(a => a.sourceCountry)).size;
  const isDemo     = attacks.length === 0;

  return (
    <div className="absolute inset-0 flex flex-col font-mono overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-violet-500/20 shrink-0">
        <span className="text-violet-400 font-bold tracking-widest uppercase text-xs">⬡ TÜRKİYE TEHDİT HARİTASI</span>
        <div className="flex items-center gap-3 text-[10px]">
          {!isDemo && (
            <>
              <span className="text-slate-500">
                CRITICAL: <span className="text-red-400 font-bold">{critCount}</span>
              </span>
              <span className="text-slate-500">
                ORIGINS: <span className="text-violet-400 font-bold">{origins}</span>
              </span>
            </>
          )}
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 font-bold">{isDemo ? 'SCANNING' : 'LIVE'}</span>
          </span>
        </div>
      </div>

      {/* Globe container */}
      <div className="flex-1 min-h-0 relative overflow-hidden" ref={containerRef}>

        {/* Cobe WebGL globe */}
        <canvas
          ref={globeRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* Attack arcs + markers overlay */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0"
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        />

        {/* Live threats panel */}
        {recent.length > 0 && (
          <div className="absolute bottom-2 left-2 z-20 bg-[#0d0018]/90 px-2 py-1.5 rounded border border-red-500/30 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-red-400 font-bold tracking-widest text-[8px] ml-1">LIVE THREATS</span>
            </div>
            {recent.map((a, i) => {
              const col = getSev(a.severity).stroke;
              return (
                <div key={i} className="flex items-center gap-1.5 text-[9px] leading-snug">
                  <span className="w-1 h-1 rounded-full shrink-0 animate-pulse" style={{ background: col }} />
                  <span className="font-bold tabular-nums shrink-0" style={{ color: col }}>{a.sourceIP}</span>
                  <span className="text-slate-500">({a.sourceCountry})</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Demo mode hint */}
        {isDemo && (
          <div className="absolute bottom-2 left-2 z-20 text-[9px] text-slate-600 font-mono">
            DEMO MODE — awaiting live data
          </div>
        )}

      </div>
    </div>
  );
}
