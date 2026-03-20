'use client';
import React, { useState, useEffect } from 'react';
import CveFeedWidget from './CveFeedWidget';
import ThreatMapWidget from './ThreatMapWidget';
import SystemMonitorWidget from './SystemMonitorWidget';
import TerminalLogWidget from './TerminalLogWidget';
import { Shield, User, Activity, AlertTriangle, ShieldCheck, Globe } from 'lucide-react';

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
    <div className="min-h-screen bg-[#070b0e] text-[#00ff41] font-mono p-2 sm:p-4 flex flex-col relative overflow-hidden">
      {/* Background Matrix/Grid */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(0,255,65,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,255,65,0.02)_1px,transparent_1px)] bg-[size:2rem_2rem]" />
      
      {/* SENTINEL OS TOP BAR */}
      <header className="relative w-full z-10 flex flex-wrap items-center justify-between border border-green-500/20 bg-[#0a1114]/80 p-3 mb-4 shadow-[0_0_15px_rgba(0,0,0,0.5)] rounded-sm backdrop-blur-md">
        <div className="flex items-center gap-4 lg:gap-6 w-full lg:w-auto justify-between lg:justify-start">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-green-500/10 border border-green-500/40 rounded shadow-[inset_0_0_10px_rgba(0,255,65,0.2)]">
              <Shield className="text-green-400 w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-base lg:text-lg font-bold tracking-wider text-slate-100 drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]">SENTINEL OS <span className="text-xs font-normal text-green-500/70">v4.1</span></span>
              <span className="text-[9px] lg:text-[10px] text-green-500/60 tracking-widest uppercase">RANK: SHADOW_NODE</span>
            </div>
          </div>
          
          {/* Profile */}
          <div className="hidden sm:flex items-center gap-2 border-l border-green-500/20 pl-4 lg:pl-6">
            <div className="w-8 h-8 rounded-full border border-cyan-500/50 flex flex-col items-center justify-center bg-[#00111a]">
              <User className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] lg:text-xs font-bold text-cyan-400">SHADOW_NODE</span>
              <span className="text-[9px] lg:text-[10px] text-cyan-500/60">Level 88</span>
            </div>
          </div>
        </div>
        
        {/* Threat Level */}
        <div className="hidden lg:flex flex-col items-center justify-center">
          <div className="text-[10px] text-slate-300 font-bold tracking-widest mb-1 flex items-center gap-2">GLOBAL THREAT LEVEL: <span className="text-red-500">HIGH (8.7)</span></div>
          <div className="flex items-center gap-1">
            <div className="flex gap-[2px]">
              {Array.from({length: 22}).map((_, i) => (
                <div key={i} className={`h-2.5 w-1.5 ${i < 16 ? 'bg-cyan-500' : 'bg-red-500 animate-pulse'} opacity-80 rounded-sm`} />
              ))}
            </div>
            <div className="w-4 h-4 rounded-full border border-red-500/50 flex items-center justify-center ml-2 relative">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping absolute" />
              <div className="w-2 h-2 bg-red-500 rounded-full" />
            </div>
          </div>
        </div>

        {/* Right Stats */}
        <div className="hidden md:flex flex-col items-end gap-1 mt-4 lg:mt-0">
          <div className="text-sm lg:text-lg font-bold text-slate-200 tracking-wider font-mono">{time}</div>
          <div className="flex gap-4 text-[9px] lg:text-[10px] font-bold uppercase">
            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-green-500 animate-pulse" /> Active</div>
            <div className="flex items-center gap-1 text-red-400"><AlertTriangle className="w-2.5 h-2.5 lg:w-3 lg:h-3" /> Alerts: 37</div>
            <div className="flex items-center gap-1 text-cyan-400"><ShieldCheck className="w-2.5 h-2.5 lg:w-3 lg:h-3" /> Secure</div>
          </div>
        </div>
      </header>

      {/* Main Responsive Bento Grid */}
      <div className="relative z-10 w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 pb-10">
        
        {/* TOP ROW */}
        {/* Left Column: System Monitoring */}
        <div className="lg:col-span-3 flex flex-col gap-3 min-h-[400px]">
          <SystemMonitorWidget />
        </div>

        {/* Center Column: Cyber Threat Map */}
        <div className="lg:col-span-6 border border-green-500/20 bg-[#0a1114]/80 p-3 lg:p-4 shadow-[0_0_15px_rgba(0,0,0,0.5)] rounded-sm flex flex-col min-h-[400px] backdrop-blur-sm">
          <ThreatMapWidget />
        </div>

        {/* Right Column: Threat Feed / Logs */}
        <div className="lg:col-span-3 border border-green-500/20 bg-[#0a1114]/80 p-3 lg:p-4 shadow-[0_0_15px_rgba(0,0,0,0.5)] rounded-sm flex flex-col min-h-[400px] backdrop-blur-sm">
          <TerminalLogWidget />
        </div>

        {/* BOTTOM ROW */}
        {/* Bottom Left-Center: CVE Vulnerabilities Table */}
        <div className="lg:col-span-9 border border-green-500/20 bg-[#0a1114]/80 p-0 shadow-[0_0_15px_rgba(0,0,0,0.5)] rounded-sm flex flex-col overflow-hidden backdrop-blur-sm">
          <CveFeedWidget />
        </div>

        {/* Bottom Right: Geo Analytics */}
        <div className="lg:col-span-3 border border-green-500/20 bg-[#0a1114]/80 p-3 lg:p-4 shadow-[0_0_15px_rgba(0,0,0,0.5)] rounded-sm flex flex-col justify-between backdrop-blur-sm">
          <div>
            <div className="text-[12px] font-bold text-slate-200 tracking-widest mb-3 flex items-center justify-between border-b border-green-500/20 pb-2">
              GEO-ANALYTICS <span className="text-green-500/50">...</span>
            </div>
            <div className="flex-1 flex items-center justify-center relative opacity-50 py-4">
              <Globe className="w-20 h-20 text-cyan-500/40" />
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-green-500/60 font-bold border-t border-green-500/10 pt-2 mt-auto">
            <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> ACTIVE ALERTS</span>
            <span className="text-cyan-400 flex items-center gap-1"><Globe className="w-3 h-3"/> GLOBAL</span>
          </div>
        </div>

      </div>
    </div>
  );
}
