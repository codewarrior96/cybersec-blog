'use client';
import React from 'react';
import type { WorkflowMetrics } from '@/lib/dashboard-types';

interface SocTriageWidgetProps {
  metrics: WorkflowMetrics | null;
}

/** SVG arc gauge — 270° sweep, shows a time/value metric */
function SlaArc({
  pct, color, label, value,
}: {
  pct: number; color: string; label: string; value: string;
}) {
  const size = 54, cx = size / 2, cy = size / 2, r = 18, thick = 3.2;
  const START = 135, TOTAL = 270;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const ap = (s: number, sweep: number) => {
    const x1 = cx + r * Math.cos(toRad(s));
    const y1 = cy + r * Math.sin(toRad(s));
    const x2 = cx + r * Math.cos(toRad(s + sweep));
    const y2 = cy + r * Math.sin(toRad(s + sweep));
    const lg = Math.abs(sweep) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2}`;
  };
  const fillDeg = Math.max(1, pct * TOTAL);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <path d={ap(START, TOTAL)} fill="none" stroke="#1a0a2e" strokeWidth={thick} strokeLinecap="round" />
        {/* Fill */}
        <path d={ap(START, fillDeg)} fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
        {/* Value */}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="9" fontWeight="900" fontFamily="monospace">{value}</text>
        <text x={cx} y={cy + 10} textAnchor="middle"
          fill="#475569" fontSize="7" fontFamily="monospace">min</text>
      </svg>
      <span className="text-[8px] text-slate-500 tracking-wider text-center leading-tight">{label}</span>
    </div>
  );
}

const TRIAGE_COLS = [
  { key: 'new',        label: 'NEW',      color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
  { key: 'inProgress', label: 'IN PROG',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)' },
  { key: 'blocked',    label: 'BLOCKED',  color: '#ef4444', bg: 'rgba(239,68,68,0.06)'  },
  { key: 'resolved',   label: 'RESOLVED', color: '#22c55e', bg: 'rgba(34,197,94,0.06)'  },
] as const;

export default function SocTriageWidget({ metrics }: SocTriageWidgetProps) {
  const triage  = metrics?.triageBoard  ?? { new: 0, inProgress: 0, blocked: 0, resolved: 0 };
  const shift   = metrics?.shiftSnapshot ?? { openCritical: 0, unassigned: 0, slaBreaches: 0 };
  const sla     = metrics?.sla           ?? { p1FirstResponseMinutes: 0, avgResolutionMinutes: 0, breachCount: 0 };

  const total   = triage.new + triage.inProgress + triage.blocked + triage.resolved;

  /* Arc percents — how "bad" (full = threshold) */
  const p1Pct  = Math.min(1, sla.p1FirstResponseMinutes  / 60);   // 60 min = red
  const avgPct = Math.min(1, sla.avgResolutionMinutes     / 480);  // 8 h  = red

  const p1Color  = p1Pct  > 0.8 ? '#ef4444' : p1Pct  > 0.5 ? '#f97316' : '#22c55e';
  const avgColor = avgPct > 0.8 ? '#ef4444' : avgPct > 0.5 ? '#f97316' : '#8b5cf6';

  /* Shift snapshot bar max */
  const shiftMax = Math.max(shift.openCritical, shift.unassigned, shift.slaBreaches, 1);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden font-mono text-xs">

      {/* ── Header ── */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-violet-500/20 shrink-0">
        <span className="text-violet-400 font-bold tracking-widest uppercase">⬡ SOC TRIAGE</span>
        <span className="text-[10px] text-slate-500">
          TOTAL: <span className="font-bold text-violet-400">{total}</span>
        </span>
      </div>

      {/* ── Triage board columns ── */}
      <div className="flex gap-1.5 px-2 pt-2 shrink-0">
        {TRIAGE_COLS.map(col => {
          const val = triage[col.key];
          return (
            <div
              key={col.key}
              className="flex-1 flex flex-col items-center gap-0.5 rounded border py-2"
              style={{
                borderColor: `${col.color}30`,
                background: col.bg,
              }}
            >
              <span className="text-[8px] tracking-widest" style={{ color: `${col.color}99` }}>
                {col.label}
              </span>
              <span
                className="text-[1.6rem] font-black tabular-nums leading-none"
                style={{
                  color: col.color,
                  textShadow: `0 0 14px ${col.color}55`,
                }}
              >
                {val}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── SLA Metrics ── */}
      <div className="mx-2 mt-1.5 rounded border border-violet-900/30 bg-[#0a0015] px-2 py-1.5 shrink-0">
        <div className="text-[9px] text-slate-600 tracking-widest mb-1">▸ SLA METRICS</div>
        <div className="flex items-center justify-around">
          <SlaArc
            pct={p1Pct}
            color={p1Color}
            label="P1 RESPONSE"
            value={sla.p1FirstResponseMinutes > 0 ? String(sla.p1FirstResponseMinutes) : '—'}
          />
          <SlaArc
            pct={avgPct}
            color={avgColor}
            label="AVG RESOLVE"
            value={sla.avgResolutionMinutes > 0 ? String(sla.avgResolutionMinutes) : '—'}
          />
          {/* Breach counter */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[8px] text-slate-600 tracking-widest">BREACHES</span>
            <span
              className="text-[2rem] font-black tabular-nums leading-none"
              style={{
                color: sla.breachCount > 0 ? '#ef4444' : '#22c55e',
                textShadow: sla.breachCount > 0 ? '0 0 14px rgba(239,68,68,0.55)' : 'none',
              }}
            >
              {sla.breachCount}
            </span>
            <span className="text-[7px] text-slate-600 tracking-widest">SLA</span>
          </div>
        </div>
      </div>

      {/* ── Shift Snapshot ── */}
      <div className="flex-1 min-h-0 mx-2 mt-1.5 mb-2 rounded border border-violet-900/30 bg-[#0a0015] px-3 py-2 overflow-hidden">
        <div className="text-[9px] text-slate-600 tracking-widest mb-2">▸ SHIFT SNAPSHOT</div>
        <div className="flex flex-col gap-2">
          {([
            {
              label: 'OPEN CRITICAL',
              val:   shift.openCritical,
              col:   shift.openCritical > 0 ? '#ef4444' : '#22c55e',
            },
            {
              label: 'UNASSIGNED',
              val:   shift.unassigned,
              col:   shift.unassigned > 3 ? '#f59e0b' : '#8b5cf6',
            },
            {
              label: 'SLA BREACHES',
              val:   shift.slaBreaches,
              col:   shift.slaBreaches > 0 ? '#ef4444' : '#22c55e',
            },
          ] as { label: string; val: number; col: string }[]).map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500 tracking-wider w-[90px] shrink-0">{item.label}</span>
              <div className="flex-1 h-[4px] bg-[#0d0018] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width:      `${Math.min(100, (item.val / shiftMax) * 100)}%`,
                    background: item.col,
                    boxShadow:  `0 0 4px ${item.col}60`,
                  }}
                />
              </div>
              <span
                className="text-[11px] font-bold w-[20px] text-right tabular-nums shrink-0"
                style={{ color: item.col }}
              >{item.val}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
