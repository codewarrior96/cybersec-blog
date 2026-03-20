'use client';
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface CveItem {
  id: string;
  cvss: number | null;
  summary: string;
}

export default function CveFeedWidget() {
  const [cves, setCves] = useState<CveItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCves() {
      try {
        const res = await fetch('/api/cve');
        if (!res.ok) throw new Error('API failed');
        const data = await res.json();
        if (Array.isArray(data)) {
          setCves(data.slice(0, 4)); // Only need 4 items to match layout sizing perfectly
        }
      } catch (err) {
        console.error("Failed to fetch CVEs", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCves();
  }, []);

  const getStyle = (score: number | null) => {
    if (score === null) return { level: 'UNKNOWN', color: 'text-slate-400', border: 'border-slate-500/30', bg: 'bg-slate-500/5' };
    if (score >= 9.0) return { level: 'CRITICAL', color: 'text-red-500', border: 'border-red-500/80', bg: 'bg-red-500/5' };
    if (score >= 7.0) return { level: 'HIGH', color: 'text-orange-400', border: 'border-orange-500/80', bg: 'bg-orange-500/5' };
    if (score >= 4.0) return { level: 'MEDIUM', color: 'text-yellow-400', border: 'border-yellow-400/80', bg: 'bg-yellow-400/5' };
    return { level: 'LOW', color: 'text-cyan-400', border: 'border-cyan-500/80', bg: 'bg-cyan-500/5' };
  };

  return (
    <div className="h-full flex flex-col text-slate-200 font-mono p-3 lg:p-4">
      <div className="flex justify-between items-center mb-4 z-10 w-full px-1">
        <span className="text-[11px] lg:text-sm font-bold tracking-widest uppercase text-slate-200">CVE VULNERABILITIES</span>
        <span className="text-slate-500 tracking-widest text-[10px]">...</span>
      </div>
      
      <div className="flex-1 w-full overflow-hidden flex flex-col font-medium border border-green-500/10 rounded-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 text-[9px] lg:text-[11px] text-slate-400 uppercase tracking-widest px-4 py-3 bg-[#00111a]/40 border-b border-green-500/20">
          <div className="col-span-2">ID</div>
          <div className="col-span-2">STATUS</div>
          <div className="col-span-3">HOST</div>
          <div className="col-span-3">CVE DESCRIPTION</div>
          <div className="col-span-1 text-center">SCORE</div>
          <div className="col-span-1 text-right">TIME</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent">
          {loading && (
            <div className="flex items-center justify-center h-full text-green-500/50 min-h-[150px]">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          
          {!loading && cves.map((cve, idx) => {
            const style = getStyle(cve.cvss);
            const time = new Date().toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'});
            
            return (
              <div key={idx} className={`grid grid-cols-12 gap-2 items-center text-[10px] lg:text-[11px] px-4 py-3 border-b last:border-b-0 border-green-500/10 ${style.bg} hover:brightness-125 transition-all group`}>
                <div className={`col-span-2 font-bold ${style.color} drop-shadow-[0_0_5px_currentColor]`}>
                  {style.level}
                </div>
                <div className={`col-span-2 ${style.color}`}>
                  GLOWING
                </div>
                <div className="col-span-3 text-slate-300 font-bold group-hover:text-white transition-colors">
                  {cve.id}
                </div>
                <div className="col-span-3 text-slate-400 truncate pr-4 flex items-center gap-2">
                  <div className={`shrink-0 px-3 py-0.5 rounded-full border ${style.border} ${style.color} font-bold text-[8px]`}>
                    BADGE
                  </div>
                  <span className="truncate">{cve.summary}</span>
                </div>
                <div className={`col-span-1 text-center font-bold ${style.color} text-xs`}>
                  {cve.cvss ? cve.cvss.toFixed(1) : '-'}
                </div>
                <div className="col-span-1 text-right text-slate-500">
                  {time}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
