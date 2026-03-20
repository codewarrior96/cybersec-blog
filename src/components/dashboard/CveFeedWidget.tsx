'use client';
import React from 'react';

const mockData = [
  { level: 'CRITICAL', id: '1456', status: 'GLOWING', host: 'CVE-2023-1456', desc: 'RED', score: '9.8', time: '14:02:11', color: 'text-red-500', border: 'border-red-500/50', shadow: 'shadow-[inset_4px_0_0_rgba(239,68,68,1)]', pill: 'border-red-500/80 text-red-500 bg-red-500/10' },
  { level: 'HIGH', id: '1082', status: 'GLOWING', host: 'CVE-2024-0987', desc: 'BADGE', score: '8.5', time: '14:00:05', color: 'text-orange-400', border: 'border-orange-500/50', shadow: 'shadow-[inset_4px_0_0_rgba(251,146,60,1)]', pill: 'border-orange-500/80 text-orange-400 bg-orange-400/10' },
  { level: 'MEDIUM', id: '932', status: 'YELLOW', host: 'CVE-2022-3112', desc: 'YELLOW', score: '6.1', time: '13:58:30', color: 'text-yellow-400', border: 'border-yellow-400/50', shadow: 'shadow-[inset_4px_0_0_rgba(250,204,21,1)]', pill: 'border-yellow-400/80 text-yellow-400 bg-yellow-400/10' },
  { level: 'LOW', id: '1012', status: 'STABLE', host: 'CVE-2021-0023', desc: 'PATCH', score: '4.5', time: '13:50:12', color: 'text-green-400', border: 'border-green-500/40', shadow: 'shadow-[inset_4px_0_0_#22c55e]', pill: 'border-green-500/70 text-green-400 bg-green-500/10' },
  { level: 'MEDIUM', id: '0877', status: 'YELLOW', host: 'CVE-2022-8839', desc: 'RESOLVED', score: '5.8', time: '13:42:05', color: 'text-yellow-400', border: 'border-yellow-400/40', shadow: 'shadow-[inset_4px_0_0_#facc15]', pill: 'border-yellow-400/70 text-yellow-400 bg-yellow-400/10' },
  { level: 'INFO', id: '0612', status: 'NOMINAL', host: 'CVE-2020-9941', desc: 'LOGGED', score: '2.4', time: '13:30:15', color: 'text-slate-400', border: 'border-slate-500/30', shadow: 'shadow-[inset_4px_0_0_#94a3b8]', pill: 'border-slate-500/60 text-slate-400 bg-slate-500/10' },
];

export default function CveFeedWidget() {

  return (
    <div className="absolute inset-0 flex flex-col font-mono overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#00ff41]/20 z-10 bg-[#021518]/80 text-[#e2e8f0]">
        <span className="text-[12px] lg:text-sm font-bold tracking-widest uppercase">CVE VULNERABILITIES</span>
        <span className="text-slate-500 tracking-widest text-[10px]">...</span>
      </div>
      
      <div className="flex-1 w-full overflow-hidden flex flex-col font-medium p-4 bg-[#021a20]/40">
        {/* Table Header */}
        <div className="grid grid-cols-[1.5fr_1fr_1.5fr_2fr_2fr_1fr_1fr] gap-2 text-[9px] lg:text-[10px] text-slate-400 uppercase tracking-widest px-4 mb-3">
          <div>ID</div>
          <div>ID</div>
          <div>STATUS</div>
          <div>HOST</div>
          <div className="text-center">CVE DESCRIPTION</div>
          <div className="text-center">SCORE</div>
          <div className="text-right">BADGE</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent">
          {mockData.map((row, idx) => (
            <div key={idx} className={`grid grid-cols-[1.5fr_1fr_1.5fr_2fr_2fr_1fr_1fr] gap-2 items-center text-[10px] lg:text-[11px] px-4 py-2.5 rounded-md border ${row.border} bg-[#021114]/80 shadow-sm transition-all group overflow-hidden relative`}>
              {/* Left Accent Bar using absolute positioning or inset shadow */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${row.color.replace('text-', 'bg-')}`} />

              {/* ID Level */}
              <div className={`font-bold ${row.color} pl-2 tracking-widest uppercase`}>
                {row.level}
              </div>

              {/* ID Number */}
              <div className="text-slate-400 font-mono">
                {row.id}
              </div>

              {/* Status */}
              <div className={`${row.color} font-bold tracking-widest uppercase`}>
                {row.status}
              </div>

              {/* Host/CVE ID */}
              <div className="text-slate-300 font-medium tracking-wide">
                {row.host}
              </div>

              {/* Desc/Pill */}
              <div className="flex justify-center">
                <div className={`px-6 py-0.5 rounded-full border ${row.pill} font-bold text-[9px] tracking-widest uppercase`}>
                  {row.desc}
                </div>
              </div>

              {/* Score */}
              <div className={`text-center font-bold ${row.color} text-xs`}>
                {row.score}
              </div>

              {/* Time/Badge */}
              <div className="text-right text-slate-400 font-mono tracking-wider">
                {row.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
