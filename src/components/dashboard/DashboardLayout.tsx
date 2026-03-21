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

        {/* SENTINEL OS TOP BAR */}
        <header className="relative w-full shrink-0 z-10 flex flex-nowrap items-center justify-between border border-[#00ff41]/25 bg-[#021216]/90 px-5 py-3 rounded-md backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3 lg:gap-5 shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div 
                className="w-11 h-11 flex items-center justify-center bg-[#00ff41]/10 border border-[#00ff41]/50 relative shadow-[0_0_10px_rgba(0,255,65,0.2)]"
                style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
              >
                <Shield className="text-[#00ff41] w-5 h-5 drop-shadow-[0_0_3px_#00ff41]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-widest text-[#e2e8f0] glow-cyan">SENTINEL OS <span className="text-xs font-normal text-[#00ff41] opacity-90">v4.1</span></span>
                <span className="text-[9px] text-[#00ff41]/60 tracking-widest uppercase">RANK: SHADOW_NODE</span>
              </div>
            </div>
            
            <div className="w-px h-9 bg-[#00ff41]/20 mx-1 hidden sm:block" />

            {/* Profile */}
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full border border-cyan-500/60 overflow-hidden flex items-center justify-center bg-[#00111a] shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                <img src="/skull.jpg" alt="operator avatar" className="w-full h-full object-cover rounded-full" />
              </div>
              <div className="flex flex-col w-26">
                <span className="text-[11px] font-bold text-cyan-400 tracking-wider uppercase truncate max-w-[100px]">{user?.displayName || 'SHADOW_NODE'}</span>
                <span className="text-[9px] text-cyan-500/70 mb-0.5">Level {userLevel}</span>
                <div className="w-full h-1.5 bg-black border border-cyan-900/40 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_5px_#22d3ee]" style={{ width: `${userXp}%` }} />
                </div>
              </div>
            </div>

            <div className="w-px h-8 bg-[#00ff41]/20 mx-1 hidden xl:block" />

            {/* Threat Level */}
            <div className="hidden xl:flex items-center gap-4">
              <div className="flex flex-col">
                <div className="text-[10px] text-slate-300 font-medium tracking-widest mb-1.5 flex justify-between items-center">
                  <span>GLOBAL THREAT LEVEL: <span className={`font-bold ${threatInfo.color} ${threatInfo.glow}`}>{threatInfo.text} ({displayedScore.toFixed(1)})</span></span>
                </div>
                
                {/* Visual grid tracker with Handle Slider Notch */}
                <div className="relative">
                  <div className="flex gap-[2.5px] items-center">
                    {Array.from({length: 36}).map((_, i) => {
                      const ratio = i / 36;
                      // Dynamic gradient coloring mirroring the mockup blend Cyan -> Pink-Orange -> Red
                      let color = '#22d3ee'; 
                      if (ratio > 0.45 && ratio <= 0.75) color = '#ec4899';
                      if (ratio > 0.75) color = '#ef4444';
                      
                      const isActive = ratio <= (displayedScore / 10);

                      return (
                        <div 
                          key={i} 
                          className={`h-3.5 w-1 rounded-sm ${isActive ? 'shadow-[0_0_3px_currentColor]' : ''}`} 
                          style={{ 
                            backgroundColor: color, 
                            opacity: isActive ? 0.95 : 0.2,
                            boxShadow: isActive && ratio > 0.75 ? '0 0 6px rgba(239,68,68,0.8)' : undefined
                          }} 
                        />
                      );
                    })}
                  </div>
                  {/* Slider Notch marker mapped dynamically */}
                  <div className="absolute top-[3px] -translate-y-full" style={{ left: `calc(${(displayedScore / 10) * 100}% - 2px)` }}>
                    <div className="w-[1.5px] h-4 bg-slate-200 shadow-sm relative z-20">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-[1px] bg-slate-200" />
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 text-slate-300 text-[8px]" style={{ marginTop: '2.5px' }}>▲</div>
                  </div>
                </div>
              </div>
              
              {/* Gauge Redesigned as SVG Arc */}
              <div className="w-14 h-8 relative flex items-end justify-center overflow-hidden">
                <svg viewBox="0 0 100 50" className="w-full h-full">
                  <defs>
                    <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="60%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>
                  {/* Background Arc */}
                  <path d="M 10 45 A 35 35 0 0 1 90 45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round" />
                  {/* Colored Arc Dial */}
                  <path d="M 10 45 A 35 35 0 0 1 90 45" fill="none" stroke="url(#gauge-grad)" strokeWidth="6" strokeLinecap="round" strokeDasharray="125" strokeDashoffset="25" />
                  
                  {/* Center Dot */}
                  <circle cx="50" cy="45" r="4" fill="#cbd5e1" />
                  <circle cx="50" cy="45" r="1.5" fill="#0b1318" />
                  
                  {/* Arrow needle based on dynamic angle */}
                  <g transform={`rotate(${gaugeRotation}, 50, 45)`}>
                    <line x1="50" y1="45" x2="50" y2="18" stroke={threatInfo.color.replace('text-', '').replace(']', '').replace('[', '').replace('bg-', '') || "#ef4444"} strokeWidth="2.5" strokeLinecap="round" />
                    <polygon points="50,16 48,22 52,22" fill={threatInfo.color.replace('text-', '').replace(']', '').replace('[', '').replace('bg-', '') || "#ef4444"} />
                  </g>
                </svg>
              </div>
            </div>
          </div>
          
          {/* Right Stats */}
          <div className="flex flex-col items-end gap-0.5">
            <div className="text-base lg:text-lg font-medium text-[#e2e8f0] tracking-wider font-mono">{time}</div>
            <div className="flex gap-3 text-[9px] font-medium tracking-wide">
              <div className={`flex items-center gap-1 ${streamMode === 'live' ? 'text-[#00ff41]' : streamMode === 'connecting' ? 'text-yellow-500' : 'text-red-500'}`}>
                <Activity className={`w-2.5 h-2.5 ${streamMode === 'live' ? 'animate-pulse' : ''}`} /> 
                {streamMode === 'live' ? 'Active' : streamMode === 'connecting' ? 'Connecting' : 'Degraded'}
              </div>
              <div className="flex items-center gap-1 text-red-500"><AlertTriangle className="w-2.5 h-2.5" /> Alerts: {activeAlerts}</div>
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
