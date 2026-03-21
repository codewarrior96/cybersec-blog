'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CveFeedWidget from './CveFeedWidget';
import ThreatMapWidget from './ThreatMapWidget';
import SystemMonitorWidget from './SystemMonitorWidget';
import TerminalLogWidget from './TerminalLogWidget';
import { Shield, User, AlertTriangle, ShieldCheck, Globe, Activity } from 'lucide-react';
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

        {/* SENTINEL OS V2 - ULTRA PREMIUM TOP BAR */}
        <header className="relative w-full shrink-0 z-10 flex flex-nowrap items-center justify-between border border-cyan-500/30 bg-gradient-to-r from-[#030b14]/80 via-[#021014]/80 to-[#030b14]/80 px-6 py-4 rounded-xl backdrop-blur-xl shadow-[0_0_30px_rgba(6,182,212,0.15)]">
          <div className="flex items-center gap-4 lg:gap-8 shrink-0">
            {/* Logo Section */}
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 flex items-center justify-center bg-cyan-500/10 border border-cyan-400/50 relative shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
              >
                <div className="absolute inset-0 bg-cyan-400/20 blur-md rounded-full animate-pulse" />
                <Shield className="text-cyan-400 w-6 h-6 drop-shadow-[0_0_8px_#22d3ee] relative z-10" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-sm md:text-base font-extrabold tracking-widest text-[#e2e8f0] drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">SENTINEL OS <span className="text-xs md:text-sm font-medium text-cyan-400 opacity-90 drop-shadow-[0_0_5px_#22d3ee]">v4.1</span></span>
                <span className="text-[10px] text-cyan-500/80 tracking-widest uppercase font-semibold mt-0.5">RANK: SHADOW_NODE</span>
              </div>
            </div>
            
            <div className="w-px h-10 bg-cyan-500/30 mx-2 hidden sm:block shadow-[0_0_10px_#22d3ee]" />

            {/* Profile Section */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="relative w-11 h-11 flex items-center justify-center">
                <div className="absolute inset-0 border-[2px] border-cyan-400/80 rounded-full animate-[spin_4s_linear_infinite] border-t-transparent shadow-[0_0_10px_#22d3ee]" />
                <div className="w-9 h-9 rounded-full overflow-hidden border border-cyan-900 bg-[#00111a] shadow-[inset_0_0_10px_rgba(6,182,212,0.5)] relative z-10">
                  <img src="/skull.jpg" alt="operator avatar" className="w-full h-full object-cover rounded-full mix-blend-screen opacity-90" />
                </div>
              </div>
              <div className="flex flex-col w-28 justify-center">
                <span className="text-xs font-bold text-cyan-300 tracking-wider uppercase truncate drop-shadow-[0_0_3px_#22d3ee]">{user?.displayName || 'SHADOW_NODE'}</span>
                <span className="text-[10px] text-cyan-500/90 mb-1 font-medium">Level <span className="text-cyan-200">{userLevel}</span></span>
                <div className="relative w-full h-1.5 bg-[#010a0f] border border-cyan-900/50 rounded-full overflow-hidden shadow-[inset_0_0_3px_#000]">
                  <div className="absolute inset-0 bg-cyan-400/20 blur-sm" style={{ width: `${userXp}%` }} />
                  <div className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-200 rounded-full relative z-10" style={{ width: `${userXp}%`, boxShadow: '0 0 8px #22d3ee, 0 0 2px #fff' }} />
                </div>
              </div>
            </div>

            <div className="w-px h-10 bg-cyan-500/30 mx-2 hidden xl:block shadow-[0_0_10px_#22d3ee]" />

            {/* Threat Level Section */}
            <div className="hidden xl:flex items-center gap-5">
              <div className="flex flex-col justify-center">
                <div className="text-[10px] md:text-[11px] text-cyan-100/70 font-bold tracking-[0.2em] mb-2 flex justify-between items-center">
                  <span>GLOBAL THREAT LEVEL: <span className={`font-extrabold ml-1 ${threatInfo.color} ${threatInfo.glow} drop-shadow-[0_0_8px_currentColor]`}>{threatInfo.text} <span className="text-white/90">({displayedScore.toFixed(1)})</span></span></span>
                </div>
                
                {/* Visual grid tracker - GLOWING EFFECT */}
                <div className="relative">
                  <div className="flex gap-[3px] items-center">
                    {Array.from({length: 40}).map((_, i) => {
                      const ratio = i / 40;
                      // Dynamic gradient coloring mirroring aesthetic
                      let color = '#22d3ee'; 
                      if (ratio > 0.45 && ratio <= 0.75) color = '#ec4899';
                      if (ratio > 0.75) color = '#ef4444';
                      
                      const isActive = ratio <= (displayedScore / 10);

                      return (
                        <div 
                          key={i} 
                          className="h-4 w-1.5 rounded-[1px] transition-all duration-300"
                          style={{ 
                            backgroundColor: color, 
                            opacity: isActive ? 1 : 0.15,
                            boxShadow: isActive ? `0 0 8px ${color}` : undefined,
                            transform: isActive ? 'scaleY(1.1)' : 'scaleY(1)'
                          }} 
                        />
                      );
                    })}
                  </div>
                  {/* Slider Notch - Cyberpunk Arrow */}
                  <div className="absolute top-[3px] -translate-y-full transition-transform duration-100" style={{ left: `calc(${(displayedScore / 10) * 100}% - 4px)` }}>
                    <div className="w-[2px] h-5 bg-white shadow-[0_0_10px_#fff] relative z-20">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-white shadow-[0_0_8px_#fff]" />
                    </div>
                    <div className="absolute top-full text-[10px] left-1/2 -translate-x-1/2 text-white drop-shadow-[0_0_5px_#fff]" style={{ marginTop: '2px' }}>▼</div>
                  </div>
                </div>
              </div>
              
              {/* Premium Glow Arc Gauge */}
              <div className="w-16 h-10 relative flex items-end justify-center overflow-visible">
                <div className="absolute inset-0 rounded-full bg-cyan-500/5 blur-xl" />
                <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible relative z-10">
                  <defs>
                    <linearGradient id="premium-gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="50%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                    <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  
                  {/* Background Arc */}
                  <path d="M 5 45 A 40 40 0 0 1 95 45" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="8" strokeLinecap="round" />
                  
                  {/* Dynamic Colored Arc Dial equivalent styling */}
                  <path d="M 5 45 A 40 40 0 0 1 95 45" fill="none" stroke="url(#premium-gauge-grad)" strokeWidth="8" strokeLinecap="round" strokeDasharray="125" strokeDashoffset="25" filter="url(#gauge-glow)" opacity="0.8" />
                  
                  {/* Dial Center Base */}
                  <circle cx="50" cy="45" r="5" fill="#e2e8f0" filter="url(#gauge-glow)" />
                  <circle cx="50" cy="45" r="2" fill="#020810" />
                  
                  {/* Animated Arrow needle */}
                  <g transform={`rotate(${gaugeRotation}, 50, 45)`} className="transition-transform duration-100 origin-[50px_45px]">
                    <line x1="50" y1="45" x2="50" y2="15" stroke={threatInfo.color.replace('text-', '').replace(']', '').replace('[', '').replace('bg-', '') || "#ef4444"} strokeWidth="3" strokeLinecap="round" filter="url(#gauge-glow)" />
                    <polygon points="50,11 46,18 54,18" fill="white" filter="url(#gauge-glow)" />
                  </g>
                </svg>
              </div>
            </div>
          </div>
          
          {/* Right Stats - Glass Panel Effect */}
          <div className="flex flex-col items-end gap-1.5 pl-4 border-l border-cyan-500/20 py-1">
            <div className="text-lg lg:text-xl font-bold text-cyan-50 tracking-widest font-mono drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">{time}</div>
            <div className="flex gap-4 text-[10px] font-bold tracking-widest uppercase">
              <div className={`flex items-center gap-1.5 ${streamMode === 'live' ? 'text-cyan-400 drop-shadow-[0_0_5px_#22d3ee]' : streamMode === 'connecting' ? 'text-yellow-400' : 'text-red-500'}`}>
                <Activity className={`w-3 h-3 ${streamMode === 'live' ? 'animate-pulse' : ''}`} /> 
                {streamMode === 'live' ? 'LIVE' : streamMode === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
              </div>
              <div className="flex items-center gap-1.5 text-red-500 drop-shadow-[0_0_5px_#ef4444]">
                <AlertTriangle className="w-3 h-3" /> ALERTS: {activeAlerts}
              </div>
              <div className="flex items-center gap-1.5 text-cyan-400 opacity-80">
                <ShieldCheck className="w-3 h-3" /> SECURE
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
