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

    const fetchAttack = async () => {
      if (disposed) return;
      try {
        const res = await fetch('/api/live-attacks', { cache: 'no-store' });
        if (res.ok) {
          const payload = await res.json() as AttackEvent;
          if (payload && payload.id) {
            setAttacks((prev) => [...prev, payload].slice(-15));
            setStreamMode('live');
          }
        } else {
          setStreamMode('degraded');
        }
      } catch {
        setStreamMode('degraded');
      }
    };

    // Formally Server-Sent Events dispatched 'ready' followed by 'attack' per 90_000ms.
    void fetchAttack();
    setStreamMode('live');

    const attackInterval = setInterval(() => {
      void fetchAttack();
    }, 90_000);

    return () => {
      disposed = true;
      clearInterval(attackInterval);
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
        const intensity = threatScore / 10;
        const timeSec = currentTime / 1000;
        // Smooth sine-based jitter instead of rapid random noise
        const noise = (Math.sin(timeSec * 3) * 0.5 + Math.sin(timeSec * 7) * 0.5) * 0.25 * (0.3 + intensity);

        let newScore = prev + diff * (deltaTime * 0.005);
        if (Math.abs(diff) < 0.05) {
          newScore = threatScore + noise; // Apply smooth noise continuously when near target
        }

        return Math.min(10, Math.max(0, newScore));
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
    <div className="fixed inset-0 left-[280px] min-w-[1300px] max-h-[950px] bg-[#030608] text-[#00ff41] font-mono flex flex-col overflow-hidden select-none" style={{ zIndex: 10 }}>

      {/* Outer Corners */}
      <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-slate-500/40 pointer-events-none z-20" />
      <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-slate-500/40 pointer-events-none z-20" />
      <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-slate-500/40 pointer-events-none z-20" />
      <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-slate-500/40 pointer-events-none z-20" />

      {/* Main Container — fills fixed viewport perfectly regardless of width */}
      <div className="flex flex-col gap-3 w-full h-full p-4 px-5 py-4 z-10 relative">

        {/* EXACT AETHER SECURITY REPLICA TOP BAR (PIXEL PERFECT) */}
        <header className="relative w-full shrink-0 z-10 flex flex-row items-center justify-between bg-[#111A22] rounded-[16px] px-2 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-visible min-h-[120px] border border-[#2a3b4c] gap-0">

          {/* Inner glass overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

          {/* Top/Bottom Cyan Edge Lines (The Chamfered look) */}
          <div className="absolute top-0 left-8 right-8 h-[1px] bg-cyan-900/50" />
          <div className="absolute bottom-0 left-8 right-8 h-[1px] bg-cyan-900/50" />

          <div className="absolute top-0 left-12 w-64 h-[2px] bg-cyan-400 shadow-[0_0_15px_#22d3ee] rounded-b-md" />
          <div className="absolute bottom-0 left-12 w-64 h-[2px] bg-cyan-400 shadow-[0_0_15px_#22d3ee] rounded-t-md" />
          <div className="absolute top-0 right-12 w-64 h-[2px] bg-cyan-400 shadow-[0_0_15px_#22d3ee] rounded-b-md" />
          <div className="absolute bottom-0 right-12 w-64 h-[2px] bg-cyan-400 shadow-[0_0_15px_#22d3ee] rounded-t-md" />

          {/* LEFT COLUMN: Logo & Avatar */}
          <div className="flex-1 flex items-center justify-between justify-start h-full pl-2 pl-6 relative w-full w-auto">
            {/* Geometric Background Traces */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20 block" viewBox="0 0 300 120">
              <path d="M 0 60 L 50 60 L 60 40 L 150 40" fill="none" stroke="#22d3ee" strokeWidth="1" />
              <path d="M 0 80 L 100 80 L 120 100 L 200 100" fill="none" stroke="#22d3ee" strokeWidth="1" />
            </svg>

            {/* Logo Group */}
            <div className="flex items-center gap-3 xl:gap-4 z-10">
              <div className="w-10 h-10 w-14 h-14 relative flex items-center justify-center">
                <Shield className="w-10 h-10 w-14 h-14 text-cyan-400 drop-shadow-[0_0_10px_#22d3ee] fill-cyan-950/50" strokeWidth={1} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 w-8 h-8 clip-triangle border border-cyan-300 flex items-center justify-center bg-cyan-400/20" style={{ clipPath: 'polygon(50% 10%, 90% 90%, 10% 90%)' }}>
                    <span className="text-cyan-50 font-bold text-[10px] text-sm drop-shadow-[0_0_5px_#fff] mt-0.5 xl:mt-1">C</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-center translate-y-[-1px]">
                <span className="text-lg xl:text-2xl font-bold text-[#00ff41] tracking-[0.1em] drop-shadow-[0_0_8px_#00ff41]">BREACH TERMINAL</span>
                <span className="text-[10px] text-[12px] text-cyan-400 tracking-[0.25em] font-medium -mt-0.5 -mt-1">OS v4.1</span>
              </div>
            </div>

            {/* MOBILE ONLY: TRIPLE ICONS */}
            <div className="hidden items-center gap-3 text-cyan-400 z-10 pr-2 pb-1 relative">
              <button title="Network Status" className="hover:scale-110 transition-transform cursor-pointer">
                <Wifi className="w-4 h-4 filter drop-shadow-[0_0_8px_#22d3ee] animate-pulse" />
              </button>
              <button title="Alerts" className="relative hover:scale-110 transition-transform cursor-pointer">
                <Bell className="w-4 h-4 filter drop-shadow-[0_0_8px_#22d3ee]" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#111A22]" />
              </button>
              <button title="Settings" className="hover:scale-110 transition-transform cursor-pointer text-gray-400 hover:text-cyan-300">
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Vertical Divider */}
            <div className="block w-px h-16 bg-gradient-to-b from-transparent via-[#2a3b4c] to-transparent mx-10 z-10" />

            {/* Avatar Group - DESKTOP ONLY */}
            <div className="flex flex-col items-center justify-center z-10 w-24">
              <div className="relative w-16 h-16 shrink-0">
                <div className="absolute inset-0 rounded-full border-[2.5px] border-green-400 shadow-[0_0_15px_#4ade80,inset_0_0_10px_#4ade80] animate-[spin_4s_linear_infinite] border-r-transparent" />
                <div className="absolute inset-[3px] rounded-full overflow-hidden bg-[#0a1216]">
                  <img src="/skull.jpg" className="w-full h-full object-cover mix-blend-screen opacity-90 scale-110" />
                </div>
              </div>
              <div className="text-[9px] text-gray-400 uppercase tracking-widest mt-1.5 w-full text-center whitespace-nowrap">
                OP: <span className="text-white font-bold">{user?.displayName || 'NOVA_K'}</span>
              </div>
              <div className="flex items-center justify-center w-full gap-2 mt-0.5">
                <span className="text-[7.5px] text-gray-500 uppercase tracking-wider">XP/Status</span>
                <div className="flex gap-[2px]">
                  <div className="w-2.5 h-1.5 bg-green-400 shadow-[0_0_5px_#4ade80]" />
                  <div className="w-2.5 h-1.5 bg-green-400 shadow-[0_0_5px_#4ade80]" />
                  <div className="w-2.5 h-1.5 bg-green-400 shadow-[0_0_5px_#4ade80]" />
                  <div className="w-2.5 h-1.5 bg-green-400 shadow-[0_0_5px_#4ade80]" />
                  <div className="w-2.5 h-1.5 bg-green-900/50" />
                </div>
              </div>
            </div>
          </div>

          {/* CENTER COLUMN: Hero Arc Gauge (DESKTOP ONLY) */}
          <div className="flex flex-[1.5] relative items-end justify-center pb-2 w-auto h-full shrink-0">
            {/* The giant arc wrapper */}
            <div className="relative w-[300px] h-[130px] flex items-end justify-center overflow-hidden">
              <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible absolute bottom-0 left-0">
                <defs>
                  <filter id="gauge-red-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="gauge-cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <linearGradient id="cyan-arc-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="transparent" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>

                {/* Lateral thick cyan curved brackets hugging the arc */}
                <path d="M 2 100 L 10 100 A 75 75 0 0 1 35 35 L 50 35" fill="none" stroke="url(#cyan-arc-grad)" strokeWidth="3" filter="url(#gauge-cyan-glow)" />
                <path d="M 198 100 L 190 100 A 75 75 0 0 0 165 35 L 150 35" fill="none" stroke="url(#cyan-arc-grad)" strokeWidth="3" filter="url(#gauge-cyan-glow)" />

                {/* Subtle track background */}
                <path d="M 35 100 A 65 65 0 0 1 165 100" fill="none" stroke="#2a3b4c" strokeWidth="20" strokeLinecap="butt" opacity="0.4" />

                {/* Outer dashed gauge line (red) tightly hugging */}
                <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.8" />

                {/* Inner solid thick red arc fill! */}
                <path d="M 35 100 A 65 65 0 0 1 165 100" fill="none" stroke="#ef4444" strokeWidth="20" strokeLinecap="butt" filter="url(#gauge-red-glow)"
                  strokeDasharray="204.2" strokeDashoffset={204.2 - ((displayedScore / 10) * 204.2)}
                />

                {/* The white ticker line at the edge of the fill */}
                <g transform={`rotate(${-90 + (displayedScore / 10) * 180}, 100, 100)`}>
                  <line x1="165" y1="100" x2="145" y2="100" stroke="#fff" strokeWidth="3" filter="url(#gauge-red-glow)" />
                </g>
              </svg>

              {/* Text overlays perfectly positioned */}
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-[10px] z-10 w-full">
                <div className="text-[10px] text-gray-300 tracking-[0.2em] font-medium mb-1 drop-shadow-[0_0_5px_rgba(0,0,0,1)]">
                  GLOBAL THREAT: <span className="text-red-500 font-bold ml-1 drop-shadow-[0_0_5px_#ef4444]">{threatInfo.text.toUpperCase()}</span>
                </div>

                {/* Large score perfectly aligned on baseline */}
                <div className="flex items-baseline gap-1 pointer-events-none drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">
                  <span className="text-[56px] font-bold text-red-500 drop-shadow-[0_0_12px_#ef4444] tracking-tighter leading-none">{displayedScore.toFixed(1)}</span>
                  <span className="text-xl font-bold text-red-600 leading-none">/ 10</span>
                </div>

                {/* Warning Triangles exactly like Aether */}
                <div className="flex gap-2 items-center mt-1 -mb-1">
                  <AlertTriangle className={`w-3.5 h-3.5 ${displayedScore > 3 ? 'text-red-500 fill-red-500 filter drop-shadow-[0_0_5px_#ef4444]' : 'text-red-900/40 fill-red-900/40'}`} />
                  <span className="text-red-500/50 text-xs font-bold leading-none -translate-y-[2px]">...</span>
                  <AlertTriangle className={`w-3.5 h-3.5 ${displayedScore > 6 ? 'text-red-500 fill-red-500 filter drop-shadow-[0_0_5px_#ef4444]' : 'text-red-900/40 fill-red-900/40'}`} />
                  <span className="text-red-500/50 text-xs font-bold leading-none -translate-y-[2px]">...</span>
                  <AlertTriangle className={`w-3.5 h-3.5 ${displayedScore > 8 ? 'text-red-500 fill-red-500 filter drop-shadow-[0_0_5px_#ef4444]' : 'text-red-900/40 fill-red-900/40'}`} />
                </div>

                <div className="text-[9px] text-gray-400 tracking-widest mt-2 -mb-2">
                  ALERT STATUS: <span className={displayedScore > 6 ? 'text-red-500 font-bold drop-shadow-[0_0_5px_#ef4444]' : 'text-red-500/80 font-bold'}>{displayedScore > 6 ? 'HIGH' : 'ELEVATED'}</span>
                </div>
              </div>
            </div>
          </div>          {/* RIGHT COLUMN */}
          <div className="flex-[1.1] flex-[1.3] h-full pr-0 pr-8 flex flex-col justify-between items-center items-end relative py-2 z-10 w-full w-auto min-w-[360px] gap-4 gap-0">
            {/* Abstract Background Trace right behind icons */}
            <svg className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 300 120">
              <path d="M 300 30 L 250 30 L 230 50 L 100 50" fill="none" stroke="#22d3ee" strokeWidth="1" />
            </svg>

            {/* TOP ICONS ROW */}
            <div className="flex items-center gap-5 text-cyan-400 relative z-10">
              <button title="Network Status" className="hover:scale-110 transition-transform cursor-pointer">
                <Wifi className="w-4 h-4 filter drop-shadow-[0_0_8px_#22d3ee] animate-pulse" />
              </button>
              <button title="Alerts" className="relative hover:scale-110 transition-transform cursor-pointer mx-1">
                <Bell className="w-4 h-4 filter drop-shadow-[0_0_8px_#22d3ee]" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#111A22]" />
              </button>
              <button title="Settings" className="hover:scale-110 transition-transform cursor-pointer text-gray-400 hover:text-cyan-300">
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* MIDDLE ROW: TIME & USER BADGE */}
            <div className="flex flex-col sm:flex-row items-center gap-4 xl:gap-6 z-10 w-full justify-center xl:justify-end">
              {/* LARGE TIME & DATE */}
              <div className="flex flex-col justify-center items-center items-end text-center text-right mt-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[20px] sm:text-[24px] text-[34px] font-mono text-cyan-50 tracking-wider drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] leading-none">
                    {time.replace(' LOC', '').replace(' UTC', '')}
                  </span>
                  <span className="text-base sm:text-lg font-medium text-cyan-300/80 tracking-widest leading-none">UTC</span>
                </div>
                <span className="text-[9px] text-gray-400 font-mono tracking-[0.2em] mt-1 uppercase">
                  {mounted ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>

              {/* User Dropdown Badge - Made Interactive */}
              <button
                title="Profile & Status Options"
                className="bg-[#18232c]/80 border border-cyan-900/40 rounded-lg px-3 py-1.5 flex items-center justify-between min-w-[130px] shadow-[0_3px_8px_rgba(0,0,0,0.5)] hover:bg-[#1f2d38] hover:border-cyan-500/50 transition-all cursor-pointer active:scale-95"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-[9px] text-gray-300 tracking-[0.1em] font-bold uppercase truncate max-w-[90px]">{user?.displayName || 'N. KORSAKOVA'}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span className="text-[8px] text-cyan-400 tracking-[0.15em] font-bold mt-0.5">ONLINE</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-600 ml-1" />
              </button>
            </div>

            {/* BOTTOM STATUS PILLS */}
            <div className="flex flex-wrap items-center gap-1.5 lg:gap-3 z-10 justify-center xl:justify-end w-full pb-1">
              <button className="border border-red-500/50 hover:border-red-400 bg-[#2a0e14] hover:bg-[#3a131c] transition-colors cursor-pointer rounded-full px-2 sm:px-3 py-0.5 flex items-center justify-center text-[9px] text-red-500 font-bold tracking-[0.1em] shadow-[inset_0_0_8px_rgba(239,68,68,0.15)] active:scale-95">
                THREATS: {activeAlerts + Math.floor(displayedScore)}
              </button>
              <button className="border border-yellow-500/50 hover:border-yellow-400 bg-[#2a1e0b] hover:bg-[#3a290f] transition-colors cursor-pointer rounded-full px-2 sm:px-3 py-0.5 flex items-center justify-center text-[9px] text-yellow-500 font-bold tracking-[0.1em] shadow-[inset_0_0_8px_rgba(234,179,8,0.15)] active:scale-95">
                WARNINGS: {attacks.length + 12}
              </button>
              <button className="border border-cyan-500/40 hover:border-cyan-300 bg-[#0e212a] hover:bg-[#132d3a] transition-colors cursor-pointer rounded-full px-2 sm:px-3 py-0.5 flex items-center justify-center text-[9px] text-cyan-400 font-bold tracking-[0.1em] shadow-[inset_0_0_8px_rgba(34,211,238,0.15)] active:scale-95">
                SECURED: 852
              </button>
            </div>
          </div>
        </header>

        {/* Main Responsive Bento Grid — flex-1 to fill remaining height */}
        <div className="flex-1 min-h-0 w-full grid grid-cols-12 auto-rows-min grid-rows-[3fr_2fr] gap-3">

          {/* TOP ROW */}
          <div className="col-span-3 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)] min-h-0">
            <SystemMonitorWidget />
          </div>

          <div className="col-span-6 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)] min-h-0">
            <ThreatMapWidget attacks={attacks} />
          </div>

          <div className="col-span-3 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)] min-h-0">
            <TerminalLogWidget attacks={attacks} />
          </div>

          {/* BOTTOM ROW */}
          <div className="col-span-9 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)] min-h-0">
            <CveFeedWidget cves={cves} />
          </div>


          <div className="col-span-3 relative rounded-md border border-[#00ff41]/20 bg-[#021014]/60 overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.05)] flex flex-col min-h-0">
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
                  <circle cx="370" cy="88" r="4" fill="#ef4444" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <circle cx="370" cy="88" r="9" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4" className="animate-ping" style={{ animationDelay: '0.5s' }} />
                  {/* China */}
                  <circle cx="445" cy="122" r="5" fill="#ef4444" className="animate-pulse" style={{ animationDelay: '0.3s' }} />
                  <circle cx="445" cy="122" r="11" fill="none" stroke="#ef4444" strokeWidth="0.8" opacity="0.35" className="animate-ping" />
                  {/* Brazil */}
                  <circle cx="190" cy="198" r="3" fill="#22d3ee" className="animate-pulse" />
                  {/* South Africa */}
                  <circle cx="308" cy="218" r="3" fill="#22d3ee" style={{ animationDelay: '0.7s' }} />
                  {/* India */}
                  <circle cx="400" cy="152" r="3" fill="#22d3ee" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
                  {/* Connection arcs */}
                  <path d="M 295 108 Q 330 95 370 88" stroke="rgba(239,68,68,0.5)" strokeWidth="0.8" fill="none" />
                  <path d="M 295 108 Q 370 95 445 122" stroke="rgba(239,68,68,0.5)" strokeWidth="0.8" fill="none" />
                  <path d="M 295 108 Q 220 112 148 118" stroke="rgba(34,211,238,0.5)" strokeWidth="0.8" fill="none" />
                  <path d="M 295 108 Q 245 155 190 198" stroke="rgba(34,211,238,0.3)" strokeWidth="0.7" fill="none" />
                </svg>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-bold border-t border-[#00ff41]/20 px-4 py-2 bg-[#021518]/80 shrink-0">
              <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> ACTIVE ALERTS</span>
              <span className="text-cyan-400 flex items-center gap-1"><Globe className="w-3 h-3" /> GLOBAL</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
