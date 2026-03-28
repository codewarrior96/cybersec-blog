'use client';
import React, { useState, useEffect, useRef } from 'react';
import type { WorkflowMetrics } from '@/lib/dashboard-types';

interface SystemMonitorWidgetProps {
  metrics: WorkflowMetrics | null;
}

/* ── Arc path helper ─────────────────────────────────────────────── */
function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const endDeg = startDeg + sweepDeg;
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = Math.abs(sweepDeg) > 180 ? 1 : 0;
  const sweep = sweepDeg >= 0 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

/* ── 270° arc gauge ──────────────────────────────────────────────── */
function ArcGauge({
  percent, size = 88, color = '#8b5cf6', label = '', value = '', thick = 7,
}: {
  percent: number; size?: number; color?: string;
  label?: string; value?: string; thick?: number;
}) {
  const cx = size / 2, cy = size / 2;
  const r  = size / 2 - thick / 2 - 2;
  const START = 135, TOTAL = 270;
  const fill    = Math.max(0, Math.min(100, percent));
  const fillDeg = (fill / 100) * TOTAL;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={arcPath(cx, cy, r, START, TOTAL)}
        fill="none" stroke="#1a0a2e" strokeWidth={thick} strokeLinecap="round" />
      {fillDeg > 0.5 && (
        <path d={arcPath(cx, cy, r, START, fillDeg)}
          fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 ${thick * 0.6}px ${color})`, transition: 'all 1s ease' }} />
      )}
      <text x={cx} y={cy + 3} textAnchor="middle"
        fill="white" fontSize={size * 0.2} fontWeight="900" fontFamily="monospace">
        {value}
      </text>
      {label && (
        <text x={cx} y={cy + size * 0.18} textAnchor="middle"
          fill="#64748b" fontSize={size * 0.1} fontFamily="monospace">
          {label}
        </text>
      )}
    </svg>
  );
}

/* ── Sparkline ───────────────────────────────────────────────────── */
function Sparkline({ points, color = '#8b5cf6', height = 32 }: {
  points: number[]; color?: string; height?: number;
}) {
  if (points.length < 2) return null;
  const w = 100;
  const max = Math.max(...points, 1);
  const step = w / (points.length - 1);
  const pts = points
    .map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`)
    .join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spk-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${pts} ${w},${height}`}
        fill="url(#spk-fill)"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
      {/* Latest dot */}
      {points.length > 0 && (() => {
        const last = points[points.length - 1];
        const lx   = (points.length - 1) * step;
        const ly   = height - (last / max) * (height - 4) - 2;
        return (
          <circle cx={lx} cy={ly} r="2.5" fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        );
      })()}
    </svg>
  );
}

/* ── Bar row ─────────────────────────────────────────────────────── */
function BarRow({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-slate-500 w-[60px] truncate shrink-0">{label}</span>
      <div className="flex-1 h-[5px] rounded-full" style={{ background: '#1a0a2e' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 4px ${color}` }} />
      </div>
      <span className="text-[9px] tabular-nums w-[18px] text-right" style={{ color }}>{value}</span>
    </div>
  );
}

/* ── Main widget ─────────────────────────────────────────────────── */
const SPARKLINE_MAX = 24;

const TAG_COLORS = [
  '#8b5cf6', '#c084fc', '#f97316', '#22d3ee', '#f59e0b', '#ef4444',
];

