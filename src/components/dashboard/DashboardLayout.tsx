'use client';
import React, { useState, useEffect } from 'react';
import CveFeedWidget from './CveFeedWidget';
import ThreatMapWidget from './ThreatMapWidget';
import SystemMonitorWidget from './SystemMonitorWidget';
import TerminalLogWidget from './TerminalLogWidget';
import { Shield, User, AlertTriangle, ShieldCheck, Globe, Activity } from 'lucide-react';

export default function DashboardLayout() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');

  useEffect(() => {
    setMounted(true);
    // Use target layout timestamp format if possible
    setTime('14:02:12 UTC'); // Starting with fixed offset for effect or just dynamic
    const timer = setInterval(() => {
      setTime(new Date().toISOString().substring(11, 19) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#070b10] text-[#00ff41] font-mono p-4 lg:p-8 flex flex-col relative overflow-hidden select-none">
      
      {/* Outer Corners */}
      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-slate-500/40 pointer-events-none" />
      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-slate-500/40 pointer-events-none" />
      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-slate-500/40 pointer-events-none" />
      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-slate-500/40 pointer-events-none" />

      {/* Main Container Outline */}
      <div className="flex flex-col gap-4 w-full h-full max-w-[1600px] mx-auto z-10 relative">

        {/* SENTINEL OS TOP BAR */}
        <header className="relative w-full z-10 flex flex-nowrap items-center justify-between border border-[#00ff41]/20 bg-[#021014]/80 p-3 lg:p-4 rounded-md backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-4 lg:gap-6 shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center bg-[#00ff41]/10 rounded-lg border border-[#00ff41]/50 relative" style={{clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'}}>
                <Shield className="text-[#00ff41] w-6 h-6" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#00ff41]/20 to-transparent" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm lg:text-base font-bold tracking-widest text-[#e2e8f0]">SENTINEL OS <span className="text-xs font-normal text-[#00ff41]/70">v4.1</span></span>
                <span className="text-[9px] lg:text-[10px] text-[#00ff41]/60 tracking-widest uppercase">RANK: SHADOW_NODE</span>
              </div>
            </div>
            
            <div className="w-px h-10 bg-[#00ff41]/20 mx-2 hidden sm:block" />

            {/* Profile */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-cyan-500/50 flex flex-col items-center justify-center bg-[#00111a] shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                <User className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex flex-col w-28">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] lg:text-xs font-bold text-cyan-400">SHADOW_NODE</span>
                </div>
                <span className="text-[9px] lg:text-[10px] text-cyan-500/60 mb-1">Level 88</span>
                <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-orange-500/30">
                  <div className="h-full bg-orange-500 w-[70%]" />
                </div>
              </div>
            </div>

            <div className="w-px h-10 bg-[#00ff41]/20 mx-2 hidden xl:block" />

            {/* Threat Level */}
            <div className="hidden xl:flex items-center gap-4">
              <div className="flex flex-col">
                <div className="text-[10px] text-slate-300 font-medium tracking-widest mb-1">GLOBAL THREAT LEVEL: <span className="text-red-500 font-bold">HIGH (8.7)</span></div>
                <div className="flex gap-[2px]">
                  {Array.from({length: 26}).map((_, i) => (
                    <div key={i} className={`h-3 w-1.5 ${i < 20 ? 'bg-cyan-500' : 'bg-red-500 shadow-[0_0_5px_red]'} opacity-90`} />
                  ))}
                </div>
              </div>
              
              {/* Gauge */}
              <div className="w-12 h-6 relative ml-2 overflow-hidden flex items-end justify-center">
                <div className="w-12 h-12 rounded-full border-t border-l border-r border-[#00ff41]/30 border-b-0 absolute top-0" style={{borderTopColor: '#00ff41', borderRightColor: '#ef4444', borderLeftColor: '#06b6d4'}} />
                <div className="w-10 h-10 rounded-full border-t border-l border-r border-[#00ff41]/20 border-b-0 absolute top-1" />
                <div className="w-1 h-5 bg-red-500 absolute bottom-0 origin-bottom right-3 rotate-[35deg] rounded-full shadow-[0_0_5px_red]" />
                <div className="w-2 h-2 rounded-full bg-slate-300 absolute bottom-0 z-10 translate-y-1" />
              </div>
            </div>
          </div>
          
          {/* Right Stats */}
          <div className="flex flex-col items-end gap-1">
            <div className="text-sm lg:text-xl font-medium text-[#e2e8f0] tracking-wider font-mono">{time}</div>
            <div className="flex gap-3 text-[9px] lg:text-[10px] font-medium tracking-wide">
              <div className="flex items-center gap-1.5 text-[#00ff41]"><Activity className="w-3 h-3 animate-pulse" /> Active</div>
              <div className="flex items-center gap-1.5 text-red-500"><AlertTriangle className="w-3 h-3" /> Alerts: 37</div>
              <div className="flex items-center gap-1.5 text-cyan-400"><ShieldCheck className="w-3 h-3" /> Secure</div>
            </div>
          </div>
        </header>

        {/* Main Responsive Bento Grid */}
        <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 pb-4">
          
          {/* TOP ROW */}
          <div className="lg:col-span-3 h-[420px] relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <SystemMonitorWidget />
          </div>

          <div className="lg:col-span-6 h-[420px] relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <ThreatMapWidget />
          </div>

          <div className="lg:col-span-3 h-[420px] relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <TerminalLogWidget />
          </div>

          {/* BOTTOM ROW */}
          <div className="lg:col-span-9 h-[280px] relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <CveFeedWidget />
          </div>

          <div className="lg:col-span-3 h-[280px] relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <div className="flex justify-between items-center px-4 py-3 border-b border-[#00ff41]/20 bg-[#021518]/80">
              <span className="text-[12px] font-bold text-slate-200 tracking-widest uppercase">GEO-ANALYTICS</span>
              <span className="text-slate-500 tracking-widest">...</span>
            </div>
            <div className="flex-1 flex flex-col h-[calc(100%-45px)]">
              <div className="flex-1 flex items-center justify-center relative">
                <div className="w-40 h-40 rounded-full border border-cyan-500/40 relative flex items-center justify-center bg-[#021a20] overflow-hidden">
                   <div className="w-28 h-28 rounded-full border border-cyan-500/20 absolute" />
                   <div className="w-14 h-14 rounded-full border border-cyan-500/10 absolute" />
                   {/* Crosshairs */}
                   <div className="absolute w-full h-px bg-cyan-500/20" />
                   <div className="absolute h-full w-px bg-cyan-500/20" />
                   {/* Blips */}
                   <div className="absolute w-2 h-2 bg-red-500 rounded-full top-[30%] left-[60%] animate-pulse shadow-[0_0_8px_red]" />
                   <div className="absolute w-1.5 h-1.5 bg-cyan-400 rounded-full bottom-[40%] right-[75%] shadow-[0_0_3px_cyan]" />
                   <div className="absolute w-1.5 h-1.5 bg-orange-400 rounded-full bottom-[25%] left-[35%] animate-ping shadow-[0_0_5px_orange]" />
                   {/* Sweep */}
                   <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,rgba(6,182,212,0)_0deg,rgba(6,182,212,0.4)_60deg,rgba(6,182,212,0)_61deg)] animate-[spin_3s_linear_infinite]" />
                 </div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-bold border-t border-[#00ff41]/20 px-4 py-2 bg-[#021518]/50">
                <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> ACTIVE ALERTS</span>
                <span className="text-cyan-400 flex items-center gap-1"><Globe className="w-3 h-3"/> GLOBAL</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
