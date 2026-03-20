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
    setTime(new Date().toISOString().substring(11, 19) + ' UTC');
    const timer = setInterval(() => {
      setTime(new Date().toISOString().substring(11, 19) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="h-screen bg-[#070b10] text-[#00ff41] font-mono p-3 lg:p-5 flex flex-col relative overflow-hidden select-none">
      
      {/* Outer Corners */}
      <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-slate-500/40 pointer-events-none" />
      <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-slate-500/40 pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-slate-500/40 pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-slate-500/40 pointer-events-none" />

      {/* Main Container — fills the full height */}
      <div className="flex flex-col gap-3 w-full h-full max-w-[1800px] mx-auto z-10 relative">

        {/* SENTINEL OS TOP BAR */}
        <header className="relative w-full shrink-0 z-10 flex flex-nowrap items-center justify-between border border-[#00ff41]/20 bg-[#021014]/80 px-4 py-2.5 rounded-md backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3 lg:gap-5 shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-[#00ff41]/10 rounded border border-[#00ff41]/50 relative">
                <Shield className="text-[#00ff41] w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-widest text-[#e2e8f0]">SENTINEL OS <span className="text-xs font-normal text-[#00ff41]/70">v4.1</span></span>
                <span className="text-[9px] text-[#00ff41]/60 tracking-widest uppercase">RANK: SHADOW_NODE</span>
              </div>
            </div>
            
            <div className="w-px h-8 bg-[#00ff41]/20 mx-1 hidden sm:block" />

            {/* Profile */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full border border-cyan-500/50 flex items-center justify-center bg-[#00111a] shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                <User className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex flex-col w-24">
                <span className="text-[10px] font-bold text-cyan-400">SHADOW_NODE</span>
                <span className="text-[9px] text-cyan-500/60 mb-0.5">Level 88</span>
                <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-orange-500/30">
                  <div className="h-full bg-orange-500 w-[70%]" />
                </div>
              </div>
            </div>

            <div className="w-px h-8 bg-[#00ff41]/20 mx-1 hidden xl:block" />

            {/* Threat Level */}
            <div className="hidden xl:flex items-center gap-3">
              <div className="flex flex-col">
                <div className="text-[9px] text-slate-300 font-medium tracking-widest mb-1">GLOBAL THREAT LEVEL: <span className="text-red-500 font-bold">HIGH (8.7)</span></div>
                <div className="flex gap-[2px]">
                  {Array.from({length: 26}).map((_, i) => (
                    <div key={i} className={`h-2.5 w-1.5 ${i < 20 ? 'bg-cyan-500' : 'bg-red-500 shadow-[0_0_5px_red]'} opacity-90`} />
                  ))}
                </div>
              </div>
              
              {/* Gauge */}
              <div className="w-11 h-6 relative overflow-hidden flex items-end justify-center">
                <div className="w-11 h-11 rounded-full absolute top-0" style={{border: '2px solid transparent', borderTopColor: '#22d3ee', borderRightColor: '#ef4444', borderLeftColor: '#22d3ee'}} />
                <div className="w-8 h-8 rounded-full absolute top-1.5" style={{border: '1px solid rgba(0,255,65,0.2)', borderBottomColor: 'transparent'}} />
                <div className="w-0.5 h-4 bg-red-500 absolute bottom-0 origin-bottom rounded-full shadow-[0_0_4px_red]" style={{transform: 'rotate(30deg)', transformOrigin: 'bottom center', left: 'calc(50% + 4px)'}} />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 absolute bottom-0 left-1/2 -translate-x-1/2 z-10" />
              </div>
            </div>
          </div>
          
          {/* Right Stats */}
          <div className="flex flex-col items-end gap-0.5">
            <div className="text-base lg:text-lg font-medium text-[#e2e8f0] tracking-wider font-mono">{time}</div>
            <div className="flex gap-3 text-[9px] font-medium tracking-wide">
              <div className="flex items-center gap-1 text-[#00ff41]"><Activity className="w-2.5 h-2.5 animate-pulse" /> Active</div>
              <div className="flex items-center gap-1 text-red-500"><AlertTriangle className="w-2.5 h-2.5" /> Alerts: 37</div>
              <div className="flex items-center gap-1 text-cyan-400"><ShieldCheck className="w-2.5 h-2.5" /> Secure</div>
            </div>
          </div>
        </header>

        {/* Main Responsive Bento Grid — flex-1 to fill remaining height */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 grid-rows-[3fr_2fr] gap-3">
          
          {/* TOP ROW */}
          <div className="lg:col-span-3 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <SystemMonitorWidget />
          </div>

          <div className="lg:col-span-6 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <ThreatMapWidget />
          </div>

          <div className="lg:col-span-3 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <TerminalLogWidget />
          </div>

          {/* BOTTOM ROW */}
          <div className="lg:col-span-9 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <CveFeedWidget />
          </div>

          <div className="lg:col-span-3 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)] flex flex-col">
            <div className="flex justify-between items-center px-4 py-3 border-b border-[#00ff41]/20 bg-[#021518]/80 shrink-0">
              <span className="text-[11px] font-bold text-slate-200 tracking-widest uppercase">GEO-ANALYTICS</span>
              <span className="text-slate-500 tracking-widest text-[10px]">...</span>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden">
              {/* Mini world map using SVG mask */}
              <div className="w-full h-full relative flex items-center justify-center">
                <svg viewBox="0 0 600 300" className="w-full h-full opacity-80" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <mask id="geo-mask">
                      <image href="/world.svg" x="0" y="0" width="600" height="300" />
                    </mask>
                  </defs>
                  <rect x="0" y="0" width="600" height="300" fill="#0d3030" mask="url(#geo-mask)" />
                  {/* Threat blips */}
                  <circle cx="160" cy="130" r="4" fill="#ef4444" className="animate-pulse" />
                  <circle cx="160" cy="130" r="10" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.5" className="animate-ping" />
                  <circle cx="350" cy="110" r="3" fill="#ef4444" className="animate-pulse" />
                  <circle cx="450" cy="120" r="5" fill="#ef4444" className="animate-pulse" style={{animationDelay:'0.4s'}} />
                  <circle cx="450" cy="120" r="12" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4" className="animate-ping" />
                  <circle cx="280" cy="155" r="3" fill="#22d3ee" />
                  <circle cx="315" cy="185" r="3" fill="#22d3ee" className="animate-pulse" />
                  {/* Connection arcs */}
                  <path d="M 280 145 Q 315 130 350 110" stroke="rgba(239,68,68,0.4)" strokeWidth="1" fill="none" />
                  <path d="M 280 145 Q 365 100 450 120" stroke="rgba(239,68,68,0.4)" strokeWidth="1" fill="none" />
                  <path d="M 280 145 Q 220 120 160 130" stroke="rgba(34,211,238,0.4)" strokeWidth="1" fill="none" />
                </svg>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-bold border-t border-[#00ff41]/20 px-4 py-2 bg-[#021518]/80 shrink-0">
              <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> ACTIVE ALERTS</span>
              <span className="text-cyan-400 flex items-center gap-1"><Globe className="w-3 h-3"/> GLOBAL</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
