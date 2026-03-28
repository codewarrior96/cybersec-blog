'use client';
import React, { useState, useEffect } from 'react';
import type { AttackEvent } from '@/lib/dashboard-types';

import type { WorkflowMetrics } from '@/lib/dashboard-types';

interface LiveIntelFeedWidgetProps {
  attacks: AttackEvent[];
  threatScore: number;
  metrics?: WorkflowMetrics | null;
  onReport?: (attack: AttackEvent) => void;
}

interface Blip {
  id: string;
  x: number;
  y: number;
  severity: 'critical' | 'high' | 'low';
  age: number;
  type: string;
  country: string;
}

/* Severity → color (semantic: critical=red, high=orange, low=violet) */
const SEV: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  low:      '#8b5cf6',
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

/** SVG arc sector path */
function sector(cx: number, cy: number, r: number, a1: number, a2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
  const x2 = cx + r * Math.cos(rad(a2)), y2 = cy + r * Math.sin(rad(a2));
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`;
}

const TRAIL_STEPS = 8;

/* Country → radar polar position [angleDeg, distance 0–1] */
const COUNTRY_RADAR: Record<string, [number, number]> = {
  Russia:        [40,  0.76],
  China:         [18,  0.82],
  USA:           [248, 0.66],
  Germany:       [82,  0.60],
  Brazil:        [218, 0.72],
  Iran:          [58,  0.74],
  Netherlands:   [88,  0.56],
  Turkey:        [68,  0.64],
  India:         [28,  0.70],
  Singapore:     [12,  0.84],
  'North Korea': [22,  0.80],
  Ukraine:       [76,  0.62],
  Vietnam:       [15,  0.77],
  Pakistan:      [34,  0.68],
  France:        [92,  0.58],
  'United Kingdom': [95, 0.54],
  Canada:        [255, 0.62],
  Australia:     [160, 0.78],
  Japan:         [10,  0.74],
  Indonesia:     [155, 0.76],
};

function countryToRadarXY(country: string, seed: number): [number, number] {
  const pos = COUNTRY_RADAR[country];
  if (pos) {
    const [angleDeg, dist] = pos;
    const rad = (angleDeg * Math.PI) / 180;
    return [Math.cos(rad) * dist, Math.sin(rad) * dist];
  }
  // unknown country → deterministic position from country string hash
  const hash = country.split('').reduce((a, c) => a + c.charCodeAt(0), seed);
  const angle = (hash * 137.508) % 360;
  const rad = (angle * Math.PI) / 180;
  return [Math.cos(rad) * 0.65, Math.sin(rad) * 0.65];
}

export default function LiveIntelFeedWidget({ attacks, threatScore, metrics, onReport }: LiveIntelFeedWidgetProps) {
  const [blips, setBlips] = useState<Blip[]>([]);

  const threat =
    threatScore >= 7.5 ? { text: 'CRITICAL', color: '#ef4444' } :
    threatScore >= 5   ? { text: 'ELEVATED', color: '#f97316' } :
    threatScore >= 3   ? { text: 'MODERATE', color: '#c084fc' } :
                         { text: 'NOMINAL',  color: '#8b5cf6' };

  /* ── Sync blips from real attacks — geographic positions ── */
  useEffect(() => {
    if (!attacks.length) return;
    setBlips(attacks.slice(-8).map((a, i) => {
      const [x, y] = countryToRadarXY(a.sourceCountry, a.id);
      return {
        id:       String(a.id),
        x, y,
        severity: a.severity,
        age:      Math.min(i * 2, 8),
        type:     a.type.toUpperCase(),
        country:  a.sourceCountry,
      };
    }));
  }, [attacks]);

  /* ── Demo blips when no real data — geographic positions ── */
  useEffect(() => {
    if (attacks.length) return;
    const TYPES     = ['SQL INJECTION','PORT SCAN','DDoS','BRUTE FORCE','RCE ATTEMPT','XSS','MITM'];
    const COUNTRIES = ['Turkey','USA','Russia','China','Netherlands','Germany','Brazil','India','Iran','Singapore'];
    const SEVS: Array<'critical' | 'high' | 'low'> = ['critical','high','low'];
    const iv = setInterval(() => {
      const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
      const seed    = Math.floor(Math.random() * 1000);
      const [x, y]  = countryToRadarXY(country, seed);
      setBlips(prev => [
        ...prev.filter(b => b.age < 9).slice(-9),
        {
          id:       Math.random().toString(36).slice(2),
          x, y,
          severity: SEVS[Math.floor(Math.random() * 3)],
          age:      0,
          type:     TYPES[Math.floor(Math.random() * TYPES.length)],
          country,
        },
      ]);
    }, 1500);
    return () => clearInterval(iv);
  }, [attacks.length]);

  /* ── Age out blips ── */
  useEffect(() => {
    const iv = setInterval(
      () => setBlips(prev => prev.map(b => ({ ...b, age: b.age + 1 })).filter(b => b.age < 10)),
      1000,
    );
    return () => clearInterval(iv);
  }, []);

  const S = 150; const cx = S / 2; const cy = S / 2; const R = S / 2 - 4;

  /* Real metrics for footer */
  const totalBlocked = metrics?.attack.totalLast24h ?? attacks.length;
  const activeIps    = metrics?.attack.activeIps ?? 0;
  const apm          = metrics?.attack.attacksPerMinute ?? 0;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden font-mono text-xs">
      {/* CSS for radar sweep */}
      <style>{`@keyframes rdr-sweep { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div className="flex justify-between items-center px-3 py-1.5 border-b border-violet-500/20 shrink-0">
        <span className="text-violet-400 font-bold tracking-widest">⬡ GHOST RADAR</span>
        <span
          className="font-bold px-2 py-0.5 rounded border animate-pulse text-[10px]"
          style={{ color: threat.color, borderColor: `${threat.color}60`, background: `${threat.color}18` }}
        >
          ◀ {threat.text}
        </span>
      </div>

      {/* ── Radar + Score ── */}
      <div className="flex items-start gap-2 px-2 pt-2 shrink-0">

        {/* Radar SVG */}
        <div className="shrink-0">
          <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
            {/* Background */}
            <circle cx={cx} cy={cy} r={R} fill="#07000f" />

            {/* Concentric rings */}
            {[0.28, 0.52, 0.76, 1].map(f => (
              <circle key={f} cx={cx} cy={cy} r={R * f}
                fill="none" stroke="#8b5cf6" strokeOpacity={0.15} strokeWidth={0.75} />
            ))}

            {/* Cross-hair */}
            <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="#8b5cf6" strokeOpacity={0.12} strokeWidth={0.7} />
            <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="#8b5cf6" strokeOpacity={0.12} strokeWidth={0.7} />
            <line x1={cx - R * 0.72} y1={cy - R * 0.72} x2={cx + R * 0.72} y2={cy + R * 0.72}
              stroke="#8b5cf6" strokeOpacity={0.06} strokeWidth={0.6} />
            <line x1={cx + R * 0.72} y1={cy - R * 0.72} x2={cx - R * 0.72} y2={cy + R * 0.72}
              stroke="#8b5cf6" strokeOpacity={0.06} strokeWidth={0.6} />

            {/* ── Rotating sweep group ── */}
            <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'rdr-sweep 5s linear infinite' }}>
              {/* Trailing sectors (violet → pink leading edge) */}
              {Array.from({ length: TRAIL_STEPS }, (_, i) => {
                const isLead = i === 0;
                return (
                  <path key={i}
                    d={sector(cx, cy, R, -(i + 1) * 20, -i * 20)}
                    fill={isLead ? '#c084fc' : '#8b5cf6'}
                    fillOpacity={Math.max(0.02, 0.24 - i * 0.028)}
                  />
                );
              })}
              {/* Sweep line pointing right (0°) */}
              <line x1={cx} y1={cy} x2={cx + R} y2={cy}
                stroke="#c084fc" strokeWidth={1.6} strokeOpacity={0.95}
                style={{ filter: 'drop-shadow(0 0 5px #c084fc)' }}
              />
            </g>

            {/* Centre dot */}
            <circle cx={cx} cy={cy} r={2.2} fill="#c084fc"
              style={{ filter: 'drop-shadow(0 0 6px #c084fc)' }} />

            {/* Blips */}
            {blips.map(b => {
              const bx    = cx + b.x * R;
              const by    = cy + b.y * R;
              const alpha = Math.max(0.08, 1 - b.age / 10);
              const col   = SEV[b.severity] ?? '#8b5cf6';
              return (
                <g key={b.id}>
                  <circle cx={bx} cy={by} r={4 + b.age * 0.9}
                    fill="none" stroke={col} strokeWidth={0.7} strokeOpacity={alpha * 0.45} />
                  <circle cx={bx} cy={by} r={2.6} fill={col} fillOpacity={alpha}
                    style={{ filter: `drop-shadow(0 0 ${3 + b.age}px ${col})` }} />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Score + LED bar */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="text-[9px] text-slate-500 leading-none mb-1 tracking-widest">GLOBAL THREAT INDEX</div>

          <div
            className="text-[2.4rem] font-black leading-none text-white tabular-nums"
            style={{ textShadow: `0 0 18px ${threat.color}, 0 0 40px ${threat.color}40` }}
          >
            {threatScore.toFixed(1)}
          </div>

          {/* 20-segment LED threat bar */}
          <div className="flex gap-[2px] mt-2">
            {Array.from({ length: 20 }, (_, i) => {
              const t  = ((i + 1) / 20) * 10;
              const on = threatScore >= t - 0.5;
              const col = t <= 3 ? '#8b5cf6' : t <= 5 ? '#c084fc' : t <= 7.5 ? '#f97316' : '#ef4444';
              return (
                <div key={i}
                  className="flex-1 h-[5px] rounded-[1px] transition-all duration-300"
                  style={{ background: on ? col : '#1a0a2e', boxShadow: on ? `0 0 3px ${col}` : 'none' }}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[8px] text-slate-600">0</span>
            <span className="text-[8px] text-slate-600">10</span>
          </div>

          {blips.length > 0 && (
            <div className="mt-1.5 text-[9px] truncate" style={{ color: SEV[blips[blips.length - 1].severity] }}>
              ◀ {blips[blips.length - 1].type} · {blips[blips.length - 1].country}
            </div>
          )}
        </div>
      </div>

      {/* ── Threat log ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-[3px]">
        <div className="text-[9px] text-slate-600 px-0.5 mb-0.5 tracking-wider">▸ NEURAL FEED</div>

        {attacks.length > 0
          ? [...attacks].reverse().slice(0, 5).map(a => {
              const col = SEV[a.severity] ?? '#8b5cf6';
              return (
                <div key={a.id}
                  className="group flex items-center gap-1.5 px-1.5 py-[5px] rounded border border-violet-900/40 bg-[#0a0015]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                    style={{ background: col, boxShadow: `0 0 4px ${col}` }} />
                  <span className="font-bold truncate flex-1" style={{ color: col }}>{a.type.toUpperCase()}</span>
                  <span className="text-slate-500 font-mono shrink-0 tabular-nums">{a.sourceIP}</span>
                  <span className="text-slate-600 shrink-0 w-[22px] text-right">{timeAgo(a.createdAt)}</span>
                  {onReport && (
                    <button
                      onClick={() => onReport(a)}
                      title="Rapor Oluştur"
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-slate-600 hover:text-violet-400 ml-0.5"
                    >
                      📋
                    </button>
                  )}
                </div>
              );
            })
          : [...blips].reverse().slice(0, 5).map(b => {
              const col = SEV[b.severity] ?? '#8b5cf6';
              return (
                <div key={b.id}
                  className="flex items-center gap-1.5 px-1.5 py-[5px] rounded border border-violet-900/40 bg-[#0a0015]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                    style={{ background: col, boxShadow: `0 0 4px ${col}` }} />
                  <span className="font-bold truncate flex-1" style={{ color: col }}>{b.type}</span>
                  <span className="text-slate-500 shrink-0">{b.country}</span>
                  <span className="text-slate-600 shrink-0 w-[22px] text-right">{b.age}s</span>
                </div>
              );
            })
        }
      </div>

      {/* ── Footer stats ── */}
      <div className="shrink-0 flex items-center justify-center gap-2 border-t border-violet-500/15 py-1.5 px-2">
        {[
          ['TOTAL 24H', String(totalBlocked),  '#22d3ee'],
          ['AKTİF IP',  String(activeIps),     '#22d3ee'],
          ['ATK/MIN',   String(apm),            '#8b5cf6'],
        ].map(([label, value, col]) => (
          <span key={label} className="text-[10px] text-slate-400 border border-violet-900/40 px-2 py-0.5 rounded whitespace-nowrap">
            {label}: <span className="font-bold" style={{ color: col }}>{value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
