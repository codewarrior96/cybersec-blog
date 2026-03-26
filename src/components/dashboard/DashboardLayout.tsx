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

      {/* ═══ TOP NAVBAR ═══ */}
      <header className="shrink-0 w-full flex flex-col bg-[#0a1020]/95 border-b border-cyan-500/25 relative z-20"
        style={{ boxShadow: '0 2px 30px rgba(34,211,238,0.1)' }}>
        {/* Cyan glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />

        {/* Top row: Logo + badges */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 relative flex items-center justify-center">
              <Shield className="w-10 h-10 text-cyan-400 drop-shadow-[0_0_12px_#22d3ee]" strokeWidth={1.5} />
              <span className="absolute text-[9px] font-black text-cyan-100 mt-1">C</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[18px] font-black text-cyan-400 tracking-widest" style={{ textShadow: '0 0 20px rgba(34,211,238,0.4)' }}>BREACH TERMINAL</span>
              <span className="text-[10px] text-slate-500 tracking-[0.25em]">OS v4.1</span>
            </div>
          </div>

          {/* Right: badges + controls */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded border border-red-500/50 bg-red-500/15 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)]">
              ⚡ THREATS: {activeAlerts}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded border border-amber-500/50 bg-amber-500/15 text-amber-400">
              ⚠ WARNS: {warningCount}
            </span>
            <button className="text-slate-500 hover:text-cyan-400 transition-colors relative">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-[#050a14]" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-slate-700/50">
              <div className="w-8 h-8 rounded-full border-2 border-green-500/60 overflow-hidden relative shadow-[0_0_10px_rgba(0,255,65,0.2)]">
                <img src="/skull.jpg" alt="avatar" className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00ff41] rounded-full border-2 border-[#050a14]" />
              </div>
            </div>
            <button onClick={async () => { await logoutAuth(); router.push('/'); }}
              className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-red-400 border border-red-500/40 bg-red-500/5 hover:bg-red-500/20 transition-colors rounded">
              [ LOGOUT ]
            </button>
          </div>
        </div>

        {/* Nav row */}
        <nav className="flex items-center gap-1 px-4 pb-2">
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`px-3 py-1 text-[10px] font-bold tracking-widest transition-all duration-200 relative ${
                  active ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                }`}>
                {item.label}
                {active && <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-cyan-400 shadow-[0_0_8px_#22d3ee] rounded-full" />}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* ═══ DASHBOARD GRID ═══
        Mockup layout:
        Row 1 (60%): [3col LiveIntel] [6col ThreatMap] [3col: SystemStatus top + CVE bottom]
        Row 2 (40%): [7col NetworkTraffic] [5col GeoAnalytics]
      */}
      <div className="flex-1 min-h-0 w-full grid grid-cols-12 grid-rows-[3fr_2fr] gap-2 p-2 overflow-hidden">

        {/* ─── ROW 1 LEFT: Live Intel Feed ─── */}
        <div className={`col-span-3 ${cardStyle}`}>
          <LiveIntelFeedWidget attacks={attacks} threatScore={displayedScore} />
        </div>

        {/* ─── ROW 1 CENTER: Cyber Threat Map ─── */}
        <div className={`col-span-6 ${cardStyle}`}>
          <ThreatMapWidget attacks={attacks} />
        </div>

        {/* ─── ROW 1 RIGHT: System Status (top) + CVE Feed (bottom) stacked ─── */}
        <div className="col-span-3 flex flex-col gap-2">
          <div className={`flex-[1.2] min-h-0 ${cardStyle}`}>
            <SystemMonitorWidget />
          </div>
          <div className={`flex-1 min-h-0 ${cardStyle}`}>
            <CveFeedWidget cves={cves} />
          </div>
        </div>

        {/* ─── ROW 2 LEFT: Network Traffic ─── */}
        <div className={`col-span-7 ${cardStyle}`}>
          <NetworkTrafficWidget />
        </div>

        {/* ─── ROW 2 RIGHT: Geo-Analytics ─── */}
        <div className={`col-span-5 ${cardStyle} flex flex-col`}>
          <div className="flex justify-between items-center px-3 py-2 border-b border-cyan-500/15 bg-[#0a1020]/80 shrink-0">
            <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">// GEO-ANALYTICS</span>
            <span className="text-slate-600 text-[9px]">⋮</span>
          </div>
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <div className="w-full h-full relative flex items-center justify-center">
              <svg viewBox="0 0 600 300" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <mask id="geo-mask-v2">
                    <image href="/world.svg" x="0" y="0" width="600" height="300" />
                  </mask>
                  <radialGradient id="heatRed" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                    <stop offset="40%" stopColor="#f97316" stopOpacity="0.5" />
                    <stop offset="70%" stopColor="#eab308" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="heatCyan" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
                    <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {/* Landmass */}
                <rect x="0" y="0" width="600" height="300" fill="#0d2a3a" mask="url(#geo-mask-v2)" />
                <rect x="0" y="0" width="600" height="300" fill="#22d3ee" mask="url(#geo-mask-v2)" opacity="0.06" />
                {/* Heatmap glows */}
                <circle cx="370" cy="88" r="35" fill="url(#heatRed)" className="animate-pulse" /> {/* Russia */}
                <circle cx="445" cy="122" r="30" fill="url(#heatRed)" className="animate-pulse" style={{animationDelay:'0.3s'}} /> {/* China */}
                <circle cx="148" cy="118" r="28" fill="url(#heatRed)" className="animate-pulse" style={{animationDelay:'0.5s'}} /> {/* USA */}
                <circle cx="295" cy="108" r="22" fill="url(#heatRed)" /> {/* Europe */}
                <circle cx="190" cy="198" r="18" fill="url(#heatCyan)" /> {/* Brazil */}
                <circle cx="400" cy="152" r="16" fill="url(#heatCyan)" className="animate-pulse" style={{animationDelay:'0.2s'}} /> {/* India */}
                <circle cx="520" cy="200" r="14" fill="url(#heatCyan)" /> {/* Australia */}
                <circle cx="308" cy="218" r="12" fill="url(#heatCyan)" /> {/* S. Africa */}
                {/* Bright dots */}
                <circle cx="370" cy="88" r="3" fill="#ef4444" />
                <circle cx="445" cy="122" r="3" fill="#ef4444" />
                <circle cx="148" cy="118" r="3" fill="#ef4444" />
                <circle cx="295" cy="108" r="2.5" fill="#ef4444" />
                <circle cx="190" cy="198" r="2" fill="#22d3ee" />
                <circle cx="400" cy="152" r="2" fill="#22d3ee" />
              </svg>
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 font-bold border-t border-cyan-500/15 px-3 py-1.5 bg-[#0a1020]/80 shrink-0">
            <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> ACTIVE ALERTS</span>
            <span className="text-cyan-400 flex items-center gap-1"><Globe className="w-3 h-3"/> GLOBAL</span>
          </div>
        </div>

      </div>
    </div>
  );
}
