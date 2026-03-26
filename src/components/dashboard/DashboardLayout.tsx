'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CveFeedWidget from './CveFeedWidget';
import ThreatMapWidget from './ThreatMapWidget';
import SystemMonitorWidget from './SystemMonitorWidget';
import LiveIntelFeedWidget from './LiveIntelFeedWidget';
import NetworkTrafficWidget from './NetworkTrafficWidget';
import { Shield, Bell, LogOut, AlertTriangle, Globe } from 'lucide-react';
import { useAuthSession, logoutAuth } from '@/lib/auth-client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { AttackEvent, CVEItem, NewsItem, WorkflowMetrics } from '@/lib/dashboard-types';


export default function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const session = useAuthSession(null);
  const user = session?.user;
  const router = useRouter();
  const pathname = usePathname();

  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [cves, setCves] = useState<CVEItem[]>([]);
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [streamMode, setStreamMode] = useState<'connecting' | 'live' | 'degraded'>('connecting');
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);

  const [threatScore, setThreatScore] = useState(2.5);
  const [displayedScore, setDisplayedScore] = useState(2.5);
  const [activeAlerts, setActiveAlerts] = useState(0);

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
      if (newsRes.ok) { const p = await newsRes.json(); setNewsItems(p.items ?? []); }
      if (cvesRes.ok) { const p = await cvesRes.json(); setCves((p.cves ?? []).slice(0, 10)); }
    } catch (e) { }
  }, []);

  useEffect(() => {
    setMounted(true);
    const updateClock = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { void loadIntelPanels(); const i = setInterval(() => { void loadIntelPanels(); }, 60_000); return () => clearInterval(i); }, [loadIntelPanels]);
  useEffect(() => { void fetchCorePanels(); const i = setInterval(() => { void fetchCorePanels(); }, 15_000); return () => clearInterval(i); }, [fetchCorePanels]);

  useEffect(() => {
    let disposed = false;
    const fetchAttack = async () => {
      if (disposed) return;
      try {
        const res = await fetch('/api/live-attacks', { cache: 'no-store' });
        if (res.ok) {
          const payload = await res.json() as AttackEvent;
          if (payload && payload.id) { setAttacks(prev => [...prev, payload].slice(-15)); setStreamMode('live'); }
        } else { setStreamMode('degraded'); }
      } catch { setStreamMode('degraded'); }
    };
    void fetchAttack(); setStreamMode('live');
    const attackInterval = setInterval(() => { void fetchAttack(); }, 90_000);
    return () => { disposed = true; clearInterval(attackInterval); };
  }, []);

  useEffect(() => {
    let baseScore = 2.5;
    if (metrics) { baseScore = Math.max(2.0, Math.min(6.0, metrics.attack.liveDensity || 2.0)); }
    setThreatScore(Math.min(10.0, baseScore + attacks.length * 0.4));
    setActiveAlerts((metrics?.shiftSnapshot.openCritical || 12) + Math.floor(attacks.length / 2));
  }, [attacks, metrics]);

  useEffect(() => {
    let animationFrame: number;
    let lastTime = performance.now();
    const animate = (t: number) => {
      const dt = t - lastTime; lastTime = t;
      setDisplayedScore(prev => {
        const diff = threatScore - prev;
        const noise = (Math.sin(t / 1000 * 3) * 0.5 + Math.sin(t / 1000 * 7) * 0.5) * 0.25 * (0.3 + threatScore / 10);
        let n = prev + diff * (dt * 0.005);
        if (Math.abs(diff) < 0.05) n = threatScore + noise;
        return Math.min(10, Math.max(0, n));
      });
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [threatScore]);

  if (!mounted) return null;

  const navItems = [
    { label: 'HOME', href: '/' },
    { label: 'BLOG', href: '/blog' },
    { label: 'COMMUNITY', href: '/community' },
    { label: 'CVE-RADAR', href: '/cve-radar' },
    { label: 'TIMELINE', href: '/breach-timeline' },
    { label: 'PORTFOLIO', href: '/portfolio' },
    { label: 'ABOUT', href: '/about' },
  ];
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));
  const warningCount = metrics?.shiftSnapshot.slaBreaches || 14;

  const cardStyle = "relative rounded-lg border border-cyan-500/20 bg-[#0a1020]/60 overflow-hidden shadow-[inset_0_0_30px_rgba(34,211,238,0.03)]";

  return (
    <div className="fixed inset-0 bg-[#050a14] text-slate-200 font-mono flex flex-col overflow-hidden select-none" style={{ zIndex: 10 }}>

      {/* ═══ TOP NAVBAR (RESPONSIVE) ═══ */}
      <header className="shrink-0 w-full flex flex-col bg-var(--bg-panel)/95 border-b border-cyan-500/25 relative z-[100]"
        style={{ boxShadow: '0 2px 30px rgba(34,211,238,0.1)' }}>
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
        
        <div className="flex items-center justify-between px-2 lg:px-4 py-2">
          {/* Logo & Branding */}
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 relative flex items-center justify-center shrink-0">
              <Shield className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--accent-cyan)] drop-shadow-[0_0_12px_var(--accent-cyan)]" strokeWidth={1.5} />
              <span className="absolute text-[7px] lg:text-[9px] font-black text-cyan-100 mt-1">C</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[var(--text-header)] font-black text-[var(--accent-cyan)] tracking-widest whitespace-nowrap" style={{ textShadow: '0 0 20px rgba(34,211,238,0.4)' }}>BREACH TERMINAL</span>
              <span className="text-[7px] lg:text-[10px] text-slate-500 tracking-[0.25em]">OS v4.1</span>
            </div>
          </div>

          {/* Desktop Right Settings */}
          <div className="hidden lg:flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-[var(--text-title)] font-bold rounded border border-red-500/50 bg-red-500/15 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)] touch-target">
              ⚡ THREATS: {activeAlerts}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-[var(--text-title)] font-bold rounded border border-amber-500/50 bg-amber-500/15 text-amber-400 touch-target">
              ⚠ WARNS: {warningCount}
            </span>
            <button className="text-slate-500 hover:text-cyan-400 transition-colors relative touch-target">
              <Bell className="w-5 h-5" />
              <span className="absolute top-[8px] right-[8px] w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-[#050a14]" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-slate-700/50">
              <div className="w-8 h-8 rounded-full border-2 border-green-500/60 overflow-hidden relative shadow-[0_0_10px_rgba(0,255,65,0.2)]">
                <img src="/skull.jpg" alt="avatar" className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[var(--accent-green)] rounded-full border-2 border-[#050a14]" />
              </div>
            </div>
            <button onClick={async () => { await logoutAuth(); router.push('/'); }}
              className="px-3 min-h-[44px] text-[var(--text-title)] font-bold tracking-widest text-red-400 border border-red-500/40 bg-red-500/5 hover:bg-red-500/20 transition-colors rounded">
              [ LOGOUT ]
            </button>
          </div>

          {/* Mobile Right Controls */}
          <div className="flex lg:hidden items-center gap-2">
             <button className="text-slate-500 hover:text-cyan-400 transition-colors relative touch-target px-2">
              <Bell className="w-5 h-5" />
              <span className="absolute top-[8px] right-[8px] w-2 h-2 bg-red-500 rounded-full animate-pulse border border-[#050a14]" />
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="touch-target px-2 text-[var(--accent-cyan)] flex flex-col justify-center items-center gap-1.5"
            >
              <div className={`w-6 h-[2px] bg-current transition-all ${isMobileMenuOpen ? 'rotate-45 translate-y-[8px]' : ''}`} />
              <div className={`w-6 h-[2px] bg-current transition-all ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
              <div className={`w-6 h-[2px] bg-current transition-all ${isMobileMenuOpen ? '-rotate-45 -translate-y-[8px]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-1 px-4 pb-2">
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`touch-target px-3 text-[10px] font-bold tracking-widest transition-all duration-200 relative ${
                  active ? 'text-[var(--accent-cyan)]' : 'text-slate-500 hover:text-slate-300'
                }`}>
                {item.label}
                {active && <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)] rounded-full" />}
              </Link>
            );
          })}
        </nav>

        {/* Mobile slide-in Drawer */}
        <div className={`lg:hidden flex flex-col overflow-hidden transition-all duration-300 bg-var(--bg-panel)/95 border-b border-[var(--accent-cyan)]/30 ${isMobileMenuOpen ? 'max-h-[70vh]' : 'max-h-0 border-transparent opacity-0 pointer-events-none'}`}>
          <div className="flex flex-col p-2 gap-1">
             <div className="flex justify-between items-center mb-2 px-3 py-2 bg-red-500/5 rounded border border-red-500/20">
                <span className="text-[var(--text-title)] text-red-500 font-bold">THREATS: {activeAlerts}</span>
                <span className="text-[var(--text-title)] text-amber-500 font-bold">WARNS: {warningCount}</span>
             </div>
            
            {navItems.map(item => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`touch-target px-4 w-full text-left text-[var(--text-title)] font-bold tracking-widest transition-all duration-200 ${
                    active ? 'text-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 border-l-2 border-[var(--accent-cyan)]' : 'text-slate-400 hover:bg-slate-800/50'
                  }`}>
                  {item.label}
                </Link>
              );
            })}
            
            <button onClick={async () => { await logoutAuth(); router.push('/'); }}
              className="touch-target w-full mt-2 text-center text-[var(--text-title)] font-bold tracking-widest text-red-400 border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 rounded">
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      {/* ═══ DASHBOARD — RESPONSIVE GRID LAYOUT ═══ */}
      {/* 
        Mobile (<1024px): Single column, natural flex layout, scrolls vertically.
        Desktop (>=1024px): CSS Grid (12 cols, 2 specific rows), fills viewport, no scroll.
      */}
      <div className="flex-1 w-full p-2 overflow-y-auto lg:overflow-hidden flex flex-col lg:grid lg:grid-cols-12 lg:grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-3">

        {/* ─── LIVE INTEL FEED ─── */}
        <div className={`lg:col-span-3 min-h-[400px] lg:min-h-0 h-full ${cardStyle}`}>
          <LiveIntelFeedWidget attacks={attacks} threatScore={displayedScore} />
        </div>

        {/* ─── CYBER THREAT MAP ─── */}
        <div className={`lg:col-span-6 min-h-[350px] lg:min-h-0 h-full ${cardStyle}`}>
          <ThreatMapWidget attacks={attacks} />
        </div>

        {/* ─── SYSTEM STATUS & CVE ─── */}
        <div className="lg:col-span-3 min-h-max lg:min-h-0 h-full flex flex-col gap-3">
          <div className={`flex-[1.2] min-h-[250px] lg:min-h-0 ${cardStyle}`}>
            <SystemMonitorWidget />
          </div>
          <div className={`flex-1 min-h-[350px] lg:min-h-0 ${cardStyle}`}>
            <CveFeedWidget cves={cves} />
          </div>
        </div>

        {/* ─── NETWORK TRAFFIC ─── */}
        <div className={`lg:col-span-7 lg:row-start-2 min-h-[350px] lg:min-h-0 h-full ${cardStyle}`}>
          <NetworkTrafficWidget />
        </div>

        {/* ─── GEO-ANALYTICS ─── */}
        <div className={`lg:col-span-5 lg:row-start-2 min-h-[300px] lg:min-h-0 h-full flex flex-col ${cardStyle}`}>
          <div className="flex justify-between items-center px-3 py-2 border-b border-cyan-500/15 bg-var(--bg-panel)/80 shrink-0">
            <span className="text-[var(--text-title)] font-bold text-slate-300 tracking-widest uppercase">// GEO-ANALYTICS</span>
            <span className="text-slate-600 text-[9px]">⋮</span>
          </div>
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <svg viewBox="0 0 600 300" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                <mask id="geo-mask-v2"><image href="/world.svg" x="0" y="0" width="600" height="300" /></mask>
                <radialGradient id="heatRed" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="var(--threat-red)" stopOpacity="0.9" /><stop offset="40%" stopColor="var(--warning-orange)" stopOpacity="0.5" /><stop offset="100%" stopColor="var(--warning-orange)" stopOpacity="0" /></radialGradient>
                <radialGradient id="heatCyan" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.7" /><stop offset="50%" stopColor="var(--accent-cyan)" stopOpacity="0.2" /><stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" /></radialGradient>
              </defs>
              <rect x="0" y="0" width="600" height="300" fill="var(--bg-primary)" mask="url(#geo-mask-v2)" />
              <rect x="0" y="0" width="600" height="300" fill="var(--accent-cyan)" mask="url(#geo-mask-v2)" opacity="0.06" />
              <circle cx="370" cy="88" r="35" fill="url(#heatRed)" className="animate-pulse" />
              <circle cx="445" cy="122" r="30" fill="url(#heatRed)" className="animate-pulse" style={{animationDelay:'0.3s'}} />
              <circle cx="148" cy="118" r="28" fill="url(#heatRed)" className="animate-pulse" style={{animationDelay:'0.5s'}} />
              <circle cx="295" cy="108" r="22" fill="url(#heatRed)" />
              <circle cx="190" cy="198" r="18" fill="url(#heatCyan)" />
              <circle cx="400" cy="152" r="16" fill="url(#heatCyan)" className="animate-pulse" style={{animationDelay:'0.2s'}} />
              <circle cx="520" cy="200" r="14" fill="url(#heatCyan)" />
              <circle cx="308" cy="218" r="12" fill="url(#heatCyan)" />
              <circle cx="370" cy="88" r="3" fill="var(--threat-red)" /><circle cx="445" cy="122" r="3" fill="var(--threat-red)" />
              <circle cx="148" cy="118" r="3" fill="var(--threat-red)" /><circle cx="295" cy="108" r="2.5" fill="var(--threat-red)" />
              <circle cx="190" cy="198" r="2" fill="var(--accent-cyan)" /><circle cx="400" cy="152" r="2" fill="var(--accent-cyan)" />
            </svg>
          </div>
          <div className="flex justify-between text-[var(--text-body)] text-slate-400 font-bold border-t border-cyan-500/15 px-3 py-1.5 bg-var(--bg-panel)/80 shrink-0">
            <span className="text-[var(--threat-red)] flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> ACTIVE ALERTS</span>
            <span className="text-[var(--accent-cyan)] flex items-center gap-1"><Globe className="w-3 h-3"/> GLOBAL</span>
          </div>
        </div>

      </div>
    </div>
  );
}
