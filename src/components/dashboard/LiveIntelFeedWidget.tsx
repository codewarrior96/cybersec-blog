'use client';
import React from 'react';
import { Skull, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';
import type { AttackEvent } from '@/lib/dashboard-types';

interface LiveIntelFeedWidgetProps {
  attacks: AttackEvent[];
  threatScore: number;
}

const severityConfig = {
  critical: { label: 'CRITICAL', border: 'border-l-red-500', bg: 'bg-red-500/8', text: 'text-red-400', badge: 'bg-red-500/20 border-red-500/60 text-red-400', Icon: Skull, defaultType: 'RANSOMWARE WAVE' },
  high:     { label: 'HIGH',     border: 'border-l-orange-500', bg: 'bg-orange-500/8', text: 'text-orange-400', badge: 'bg-orange-500/20 border-orange-500/60 text-orange-400', Icon: AlertTriangle, defaultType: 'DDoS AMPLIFICATION' },
  low:      { label: 'LOW',      border: 'border-l-green-500', bg: 'bg-green-500/8', text: 'text-green-400', badge: 'bg-green-500/20 border-green-500/60 text-green-400', Icon: CheckCircle, defaultType: 'PORT SCAN' },
};

const amberConfig = { label: 'AMBER', border: 'border-l-yellow-500', bg: 'bg-yellow-500/8', text: 'text-yellow-400', badge: 'bg-yellow-500/20 border-yellow-500/60 text-yellow-400', Icon: ShieldAlert };

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `00:00:${String(s).padStart(2, '0')} ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `00:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')} ago`;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')} ago`;
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
  const totalBlocked = 1247 + attacks.length * 3;

  // Build cards — real attacks + static examples
  const staticCards = [
    { severity: 'critical' as const, type: 'RANSOMWARE WAVE', ip: '203.45.112.7', target: 'TARGET', country: 'RU/Moscow', time: '00:02:14 ago', detail: 'VIEW 460 ↗' },
    { severity: 'high' as const, type: 'DDoS AMPLIFICATION', ip: '', target: '', country: '', time: '00:08:33 ago', detail: 'BANDWIDTH' },
    { severity: 'amber' as const, type: 'CREDENTIAL STUFFING', ip: '', target: '', country: 'Tor Exit Node', time: '00:12:18 ago', detail: 'Source:' },
    { severity: 'safe' as const, type: 'THREAT NEUTRALIZED', ip: '', target: '', country: '', time: '00:01:05 ago', detail: 'Firewall rule #447 applied' },
  ];

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-cyan-500/15 bg-[#0a1020]/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">// LIVE INTEL FEED</span>
        </div>
        <span className="text-slate-600 text-[9px]">⋮</span>
      </div>

      {/* Threat Index */}
      <div className="px-3 py-2.5 border-b border-cyan-500/10 shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="text-[9px] text-slate-500 leading-tight">GLOBAL<br/>THREAT INDEX</div>
          <span className="text-3xl font-black text-white tabular-nums tracking-tight" style={{ textShadow: `0 0 24px ${threat.color}` }}>
            {threatScore.toFixed(1)}
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded border animate-pulse" 
            style={{ color: threat.color, borderColor: threat.color + '80', backgroundColor: threat.color + '15' }}>
            ◀ {threat.text}
          </span>
        </div>
        {/* Gradient bar with needle */}
        <div className="w-full h-2.5 rounded-full bg-[#1a1a2e] relative overflow-hidden">
          <div className="absolute inset-0 rounded-full" 
            style={{ background: 'linear-gradient(90deg, #00ff41 0%, #22d3ee 20%, #f59e0b 50%, #ef4444 80%, #dc2626 100%)' }} />
          <div className="absolute top-0 right-0 bottom-0 bg-[#1a1a2e]/85 rounded-r-full transition-all duration-500"
            style={{ width: `${100 - barPercent}%` }} />
          {/* Needle */}
          <div className="absolute top-[-3px] w-[3px] h-[16px] bg-white shadow-[0_0_8px_#fff,0_0_16px_#fff] rounded-full transition-all duration-500"
            style={{ left: `calc(${barPercent}% - 1px)` }} />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-slate-600">0</span>
          <span className="text-[7px] text-slate-500 tracking-widest">GLOBAL THREAT INDEX | REAL-TIME</span>
          <span className="text-[8px] text-slate-600">10</span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-900/30 scrollbar-track-transparent">
        
        {/* Real attacks from API */}
        {attacks.slice().reverse().slice(0, 4).map((attack, i) => {
          const config = severityConfig[attack.severity] || severityConfig.low;
          const IconComp = config.Icon;
          return (
            <div key={`real-${attack.id}-${i}`}
              className={`rounded border-l-[3px] ${config.border} ${config.bg} border border-slate-700/30 px-2.5 py-2`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${config.badge}`}>{config.label}</span>
                <span className="text-[8px] text-slate-500">{timeAgo(attack.createdAt)}</span>
              </div>
              <div className="flex items-start gap-2">
                <IconComp className={`w-4 h-4 ${config.text} shrink-0 mt-0.5`} />
                <div className="min-w-0">
                  <div className={`text-[10px] font-bold ${config.text}`}>{attack.type.toUpperCase()}</div>
                  <div className="text-[9px] text-slate-400 font-mono">IP: {attack.sourceIP} → {attack.targetPort > 0 ? `:${attack.targetPort}` : 'TARGET'}</div>
                </div>
                <span className="text-[8px] text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded shrink-0 ml-auto">{attack.sourceCountry}</span>
              </div>
            </div>
          );
        })}

        {/* Static example cards when no real attacks */}
        {attacks.length === 0 && staticCards.map((card, i) => {
          const isSafe = card.severity === 'safe';
          const isAmber = card.severity === 'amber';
          const config = isSafe ? { ...severityConfig.low, label: 'SAFE' } : isAmber ? amberConfig : severityConfig[card.severity as 'critical' | 'high'];
          const IconComp = isSafe ? CheckCircle : config.Icon;
          const colorClass = isSafe ? 'text-green-400' : isAmber ? 'text-yellow-400' : config.text;
          const badgeClass = isSafe ? 'bg-green-500/20 border-green-500/60 text-green-400' : isAmber ? amberConfig.badge : config.badge;
          const borderClass = isSafe ? 'border-l-green-500' : isAmber ? 'border-l-yellow-500' : config.border;
          const bgClass = isSafe ? 'bg-green-500/8' : isAmber ? 'bg-yellow-500/8' : config.bg;

          return (
            <div key={`static-${i}`}
              className={`rounded border-l-[3px] ${borderClass} ${bgClass} border border-slate-700/30 px-2.5 py-2`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${badgeClass}`}>
                  {isSafe ? '● SAFE' : isAmber ? '● AMBER' : `● ${config.label}`}
                </span>
                <span className="text-[8px] text-slate-500">{card.time}</span>
              </div>
              <div className="flex items-start gap-2">
                <IconComp className={`w-4 h-4 ${colorClass} shrink-0 mt-0.5`} />
                <div className="min-w-0">
                  <div className={`text-[10px] font-bold ${colorClass}`}>{card.type}</div>
                  {card.ip && <div className="text-[9px] text-slate-400 font-mono">IP: {card.ip} → {card.target}</div>}
                  {card.detail && <div className="text-[8px] text-slate-500 mt-0.5 italic">{card.detail}</div>}
                </div>
                {card.country && <span className="text-[8px] text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded shrink-0 ml-auto">{card.country}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Stats */}
      <div className="shrink-0 flex items-center justify-center gap-4 border-t border-cyan-500/15 bg-[#0a1020]/80 py-1.5 px-3">
        <span className="text-[8px] text-slate-400 border border-slate-700/50 px-2 py-0.5 rounded">BLOCKED: <span className="text-cyan-400 font-bold">{totalBlocked.toLocaleString()}</span></span>
        <span className="text-[8px] text-slate-400 border border-slate-700/50 px-2 py-0.5 rounded">SCANS: <span className="text-cyan-400 font-bold">89</span></span>
        <span className="text-[8px] text-slate-400 border border-slate-700/50 px-2 py-0.5 rounded">UPTIME: <span className="text-green-400 font-bold">99.97%</span></span>
      </div>
    </div>
  );
}
