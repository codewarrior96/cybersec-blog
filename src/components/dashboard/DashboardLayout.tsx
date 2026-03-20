'use client';
import React, { useState, useEffect } from 'react';
import CveFeedWidget from './CveFeedWidget';
import ThreatMapWidget from './ThreatMapWidget';
import SystemMonitorWidget from './SystemMonitorWidget';
import TerminalLogWidget from './TerminalLogWidget';
import { Skull } from 'lucide-react';

export default function DashboardLayout() {
  const [mounted, setMounted] = useState(false);
  
  // Hydration fix
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#020503] text-green-500 font-mono p-4 sm:p-6 lg:p-8 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,255,65,0.08),rgba(0,0,0,1))] selection:bg-green-500/30">
      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(0,255,65,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,255,65,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem]" />
      
      {/* Global Top Bar */}
      <header className="relative w-full z-10 flex flex-wrap items-center justify-between border-b border-green-500/20 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded shadow-[0_0_10px_rgba(0,255,65,0.2)]">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse drop-shadow-[0_0_5px_rgba(0,255,65,1)]" />
            <span className="text-xs font-bold tracking-widest text-green-400">STATUS: ONLINE</span>
          </div>
          <span className="hidden sm:flex text-[10px] text-green-500/50">/// SECURE_CONNECTION_ESTABLISHED</span>
        </div>
        
        <div className="flex items-center gap-4 mt-4 sm:mt-0">
          <div className="text-right flex flex-col items-end">
            <div className="text-xs font-bold text-green-400 drop-shadow-[0_0_5px_rgba(0,255,65,0.5)]">RANK: SHADOW_NODE</div>
            <div className="text-[10px] text-green-500/60 mt-0.5">USER: ghost_operator</div>
          </div>
          <div className="h-10 w-10 relative flex items-center justify-center border border-green-500/30 bg-[#001105]/50 rounded-lg shadow-[inset_0_0_15px_rgba(0,255,65,0.1)]">
            <Skull className="w-5 h-5 text-green-400 opacity-80" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="relative z-10 flex-1 w-full max-w-[1700px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        
        {/* Left Column (CVE Log) */}
        <div className="lg:col-span-3 h-[400px] lg:h-[calc(100vh-130px)] backdrop-blur-md bg-[#000d05]/30 border border-green-500/20 rounded-xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-all hover:border-green-400/40 hover:shadow-[0_0_20px_rgba(0,255,65,0.15)] flex flex-col">
          <CveFeedWidget />
        </div>

        {/* Middle Column (Threat Map) */}
        <div className="lg:col-span-6 h-[400px] lg:h-[calc(100vh-130px)] backdrop-blur-md bg-[#000d05]/30 border border-green-500/20 rounded-xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-all hover:border-green-400/40 hover:shadow-[0_0_20px_rgba(0,255,65,0.15)] flex flex-col">
          <ThreatMapWidget />
        </div>

        {/* Right Column (Monitoring & Logs) */}
        <div className="lg:col-span-3 h-[600px] lg:h-[calc(100vh-130px)] flex flex-col gap-4 lg:gap-6">
          <div className="flex-1 min-h-[150px] backdrop-blur-md bg-[#000d05]/30 border border-cyan-500/20 rounded-xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-all hover:border-cyan-400/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] flex flex-col">
            <SystemMonitorWidget />
          </div>
          <div className="flex-[1.5] min-h-[200px] backdrop-blur-md bg-[#000d05]/30 border border-green-500/20 rounded-xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-all hover:border-green-400/40 hover:shadow-[0_0_20px_rgba(0,255,65,0.15)] flex flex-col">
            <TerminalLogWidget />
          </div>
        </div>

      </div>
    </div>
  );
}
