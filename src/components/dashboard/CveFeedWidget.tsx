'use client';
import React from 'react';
import type { CVEItem } from '@/lib/dashboard-types';

const mockData = [
  { level: 'CRITICAL', id: '1456', status: 'GLOWING', host: 'CVE-2023-1456', desc: 'RED', score: '9.8', time: '14:02:11', color: 'text-red-500', border: 'border-red-500/50', shadow: 'shadow-[inset_4px_0_0_rgba(239,68,68,1)]', pill: 'border-red-500/80 text-red-500 bg-red-500/10' },
  { level: 'HIGH', id: '1082', status: 'GLOWING', host: 'CVE-2024-0987', desc: 'BADGE', score: '8.5', time: '14:00:05', color: 'text-orange-400', border: 'border-orange-500/50', shadow: 'shadow-[inset_4px_0_0_rgba(251,146,60,1)]', pill: 'border-orange-500/80 text-orange-400 bg-orange-400/10' },
  { level: 'MEDIUM', id: '932', status: 'YELLOW', host: 'CVE-2022-3112', desc: 'YELLOW', score: '6.1', time: '13:58:30', color: 'text-yellow-400', border: 'border-yellow-400/50', shadow: 'shadow-[inset_4px_0_0_rgba(250,204,21,1)]', pill: 'border-yellow-400/80 text-yellow-400 bg-yellow-400/10' },
  { level: 'LOW', id: '1012', status: 'STABLE', host: 'CVE-2021-0023', desc: 'PATCH', score: '4.5', time: '13:50:12', color: 'text-green-400', border: 'border-green-500/40', shadow: 'shadow-[inset_4px_0_0_#22c55e]', pill: 'border-green-500/70 text-green-400 bg-green-500/10' },
  { level: 'MEDIUM', id: '0877', status: 'YELLOW', host: 'CVE-2022-8839', desc: 'RESOLVED', score: '5.8', time: '13:42:05', color: 'text-yellow-400', border: 'border-yellow-400/40', shadow: 'shadow-[inset_4px_0_0_#facc15]', pill: 'border-yellow-400/70 text-yellow-400 bg-yellow-400/10' },
  { level: 'INFO', id: '0612', status: 'NOMINAL', host: 'CVE-2020-9941', desc: 'LOGGED', score: '2.4', time: '13:30:15', color: 'text-slate-400', border: 'border-slate-500/30', shadow: 'shadow-[inset_4px_0_0_#94a3b8]', pill: 'border-slate-500/60 text-slate-400 bg-slate-500/10' },
];

interface CveFeedWidgetProps {
  cves?: CVEItem[];
}

