'use client';
import React, { useEffect, useState } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';

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
        // Array returned from CIRCL
        if (Array.isArray(data)) {
          setCves(data.slice(0, 15)); // Take latest 15
        }
      } catch (err) {
        console.error("Failed to fetch CVEs", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCves();
    
    // Refresh every 10 minutes
    const interval = setInterval(fetchCves, 600000); 
    return () => clearInterval(interval);
  }, []);

  const getSeverity = (score: number | null) => {
    if (score === null) return { level: 'UNKNOWN', styles: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
    if (score >= 9.0) return { level: 'CRITICAL', styles: 'bg-red-500/20 text-red-400 border-red-500/30 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' };
    if (score >= 7.0) return { level: 'HIGH', styles: 'bg-orange-500/20 text-orange-400 border-orange-500/30 drop-shadow-[0_0_5px_rgba(249,115,22,0.4)]' };
    if (score >= 4.0) return { level: 'MEDIUM', styles: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    return { level: 'LOW', styles: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  };

  return (
    <div className="h-full flex flex-col text-green-400 font-mono">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-green-500/20">
        <ShieldAlert className="text-red-500 w-5 h-5 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
        <span className="text-sm font-bold tracking-widest">[ GLOBAL_CVE_FEED ]</span>
        <span className="ml-auto text-[10px] text-green-500/50 animate-pulse">
          {loading ? 'SYNCING...' : 'LIVE_SYNC'}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-green-900 scrollbar-track-transparent">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full text-green-500/50 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs">ESTABLISHING SECURE CONNECTION_</span>
          </div>
        )}
        
        {!loading && cves.map((cve, idx) => {
          const sev = getSeverity(cve.cvss);
          return (
            <div key={idx} className="group relative p-3 border border-green-500/10 bg-[#001105]/40 hover:bg-[#001a08]/80 transition-all hover:border-green-500/30 cursor-crosshair shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 transition-colors drop-shadow-[0_0_4px_rgba(34,211,238,0.4)]">
                  {cve.id}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded shadow-[0_0_8px_currentColor] border ${sev.styles}`}>
                  {cve.cvss ? cve.cvss.toFixed(1) : 'N/A'} {sev.level}
                </span>
              </div>
              <p className="text-[10px] text-green-500/60 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
                {cve.summary}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