export default function SystemMonitorWidget({ metrics }: SystemMonitorWidgetProps) {
  const apmHistory = useRef<number[]>([]);
  const [history, setHistory] = useState<number[]>([]);

  /* Push new APM reading into rolling window */
  useEffect(() => {
    const apm = metrics?.attack.attacksPerMinute ?? 0;
    apmHistory.current = [...apmHistory.current.slice(-(SPARKLINE_MAX - 1)), apm];
    setHistory([...apmHistory.current]);
  }, [metrics]);

  const apm        = metrics?.attack.attacksPerMinute ?? 0;
  const activeIps  = metrics?.attack.activeIps ?? 0;
  const total24h   = metrics?.attack.totalLast24h ?? 0;
  const density    = metrics?.attack.liveDensity ?? 0;
  const countries  = metrics?.attack.topCountries ?? [];
  const tags       = metrics?.attack.topTags ?? [];
  const openCrit   = metrics?.shiftSnapshot.openCritical ?? 0;
  const slaBreaches= metrics?.shiftSnapshot.slaBreaches ?? 0;
  const unassigned = metrics?.shiftSnapshot.unassigned ?? 0;

  /* APM gauge: 0–120 apm → 0–100% */
  const apmPct  = Math.min(100, (apm / 120) * 100);
  const apmColor = apm >= 80 ? '#ef4444' : apm >= 40 ? '#f97316' : '#8b5cf6';

  const maxCountry = Math.max(...countries.map(c => c.count), 1);
  const maxTag     = Math.max(...tags.map(t => t.count), 1);

  const STATUS = [
    { label: 'OPEN CRIT', value: String(openCrit),   color: openCrit > 5 ? '#ef4444' : '#8b5cf6' },
    { label: 'SLA BREACH', value: String(slaBreaches), color: slaBreaches > 10 ? '#f97316' : '#8b5cf6' },
    { label: 'UNASSIGNED', value: String(unassigned),  color: unassigned > 20 ? '#f59e0b' : '#8b5cf6' },
    { label: 'DENSITY',    value: `${density}%`,       color: '#22d3ee' },
  ];

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden font-mono text-xs">

      {/* ── Header ── */}
      <div className="flex justify-between items-center px-3 py-1.5 border-b border-violet-500/20 shrink-0">
        <span className="text-violet-400 font-bold tracking-widest">⬡ NEURAL CORTEX</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
          <span className="text-[10px] text-violet-400 font-bold">LIVE</span>
          <span className="text-[10px] text-slate-500">· REAL DATA</span>
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 space-y-2.5">

        {/* ── APM Gauge + Sparkline ── */}
        <div className="flex items-center gap-2">
          <div className="shrink-0">
            <ArcGauge
              percent={apmPct}
              size={82}
              color={apmColor}
              value={String(apm)}
              label="ATK/MIN"
              thick={7}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-slate-500">SALDIRI YOĞUNLUĞU</span>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: apmColor }}>
                {apm} apm
              </span>
            </div>
            <div className="rounded overflow-hidden" style={{ background: '#0a0018' }}>
              <Sparkline points={history} color={apmColor} height={36} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[8px] text-slate-700">-{SPARKLINE_MAX} ölçüm</span>
              <span className="text-[8px] text-slate-700">ŞİMDİ</span>
            </div>
          </div>
        </div>

        {/* ── Top Countries ── */}
        {countries.length > 0 && (
          <div className="bg-[#0a0018] rounded-lg border border-violet-500/15 p-2 space-y-1.5">
            <div className="text-[9px] text-slate-500 tracking-wider font-bold mb-1.5">
              TOP KAYNAK ÜLKELER
            </div>
            {countries.slice(0, 5).map((c, i) => (
              <BarRow
                key={c.name}
                label={c.name}
                value={c.count}
                max={maxCountry}
                color={i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#8b5cf6'}
              />
            ))}
          </div>
        )}

        {/* ── Top Attack Tags ── */}
        {tags.length > 0 && (
          <div className="bg-[#0a0018] rounded-lg border border-violet-500/15 p-2">
            <div className="text-[9px] text-slate-500 tracking-wider font-bold mb-1.5">
              TOP SALDIRI VEKTÖRLERİ
            </div>
            <div className="space-y-1">
              {tags.slice(0, 5).map((t, i) => (
                <BarRow
                  key={t.name}
                  label={t.name}
                  value={t.count}
                  max={maxTag}
                  color={TAG_COLORS[i % TAG_COLORS.length]}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── 24h Summary ── */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'TOTAL 24H', value: total24h, color: '#c084fc' },
            { label: 'AKTİF IP',  value: activeIps, color: '#22d3ee' },
          ].map(s => (
            <div key={s.label}
              className="rounded border border-violet-500/15 bg-[#0a0018] px-2 py-1.5 text-center">
              <div className="text-base font-black tabular-nums leading-none"
                style={{ color: s.color, textShadow: `0 0 12px ${s.color}60` }}>
                {s.value}
              </div>
              <div className="text-[8px] text-slate-600 tracking-wider mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Demo placeholder when no data */}
        {!metrics && (
          <div className="text-center py-4 text-slate-700 text-[10px] animate-pulse">
            Metrik bekleniyor...
          </div>
        )}
      </div>

      {/* ── Status footer ── */}
      <div className="shrink-0 grid grid-cols-4 border-t border-violet-500/15">
        {STATUS.map((s, i) => (
          <div key={i}
            className={`flex flex-col items-center justify-center py-1.5 ${i < 3 ? 'border-r border-violet-500/10' : ''}`}>
            <span className="text-[8px] text-slate-600 tracking-wider">{s.label}</span>
            <span className="text-[11px] font-black tabular-nums"
              style={{ color: s.color, textShadow: `0 0 8px ${s.color}` }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
