'use client';
import React from 'react';
import type { AttackEvent } from '@/lib/dashboard-types';

interface LiveIntelFeedWidgetProps {
  attacks: AttackEvent[];
  threatScore: number;
}

const severityConfig = {
  critical: { label: 'CRITICAL', border: 'border-l-red-500', bg: 'bg-red-500/5', text: 'text-red-400', badge: 'bg-red-500/20 border-red-500/60 text-red-400' },
  high:     { label: 'HIGH',     border: 'border-l-orange-500', bg: 'bg-orange-500/5', text: 'text-orange-400', badge: 'bg-orange-500/20 border-orange-500/60 text-orange-400' },
  low:      { label: 'LOW',      border: 'border-l-green-500', bg: 'bg-green-500/5', text: 'text-green-400', badge: 'bg-green-500/20 border-green-500/60 text-green-400' },
};

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  } catch { return 'just now'; }
}

export default function LiveIntelFeedWidget({ attacks, threatScore }: LiveIntelFeedWidgetProps) {
  const getThreatLabel = (score: number) => {
    if (score < 3) return { text: 'LOW', color: '#00ff41' };
    if (score < 5) return { text: 'MODERATE', color: '#22d3ee' };
    if (score < 7.5) return { text: 'ELEVATED', color: '#f59e0b' };
    return { text: 'CRITICAL', color: '#ef4444' };
  };

  const threat = getThreatLabel(threatScore);
  const barPercent = Math.min(100, Math.max(0, (threatScore / 10) * 100));

  // Calculate stats
  const criticalCount = attacks.filter(a => a.severity === 'critical').length;
  const highCount = attacks.filter(a => a.severity === 'high').length;
  const totalBlocked = 1247 + attacks.length * 3;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-cyan-500/15 bg-[#0a1020]/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">// LIVE INTEL FEED</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[8px] text-red-400 font-bold">LIVE</span>
          </span>
        </div>
        <span className="text-slate-600 text-[9px]">⋮</span>
      </div>

      {/* Threat Index Bar */}
      <div className="px-3 py-3 border-b border-cyan-500/10 shrink-0">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-black text-white tabular-nums" style={{ textShadow: `0 0 20px ${threat.color}` }}>
            {threatScore.toFixed(1)}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border" 
            style={{ color: threat.color, borderColor: threat.color + '80', backgroundColor: threat.color + '15' }}>
            {threat.text}
          </span>
        </div>
        {/* Gradient bar */}
        <div className="w-full h-2 rounded-full bg-[#1a1a2e] relative overflow-hidden">
          <div className="absolute inset-0 rounded-full" 
            style={{ background: 'linear-gradient(90deg, #00ff41 0%, #22d3ee 25%, #f59e0b 55%, #ef4444 85%, #dc2626 100%)' }} />
          <div className="absolute top-0 right-0 bottom-0 bg-[#1a1a2e]/80 rounded-r-full transition-all duration-500"
            style={{ width: `${100 - barPercent}%` }} />
          {/* Needle */}
          <div className="absolute top-[-2px] w-[2px] h-[12px] bg-white shadow-[0_0_6px_#fff] rounded-full transition-all duration-500"
            style={{ left: `${barPercent}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-slate-600">0</span>
          <span className="text-[8px] text-slate-500">GLOBAL THREAT INDEX</span>
          <span className="text-[8px] text-slate-600">10</span>
        </div>
      </div>

      {/* Attack Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-900/30 scrollbar-track-transparent">
        {attacks.length === 0 && (
          <div className="flex items-center justify-center h-full text-[10px] text-slate-600">
            Scanning for threats...
          </div>
        )}
        {attacks.slice().reverse().map((attack, i) => {
          const config = severityConfig[attack.severity] || severityConfig.low;
          return (
            <div key={attack.id + '-' + i}
              className={`rounded border-l-[3px] ${config.border} ${config.bg} border border-slate-700/30 px-2.5 py-2 transition-all hover:border-slate-600/50`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${config.badge}`}>
                  {config.label}
                </span>
                <span className="text-[8px] text-slate-500">{timeAgo(attack.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-[10px] font-bold ${config.text}`}>{attack.type.toUpperCase()}</div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">{attack.sourceIP} → :{attack.targetPort}</div>
                </div>
                <span className="text-[9px] text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">{attack.sourceCountry}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Stats */}
      <div className="shrink-0 grid grid-cols-3 border-t border-cyan-500/15 bg-[#0a1020]/80">
        <div className="flex flex-col items-center py-1.5 border-r border-cyan-500/10">
          <span className="text-[8px] text-slate-500">BLOCKED</span>
          <span className="text-[11px] font-bold text-cyan-400">{totalBlocked.toLocaleString()}</span>
        </div>
        <div className="flex flex-col items-center py-1.5 border-r border-cyan-500/10">
          <span className="text-[8px] text-slate-500">CRITICAL</span>
          <span className="text-[11px] font-bold text-red-400">{criticalCount}</span>
        </div>
        <div className="flex flex-col items-center py-1.5">
          <span className="text-[8px] text-slate-500">UPTIME</span>
          <span className="text-[11px] font-bold text-green-400">99.97%</span>
        </div>
      </div>
    </div>
  );
}
