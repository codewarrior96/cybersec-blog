'use client';
import React from 'react';
import { AlertCircle, ShieldAlert, Shield } from 'lucide-react';

const mockCVEs = [
  { id: 'CVE-2026-0032', score: 9.8, severity: 'CRITICAL', desc: 'Remote Code Execution in Core Module' },
  { id: 'CVE-2026-0145', score: 8.5, severity: 'HIGH', desc: 'Privilege Escalation via Auth Bypass' },
  { id: 'CVE-2026-1021', score: 9.1, severity: 'CRITICAL', desc: 'Unauthenticated SQL Injection' },
  { id: 'CVE-2026-0099', score: 6.5, severity: 'MEDIUM', desc: 'Cross-Site Scripting in Dashboard' },
  { id: 'CVE-2026-0420', score: 7.8, severity: 'HIGH', desc: 'Directory Traversal via Upload' },
  { id: 'CVE-2026-0811', score: 9.5, severity: 'CRITICAL', desc: 'Arbitrary File Write vulnerability' },
];

export default function CveFeedWidget() {
  return (
    <div className="h-full flex flex-col text-green-400 font-mono">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-green-500/20">
        <ShieldAlert className="text-red-500 w-5 h-5 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        <span className="text-sm font-bold tracking-widest">[ CVE_FEED ]</span>
        <span className="ml-auto text-[10px] text-green-500/50 animate-pulse">LIVE_SYNC</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-green-900 scrollbar-track-transparent">
        {mockCVEs.map((cve, idx) => (
          <div key={idx} className="group relative p-3 border border-green-500/10 bg-[#001105]/40 hover:bg-[#001a08]/80 transition-colors cursor-pointer">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 transition-colors">{cve.id}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded shadow-[0_0_8px_currentColor] ${
                cve.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                cve.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              }`}>
                {cve.score} {cve.severity}
              </span>
            </div>
            <p className="text-[11px] text-green-500/60 leading-relaxed truncate">{cve.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
