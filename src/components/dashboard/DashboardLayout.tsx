'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CveFeedWidget from './CveFeedWidget';
import ThreatMapWidget from './ThreatMapWidget';
import SystemMonitorWidget from './SystemMonitorWidget';
import TerminalLogWidget from './TerminalLogWidget';
import { Shield, User, AlertTriangle, ShieldCheck, Globe, Activity, Wifi, Bell, Settings, ChevronDown } from 'lucide-react';
import { useAuthSession } from '@/lib/auth-client';
import type { AttackEvent, CVEItem, NewsItem, WorkflowMetrics } from '@/lib/dashboard-types';


export default function DashboardLayout() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const session = useAuthSession(null);
  const user = session?.user;

  // Live Data States
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [cves, setCves] = useState<CVEItem[]>([]);
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [streamMode, setStreamMode] = useState<'connecting' | 'live' | 'degraded'>('connecting');
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);

  // Dynamic Header States
  const [threatScore, setThreatScore] = useState(2.5);
  const [displayedScore, setDisplayedScore] = useState(2.5);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [userXp, setUserXp] = useState(70);
  const [userLevel, setUserLevel] = useState(88);

  const coreFetchSeqRef = useRef(0);

  const fetchCorePanels = useCallback(async () => {
    const fetchSeq = ++coreFetchSeqRef.current;
    try {
      const response = await fetch('/api/metrics/live', { cache: 'no-store' });
      if (response.ok && fetchSeq === coreFetchSeqRef.current) {
        const payload = (await response.json()) as WorkflowMetrics;
        setMetrics(payload);
      }
    } catch (e) { }
  }, []);

  const loadIntelPanels = useCallback(async () => {
    try {
      const [newsRes, cvesRes] = await Promise.all([
        fetch('/api/cybernews', { cache: 'no-store' }),
        fetch('/api/cves?days=1', { cache: 'no-store' })
      ]);
      
      if (newsRes.ok) {
        const payload = await newsRes.json();
        setNewsItems(payload.items ?? []);
      }
      if (cvesRes.ok) {
        const payload = await cvesRes.json();
        setCves((payload.cves ?? []).slice(0, 10));
      }
    } catch (e) { }
  }, []);

  useEffect(() => {
    setMounted(true);
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('tr-TR') + ' LOC');
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void loadIntelPanels();
    const interval = setInterval(() => { void loadIntelPanels(); }, 60_000);
    return () => clearInterval(interval);
  }, [loadIntelPanels]);

  useEffect(() => {
    void fetchCorePanels();
    const interval = setInterval(() => { void fetchCorePanels(); }, 15_000);
    return () => clearInterval(interval);
  }, [fetchCorePanels]);

  useEffect(() => {
    let disposed = false;
    const source = new EventSource('/api/live-attacks');

    source.addEventListener('ready', () => {
      if (disposed) return;
      setStreamMode('live');
    });

    source.addEventListener('attack', (event) => {
      if (disposed) return;
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as AttackEvent;
        setAttacks((prev) => [...prev, payload].slice(-15));
        setStreamMode('live');
      } catch { }
    });

    source.onerror = () => {
      if (disposed) return;
      setStreamMode('degraded');
    };

    return () => {
      disposed = true;
      source.close();
    };
  }, []);

  // Dynamic Threat Score Calculation and Alerts
  useEffect(() => {
    let baseScore = 2.5;
    if (metrics) {
      baseScore = Math.max(2.0, Math.min(6.0, metrics.attack.liveDensity || 2.0));
    }
    const attackSpike = attacks.length * 0.4;
    setThreatScore(Math.min(10.0, baseScore + attackSpike));

    const baseAlerts = metrics?.shiftSnapshot.openCritical || 12;
    setActiveAlerts(baseAlerts + Math.floor(attacks.length / 2));
  }, [attacks, metrics]);

  // Smooth Interpolation for display score and slow User XP gain
  useEffect(() => {
    let animationFrame: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      setDisplayedScore(prev => {
        const diff = threatScore - prev;
        if (Math.abs(diff) < 0.02) return threatScore;
        return prev + diff * (deltaTime * 0.005);
      });

      setUserXp(prev => {
        const newXp = prev + (deltaTime * 0.0005); // Very slow filling
        if (newXp >= 100) {
          setUserLevel(l => l + 1);
          return 0;
        }
        return newXp;
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [threatScore]);

  if (!mounted) return null;

  const getThreatLevelInfo = (score: number) => {
    if (score < 4.0) return { text: 'LOW', color: 'text-[#00ff41]', glow: 'glow-cyan' };
    if (score < 7.5) return { text: 'ELEVATED', color: 'text-orange-500', glow: 'glow-orange' };
    return { text: 'HIGH', color: 'text-red-500', glow: 'glow-red' };
  };
  const threatInfo = getThreatLevelInfo(displayedScore);
  const gaugeRotation = -70 + (displayedScore / 10) * 140;


  return (
    <div className="fixed inset-0 lg:left-[280px] bg-[#030608] text-[#00ff41] font-mono flex flex-col overflow-hidden select-none" style={{ zIndex: 10 }}>
      
      {/* Outer Corners */}
      <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-slate-500/40 pointer-events-none z-20" />
      <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-slate-500/40 pointer-events-none z-20" />
      <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-slate-500/40 pointer-events-none z-20" />
      <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-slate-500/40 pointer-events-none z-20" />

      {/* Main Container — fills fixed viewport perfectly regardless of width */}
      <div className="flex flex-col gap-3 w-full h-full p-4 lg:px-5 lg:py-4 z-10 relative">

        {/* EXACT AETHER SECURITY REPLICA TOP BAR */}
        <header className="relative w-full shrink-0 z-10 flex flex-nowrap items-center justify-between bg-[#0a1216]/90 border border-cyan-500/20 rounded-2xl px-6 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden h-[120px] lg:h-[130px]">
          
          {/* Top/Bottom Cyan Edge Lines */}
          <div className="absolute top-0 left-12 w-48 h-[2px] bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
          <div className="absolute bottom-0 left-12 w-48 h-[2px] bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
          <div className="absolute top-0 right-12 w-48 h-[2px] bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
          <div className="absolute bottom-0 right-12 w-48 h-[2px] bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />

          {/* LEFT COLUMN: Logo & Profile */}
          <div className="flex-1 flex items-center h-full">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-cyan-400/20 blur-xl rounded-full" />
                <Shield className="w-10 h-10 text-cyan-400 drop-shadow-[0_0_8px_#22d3ee] relative z-10" strokeWidth={1.5} />
                <div className="absolute text-cyan-50 font-bold text-lg drop-shadow-[0_0_5px_#fff] mt-0.5 z-20">A</div>
              </div>
              <div className="flex flex-col leading-tight justify-center">
                <span className="text-xl md:text-2xl font-bold text-white tracking-widest drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">AETHER</span>
                <span className="text-sm text-cyan-400 tracking-[0.2em] font-light">SECURITY</span>
              </div>
            </div>
            
            {/* Profile */}
            <div className="flex items-center gap-4 ml-8 xl:ml-12">
              <div className="relative flex flex-col items-center">
                <div className="relative w-14 h-14 mb-1">
                   {/* glowing avatar ring */}
                   <div className="absolute inset-0 rounded-full border-2 border-cyan-400 shadow-[0_0_10px_#22d3ee,inset_0_0_10px_#22d3ee] animate-[pulse_3s_ease-in-out_infinite]" />
                   <div className="absolute top-[3px] left-[3px] right-[3px] bottom-[3px] rounded-full overflow-hidden bg-black flex items-center justify-center relative z-10">
                     <User className="w-8 h-8 text-cyan-900 absolute opacity-50" />
                     <img src="/skull.jpg" className="w-full h-full object-cover opacity-80 mix-blend-screen relative z-10" />
                   </div>
                </div>
                <div className="text-[9px] text-cyan-100 uppercase tracking-widest font-semibold mt-1">OP: <span className="text-white">{user?.displayName || 'NOVA_K'}</span></div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[7px] text-cyan-500/80">XP/Status</span>
                  <div className="flex gap-[1px]">
                    {Array.from({length: 8}).map((_, i) => (
                       <div key={i} className={`w-2 h-1 ${i < (userLevel % 8) ? 'bg-cyan-400 shadow-[0_0_4px_#22d3ee]' : 'bg-cyan-900/40'}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER COLUMN: Hero Arc Gauge */}
          <div className="flex-[1.2] lg:flex-[1.5] flex justify-center items-end h-[140px] relative px-4 pointer-events-none -mt-4">
            <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible absolute bottom-0">
              <defs>
                <filter id="red-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="gauge-cyan-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="rgba(34,211,238,0)" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              
              {/* Outer Cyan brackets */}
              <path d="M 25 110 A 85 85 0 0 1 40 45" fill="none" stroke="url(#gauge-cyan-grad)" strokeWidth="4" filter="url(#cyan-glow)" strokeLinecap="round" />
              <path d="M 175 110 A 85 85 0 0 0 160 45" fill="none" stroke="url(#gauge-cyan-grad)" strokeWidth="4" filter="url(#cyan-glow)" strokeLinecap="round" />
              
              {/* background red arc */}
              <path d="M 45 110 A 65 65 0 0 1 155 110" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="18" />
              
              {/* Segmented outer red ring */}
              <path d="M 40 110 A 70 70 0 0 1 160 110" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 4" filter="url(#red-glow)" />
              
              {/* Inner dynamic solid red arc - Length ~204 */}
              <path d="M 45 110 A 65 65 0 0 1 155 110" fill="none" stroke="#ef4444" strokeWidth="18" filter="url(#red-glow)" strokeDasharray="204" strokeDashoffset={204 - ((displayedScore / 10) * 204)} strokeLinecap="butt" />
              
              {/* Marker dot on arc end (mapped to same angle) */}
              <g transform={`rotate(${-90 + (displayedScore / 10) * 180}, 100, 110)`}>
                <rect x="155" y="103" width="8" height="14" fill="#ffffff" filter="url(#red-glow)" rx="2" />
              </g>
            </svg>
            
            {/* Center Gauge Text & Status */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
              <div className="text-[8px] md:text-[9px] text-[#ff6b6b] drop-shadow-[0_0_5px_#ef4444] font-medium tracking-[0.2em] mb-1">GLOBAL THREAT: <span className="text-white font-bold">{threatInfo.text.toUpperCase()}</span></div>
              <div className="flex items-baseline gap-1 mb-1 relative">
                <span className="text-4xl md:text-5xl text-red-500 font-bold drop-shadow-[0_0_8px_#ef4444]">{displayedScore.toFixed(1)}</span>
                <span className="text-sm md:text-base text-red-500/70 font-bold">/ 10</span>
              </div>
              
              <div className="flex gap-2">
                <AlertTriangle className={`w-3.5 h-3.5 ${displayedScore > 3 ? 'text-red-500 fill-red-500 filter drop-shadow-[0_0_5px_#ef4444]' : 'text-red-900/40 fill-red-900/40'}`} />
                <span className="text-red-500/50 text-[10px] font-bold">- - -</span>
                <AlertTriangle className={`w-3.5 h-3.5 ${displayedScore > 6 ? 'text-red-500 fill-red-500 filter drop-shadow-[0_0_5px_#ef4444]' : 'text-red-900/40 fill-red-900/40'}`} />
                <span className="text-red-500/50 text-[10px] font-bold">- - -</span>
                <AlertTriangle className={`w-3.5 h-3.5 ${displayedScore > 8 ? 'text-red-500 fill-red-500 filter drop-shadow-[0_0_5px_#ef4444]' : 'text-red-900/40 fill-red-900/40'}`} />
              </div>
              
              <div className="text-[8px] md:text-[9px] text-[#a0aec0] tracking-widest mt-1">ALERT STATUS: <span className={displayedScore > 6 ? 'text-red-500 font-bold drop-shadow-[0_0_5px_#ef4444]' : 'text-cyan-400 font-bold'}>{displayedScore > 6 ? 'HIGH' : 'ELEVATED'}</span></div>
            </div>
          </div>

          {/* RIGHT COLUMN: Time & Controls */}
          <div className="flex-1 flex flex-col justify-between items-end h-full">
            {/* Top icons */}
            <div className="flex items-center gap-5 text-cyan-400 mt-1">
              <Wifi className="w-5 h-5 filter drop-shadow-[0_0_5px_#22d3ee] animate-pulse" />
              <div className="relative">
                <Bell className="w-5 h-5 filter drop-shadow-[0_0_5px_#22d3ee]" />
                <div className="absolute top-0 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_5px_#ef4444] border-2 border-[#0a1216]" />
              </div>
              <Settings className="w-5 h-5 text-gray-400 hover:text-white transition-colors cursor-pointer" />
            </div>
            
            {/* Time & User Badge Container */}
            <div className="flex items-center gap-4 xl:gap-8 mt-2 w-full justify-end">
              <div className="flex flex-col items-start translate-x-2">
                <div className="text-3xl md:text-4xl text-cyan-50 font-mono tracking-widest drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">{time} <span className="text-lg text-cyan-200/80">UTC</span></div>
                <div className="text-[10px] text-[#64748b] tracking-widest mt-0.5 uppercase font-medium">
                  {new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
                </div>
              </div>
              
              <div className="bg-[#121c24] border-l border-b border-t-0 border-r-0 border-cyan-500/30 rounded-bl-xl px-4 py-2 flex items-center justify-between min-w-[150px] shadow-[inset_0_-2px_10px_rgba(0,0,0,0.5)] cursor-pointer hover:bg-[#16222b]">
                <div className="flex flex-col">
                  <span className="text-[10px] text-white tracking-widest font-semibold uppercase">{user?.displayName || 'N. KORSAKOVA'}</span>
                  <span className="text-[9px] text-cyan-400 mt-0.5 tracking-wider font-bold drop-shadow-[0_0_5px_#22d3ee]">ONLINE</span>
                </div>
                <ChevronDown className="w-4 h-4 text-cyan-500" />
              </div>
            </div>

            {/* Bottom Status Pills */}
            <div className="flex items-center gap-2 xl:gap-4 mt-2 mb-1">
              <div className="border-[1.5px] border-red-500/60 bg-[#2a0e14] rounded-full px-4 py-1.5 text-[9px] text-red-500 font-bold tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.15)] md:px-5">
                THREATS: {activeAlerts + Math.floor(displayedScore)}
              </div>
              <div className="border-[1.5px] border-yellow-500/60 bg-[#2a1e0b] rounded-full px-4 py-1.5 text-[9px] text-yellow-500 font-bold tracking-wider shadow-[0_0_10px_rgba(234,179,8,0.15)] md:px-5">
                WARNINGS: {attacks.length + 12}
              </div>
              <div className="border-[1.5px] border-cyan-500/60 bg-[#0e212a] rounded-full px-4 py-1.5 text-[9px] text-cyan-400 font-bold tracking-wider shadow-[0_0_10px_rgba(34,211,238,0.15)] md:px-5">
                SECURED: 852
              </div>
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
            <ThreatMapWidget attacks={attacks} />
          </div>

          <div className="lg:col-span-3 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <TerminalLogWidget attacks={attacks} />
          </div>

          {/* BOTTOM ROW */}
          <div className="lg:col-span-9 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]">
            <CveFeedWidget cves={cves} />
          </div>


          <div className="lg:col-span-3 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)] flex flex-col">
            <div className="flex justify-between items-center px-4 py-3 border-b border-[#00ff41]/20 bg-[#021518]/80 shrink-0">
              <span className="text-[11px] font-bold text-slate-200 tracking-widest uppercase">GEO-ANALYTICS</span>
              <span className="text-slate-500 tracking-widest text-[10px]">...</span>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden">
              {/* Mini world map using SVG mask */}
              <div className="w-full h-full relative flex items-center justify-center">
                <svg viewBox="0 0 600 300" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <mask id="geo-mask">
                      <image href="/world.svg" x="0" y="0" width="600" height="300" />
                    </mask>
                  </defs>
                  {/* Bright teal landmass — highly visible */}
                  <rect x="0" y="0" width="600" height="300" fill="#1a4a3a" mask="url(#geo-mask)" opacity="1" />
                  <rect x="0" y="0" width="600" height="300" fill="#22d3ee" mask="url(#geo-mask)" opacity="0.08" />
                  {/* Threat blips — spread globally */}
                  {/* Europe */}
                  <circle cx="295" cy="108" r="3" fill="#ef4444" className="animate-pulse" />
                  {/* US East */}
                  <circle cx="148" cy="118" r="5" fill="#ef4444" className="animate-pulse" />
                  <circle cx="148" cy="118" r="10" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.5" className="animate-ping" />
                  {/* Russia */}
                  <circle cx="370" cy="88" r="4" fill="#ef4444" className="animate-pulse" style={{animationDelay:'0.5s'}} />
                  <circle cx="370" cy="88" r="9" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4" className="animate-ping" style={{animationDelay:'0.5s'}} />
                  {/* China */}
                  <circle cx="445" cy="122" r="5" fill="#ef4444" className="animate-pulse" style={{animationDelay:'0.3s'}} />
                  <circle cx="445" cy="122" r="11" fill="none" stroke="#ef4444" strokeWidth="0.8" opacity="0.35" className="animate-ping" />
                  {/* Brazil */}
                  <circle cx="190" cy="198" r="3" fill="#22d3ee" className="animate-pulse" />
                  {/* South Africa */}
                  <circle cx="308" cy="218" r="3" fill="#22d3ee" style={{animationDelay:'0.7s'}} />
                  {/* India */}
                  <circle cx="400" cy="152" r="3" fill="#22d3ee" className="animate-pulse" style={{animationDelay:'0.2s'}} />
                  {/* Connection arcs */}
                  <path d="M 295 108 Q 330 95 370 88" stroke="rgba(239,68,68,0.5)" strokeWidth="0.8" fill="none" />
                  <path d="M 295 108 Q 370 95 445 122" stroke="rgba(239,68,68,0.5)" strokeWidth="0.8" fill="none" />
                  <path d="M 295 108 Q 220 112 148 118" stroke="rgba(34,211,238,0.5)" strokeWidth="0.8" fill="none" />
                  <path d="M 295 108 Q 245 155 190 198" stroke="rgba(34,211,238,0.3)" strokeWidth="0.7" fill="none" />
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
