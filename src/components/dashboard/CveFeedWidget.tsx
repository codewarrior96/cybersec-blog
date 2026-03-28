'use client';
import React from 'react';
import type { CVEItem } from '@/lib/dashboard-types';

const mockData = [
  { severity: 'CRITICAL', score: '9.8', id: 'CVE-2026-13158',  system: 'Remote Code Exec' },
  { severity: 'HIGH',     score: '8.5', id: 'CVE-2026-20778',  system: 'Privilege Escalation' },
  { severity: 'HIGH',     score: '7.4', id: 'CVE-2025-09233',  system: 'Auth Bypass' },
  { severity: 'MEDIUM',   score: '6.5', id: 'CVE-2026-23269',  system: 'XSS Injection' },
  { severity: 'MEDIUM',   score: '5.8', id: 'CVE-2025-33847',  system: 'Info Disclosure' },
  { severity: 'LOW',      score: '3.2', id: 'CVE-2025-12094',  system: 'DoS Vector' },
];

function getSeverityStyle(sev: string) {
  switch (sev) {
    case 'CRITICAL': return { text: 'text-red-400',    border: 'border-l-red-500',    badge: 'bg-red-500/15 text-red-400 border-red-500/50' };
    case 'HIGH':     return { text: 'text-orange-400', border: 'border-l-orange-500', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/50' };
    case 'MEDIUM':   return { text: 'text-yellow-400', border: 'border-l-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/50' };
    case 'LOW':      return { text: 'text-slate-400',  border: 'border-l-slate-500',  badge: 'bg-slate-500/15 text-slate-400 border-slate-500/50' };
    default:         return { text: 'text-slate-400',  border: 'border-l-slate-600',  badge: 'bg-slate-500/15 text-slate-400 border-slate-500/50' };
  }
}

/** Mini SVG arc gauge for CVSS score (0–10) */
function CvssArc({ score, color }: { score: number; color: string }) {
  const size = 34, cx = size / 2, cy = size / 2, r = 12, thick = 3;
  const pct = score / 10;
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
  const fillDeg = pct * TOTAL;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <path d={ap(START, TOTAL)} fill="none" stroke="#1a0a2e" strokeWidth={thick} strokeLinecap="round" />
      {fillDeg > 0.5 && (
        <path d={ap(START, fillDeg)} fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 2px ${color})` }} />
      )}
      <text x={cx} y={cy + 3.5} textAnchor="middle" fill={color}
        fontSize="8" fontWeight="900" fontFamily="monospace">
        {score}
      </text>
    </svg>
  );
}

interface CveFeedWidgetProps {
  cves?: CVEItem[];
}

export default function CveFeedWidget({ cves = [] }: CveFeedWidgetProps) {
  const rows = cves.length > 0 ? cves.map(item => {
    const score = item.score ?? 5.0;
    let severity = 'MEDIUM';
    if (score >= 9.0) severity = 'CRITICAL';
    else if (score >= 7.0) severity = 'HIGH';
    else if (score < 4.0) severity = 'LOW';
    return { severity, score: +score.toFixed(1), id: item.id, system: item.description?.slice(0, 20) || 'AFFECTED SYSTEM' };
  }) : mockData.map(r => ({ ...r, score: +r.score }));

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden font-mono">

      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-violet-500/20 shrink-0">
        <span className="text-[var(--text-title)] font-bold text-violet-400 tracking-widest uppercase">⬡ VULN STREAM</span>
        <span className="text-slate-600 text-[var(--text-body)]">⋮</span>
      </div>

      {/* CVE list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-1.5" style={{ WebkitOverflowScrolling: 'touch' }}>
        {rows.map((row, idx) => {
          const style = getSeverityStyle(row.severity);
          const arcColor = row.severity === 'CRITICAL' ? '#ef4444'
            : row.severity === 'HIGH' ? '#f97316'
            : row.severity === 'MEDIUM' ? '#eab308'
            : '#64748b';
          return (
            <div
              key={idx}
              className={`flex items-center gap-2 px-2 py-1.5 rounded border-l-[3px] ${style.border} border border-violet-900/30 bg-[#0a0015] hover:bg-violet-900/15 transition-colors`}
            >
              {/* CVSS mini arc */}
              <CvssArc score={row.score} color={arcColor} />

              {/* Severity badge */}
              <span className={`text-[var(--text-body)] font-bold px-1.5 py-0.5 rounded border ${style.badge} shrink-0 hidden sm:block`}
                style={{ fontSize: 9 }}>
                {row.severity}
              </span>

              {/* CVE ID + system */}
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <span className="text-[var(--text-body)] text-slate-200 font-mono truncate block">{row.id}</span>
                <span className={`text-[0.85em] truncate block ${style.text}`}>{row.system}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