export default function CveFeedWidget({ cves = [] }: CveFeedWidgetProps) {
  const rows = cves.length > 0 ? cves.map((item, idx) => {
    const severity = item.severity?.toUpperCase() || 'MEDIUM';
    const score = item.score ?? 5.0;
    
    let color = 'text-yellow-400';
    let pill = 'border-yellow-400/80 text-yellow-400 bg-yellow-400/10';
    let desc = 'RESOLVED';
    let status = 'YELLOW';

    if (severity === 'CRITICAL' || score >= 9.0) {
      color = 'text-red-500';
      pill = 'border-red-500/80 text-red-500 bg-red-500/10';
      desc = 'RED';
      status = 'GLOWING';
    } else if (severity === 'HIGH' || score >= 7.0) {
      color = 'text-orange-400';
      pill = 'border-orange-500/80 text-orange-400 bg-orange-400/10';
      desc = 'BADGE';
      status = 'GLOWING';
    } else if (severity === 'LOW' || score < 4.0) {
      color = 'text-green-400';
      pill = 'border-green-500/70 text-green-400 bg-green-500/10';
      desc = 'PATCH';
      status = 'STABLE';
    }

    return {
      level: severity,
      id: item.id.split('-').pop() || String(idx),
      status: status,
      host: item.id,
      desc: item.description ? item.description.slice(0, 15).toUpperCase() : desc,
      score: score.toFixed(1),
      time: new Date().toLocaleTimeString('tr-TR'),
      color: color,
      pill: pill
    };
  }) : mockData;


  return (
    <div className="absolute inset-0 flex flex-col font-mono overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#00ff41]/20 z-10 bg-[#021518]/80 text-[#e2e8f0]">
        <span className="text-[12px] lg:text-sm font-bold tracking-widest uppercase">CVE VULNERABILITIES</span>
        <span className="text-slate-500 tracking-widest text-[10px]">...</span>
      </div>
      
      <div className="flex-1 w-full flex flex-col font-medium p-4 bg-[#021a20]/40 overflow-hidden">
        <div className="w-full h-full flex flex-col overflow-x-auto overflow-y-hidden min-h-0 custom-scrollbar-x">
          <div className="min-w-[750px] w-full flex-1 flex flex-col">
            {/* Table Header */}
            <div className="grid grid-cols-[1.5fr_1fr_1.5fr_2fr_2fr_1fr_1fr] gap-0 text-[10px] text-slate-400 uppercase font-bold tracking-widest px-0 mb-2 bg-[#031c22]/60 rounded-t-md shrink-0 h-8 border-b border-slate-800/80">
              <div className="pl-4 flex items-center border-r border-slate-700/30">LEVEL</div>
              <div className="flex items-center justify-center border-r border-slate-700/30">ID</div>
              <div className="flex items-center justify-center border-r border-slate-700/30">STATUS</div>
              <div className="flex items-center pl-3 border-r border-slate-700/30">HOST</div>
              <div className="flex items-center justify-center border-r border-slate-700/30">CVE DESCRIPTION</div>
              <div className="flex items-center justify-center border-r border-slate-700/30">SCORE</div>
              <div className="flex items-center justify-end pr-4">TIME</div>
            </div>

            {/* Table Body */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent pr-1">
              {rows.map((row, idx) => {
            const getStatusColor = (status: string) => {
              if (status === 'GLOWING') return 'text-[#22d3ee] shadow-[0_0_8px_rgba(34,211,238,0.4)]';
              if (status === 'YELLOW') return 'text-yellow-400';
              if (status === 'STABLE') return 'text-green-400';
              return 'text-slate-400';
            };

            const getBgOverlay = (color: string) => {
              if (color.includes('red')) return 'bg-red-500/10 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.15)]';
              if (color.includes('orange')) return 'bg-orange-500/10 border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.15)]';
              if (color.includes('yellow')) return 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.1)]';
              if (color.includes('green')) return 'bg-green-500/10 border-green-500/30 shadow-[0_0_8px_rgba(34,197,94,0.1)]';
              return 'bg-slate-500/5 border-slate-500/20';
            };

            return (
              <div key={idx} className={`grid grid-cols-[1.5fr_1fr_1.5fr_2fr_2fr_1fr_1fr] gap-0 items-stretch text-[10px] lg:text-[11px] rounded-md border ${getBgOverlay(row.color)} shadow-sm transition-all group overflow-hidden relative flex-1 min-h-[42px]`}>
                {/* Left Accent Bar is thick glowing block */}
                <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${row.color.replace('text-', 'bg-')} shadow-[0_0_10px_${row.color.replace('text-', '')}]`} style={{ boxShadow: `0 0 8px ${row.color === 'text-red-500' ? '#ef4444' : row.color === 'text-orange-400' ? '#f97316' : '#22d3ee'}` }} />

                {/* ID Level */}
                <div className={`font-bold ${row.color} pl-4 flex items-center border-r border-slate-700/40 pr-2 tracking-widest uppercase`}>
                  {row.level}
                </div>

                {/* ID Number */}
                <div className="text-slate-200 font-mono flex items-center justify-center border-r border-slate-700/40 px-2">
                  {row.id}
                </div>

                {/* Status */}
                <div className={`font-bold tracking-widest uppercase flex items-center justify-center border-r border-slate-700/40 px-2 ${getStatusColor(row.status)}`}>
                  {row.status}
                </div>

                {/* Host/CVE ID */}
                <div className="text-slate-200 font-medium tracking-wide flex items-center pl-3 border-r border-slate-700/40 pr-2">
                  {row.host}
                </div>

                {/* Desc/Pill */}
                <div className="flex items-center justify-center border-r border-slate-700/40 px-2">
                  <div className={`px-4 py-0.5 rounded-full border ${row.pill} font-bold text-[8px] tracking-widest uppercase shadow-[inset_0_0_4px_rgba(0,0,0,0.4)]`}>
                    {row.desc}
                  </div>
                </div>

                {/* Score */}
                <div className={`flex items-center justify-center font-bold border-r border-slate-700/40 px-2 ${row.color} text-xs`}>
                  {row.score}
                </div>

                {/* Time/Badge */}
                <div className="flex items-center justify-end pr-4 text-slate-300 font-mono tracking-wider">
                  {row.time}
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
