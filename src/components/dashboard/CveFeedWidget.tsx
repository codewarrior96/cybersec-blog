'use client';
import React from 'react';
import type { CVEItem } from '@/lib/dashboard-types';

const mockData = [
  { severity: 'CRITICAL', score: '9.8', id: 'CVE I3.158.724', system: 'AFFECTED SYSTEM' },
  { severity: 'HIGH', score: '8.5', id: 'CVE 207.2787', system: 'AFFECTED SYSTEM' },
  { severity: 'HIGH', score: '7.4', id: 'CVE I5.209233', system: 'AFFECTED SYSTEM' },
  { severity: 'MEDIUM', score: '6.5', id: 'CVE I6.23.269', system: 'AFFECTED SYSTEM' },
  { severity: 'MEDIUM', score: '5.8', id: 'CVE IP.33.8473', system: 'AFFECTED SYSTEM' },
  { severity: 'LOW', score: '3.2', id: 'CVE 12.0941', system: 'AFFECTED SYSTEM' },
];

function getSeverityStyle(sev: string) {
  switch (sev) {
    case 'CRITICAL': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/60' };
    case 'HIGH': return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/60' };
    case 'MEDIUM': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/60' };
    case 'LOW': return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/60' };
    default: return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/60' };
  }
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
    return { severity, score: score.toFixed(1), id: item.id, system: item.description?.slice(0, 20) || 'AFFECTED SYSTEM' };
  }) : mockData;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-cyan-500/15 bg-var(--bg-panel)/80 shrink-0">
        <span className="text-[var(--text-title)] font-bold text-slate-300 tracking-widest uppercase">// CVE FEED</span>
        <span className="text-slate-600 text-[var(--text-body)]">⋮</span>
      </div>

      {/* Compact CVE list — right column style */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-900/30 scrollbar-track-transparent" style={{ WebkitOverflowScrolling: 'touch' }}>
        {rows.map((row, idx) => {
          const style = getSeverityStyle(row.severity);
          return (
            <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded border border-slate-700/30 bg-slate-900/30 hover:bg-slate-800/30 transition-colors touch-target min-w-0">
              {/* Severity badge */}
              <span className={`text-[var(--text-body)] font-bold px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border} shrink-0 w-[60px] text-center`}>
                {row.severity}
              </span>
              {/* CVSS Score */}
              <span className="text-[var(--text-body)] text-slate-300 font-bold shrink-0 w-[40px]">
                CVSS: <span className={style.text}>{row.score}</span>
              </span>
              {/* CVE ID + system */}
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <span className="text-[var(--text-body)] text-slate-200 font-mono truncate block">{row.id}</span>
                <span className="text-[var(--text-body)] text-slate-500 truncate block text-[0.85em]">{row.system}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
