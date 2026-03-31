'use client'

import { useMemo } from 'react'
import type { AttackEvent } from '@/lib/dashboard-types'
import { useSocRuntime } from '@/lib/soc-runtime/use-soc-runtime'
import { CRITICAL_EFFECT_TOKENS } from '@/lib/soc-runtime/critical-effects'
import CountUp from '@/components/CountUp'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import { ArrowUp, TriangleAlert, ShieldAlert, CheckCircle2, ChevronRight, Activity } from 'lucide-react'

// --- HELPER COMPONENTS ---

function DarkCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#141822] border-[1px] border-[#252a38] rounded-md overflow-hidden relative ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ title, rightNode }: { title: string; rightNode?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[#252a38]">
      <h2 className="text-[13px] font-semibold text-slate-300 tracking-wide uppercase">{title}</h2>
      {rightNode}
    </div>
  )
}

function HalfGauge({ value, max = 100, label, color, size = 200 }: { value: number; max?: number; label: string; color: string; size?: number }) {
  const data = [
    { name: 'Value', value: value },
    { name: 'Empty', value: max - value }
  ]
  const cx = size / 2
  const cy = size / 1.5

  return (
    <div className="relative flex items-center justify-center flex-col" style={{ width: size, height: size * 0.75 }}>
      <div className="absolute top-0 left-0 w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="75%"
              startAngle={180}
              endAngle={0}
              innerRadius={size * 0.3}
              outerRadius={size * 0.4}
              cornerRadius={4}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              <Cell key="cell-0" fill={color} />
              <Cell key="cell-1" fill="#292e40" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Gauge Arc Overlay for styling */}
      <div className="absolute top-[20%] z-10 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[44px] leading-none font-bold" style={{ color }}>{value}</span>
        <span className="text-sm font-bold tracking-wider pt-1" style={{ color }}>{label.toUpperCase()}</span>
      </div>
    </div>
  )
}

const COUNTRY_COORDS: Record<string, { x: number; y: number }> = {
  'united states': { x: 21, y: 36 },
  usa: { x: 21, y: 36 },
  russia: { x: 63, y: 22 },
  china: { x: 72, y: 39 },
  uk: { x: 45, y: 28 },
  brazil: { x: 32, y: 69 },
}
function resolveCountryCoords(country: string) {
  const normalized = country.toLowerCase().trim()
  const found = Object.entries(COUNTRY_COORDS).find(([name]) => normalized.includes(name) || name.includes(normalized))
  return found ? found[1] : { x: 50 + (Math.random() * 20 - 10), y: 50 + (Math.random() * 20 - 10) } // Random fallback
}

// --- MAIN LAYOUT ---

export default function DashboardLayout() {
  const { mounted, snapshot, actions } = useSocRuntime({
    overlayDurationMs: CRITICAL_EFFECT_TOKENS.overlayDurationMs,
  })

  // Derived Data
  const attacks = [...snapshot.attacks].reverse()
  const recentAttacks = attacks.slice(0, 100)
  
  // KPI Metrics
  const totalIncidents = snapshot.alertCount || Math.floor(Math.random() * 2000)
  const criticalAlerts = snapshot.criticalQueue.length || 65
  const activeThreats = totalIncidents + (snapshot.metrics?.triageBoard.inProgress || 0)
  const systemVulnerabilities = 342 // Mocked to match image
  const networkActivity = 98 // Mocked percentage

  // Risk Score calculation
  const riskScore = Math.min(99, Math.max(12, Math.round((criticalAlerts * 2.5) + (snapshot.metrics?.attack.liveDensity || 0) * 5)))
  const riskLevelText = riskScore > 75 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW'
  const riskColor = riskScore > 75 ? '#ef4444' : riskScore > 40 ? '#f59e0b' : '#10b981'

  // Time Series Data for "TUM SHARE" chart
  const timeSeriesData = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => ({
      time: i,
      network: 400 + Math.random() * 600,
      threats: 100 + Math.random() * 800 * (i % 5 === 0 ? 1.5 : 0.5)
    }))
  }, [])

  // Asset Status Mock Data
  const assetStatus = [
    { name: 'Servers', count: 9780, pct: 44.0, color: '#3b82f6' },
    { name: 'Nodes', count: 1120, pct: 13.9, color: '#ef4444' },
    { name: 'Endpoints', count: 99, pct: 98, color: '#f59e0b' },
    { name: 'Low', count: 98, pct: 99, color: '#0ea5e9' },
  ]

  // Recent Category Mock Data
  const recentCategory = [
    { id: '972', name: 'Endpoint', score: '> 1.8', val: 98.04, color: '#10b981' },
    { id: '973', name: 'Network', score: '> 1.8', val: 99.08, color: '#10b981' },
    { id: '972', name: 'Server', score: '> 1.8', val: 99.08, color: '#10b981' },
    { id: '972', name: 'Compute', score: '> 1.8', val: 93.08, color: '#10b981' },
    { id: '978', name: 'Database', score: '> 1.8', val: 99.8, color: '#10b981' },
  ]

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#a0aab5] font-sans pb-10">
      <div className="mx-auto max-w-[1700px] p-4 flex flex-col gap-4">
        
        {/* ROW 1: TOP CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-auto lg:h-[340px]">
          
          {/* Top Left: Time Series Area Chart */}
          <DarkCard className="lg:col-span-4 flex flex-col">
            <CardHeader title="Time Series Overview" />
            <div className="flex-1 p-4 pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <Area type="monotone" dataKey="network" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorNet)" />
                  <Area type="monotone" dataKey="threats" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorThreats)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </DarkCard>

          {/* Top Center: Main Gauge + Small Stats */}
          <DarkCard className="lg:col-span-4 flex items-center justify-center relative p-6">
            <div className="flex w-full items-center justify-center gap-8">
              {/* Central Gauge */}
              <div className="flex-shrink-0 relative">
                <HalfGauge value={riskScore} label={riskLevelText} color={riskColor} size={280} />
              </div>
              
              {/* Small floating info card inside */}
              <div className="hidden xl:flex flex-col bg-[#1a1f2c] border border-[#2d3345] rounded-lg p-3 w-[140px] shadow-lg absolute right-6 top-1/2 -translate-y-1/2">
                <div className="flex items-center justify-between mb-3 border-b border-[#2d3345] pb-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 size={14} />
                  </div>
                  <ChevronRight size={14} className="text-slate-500" />
                </div>
                <div className="h-[60px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeriesData.slice(-10)}>
                      <Line type="monotone" dataKey="network" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </DarkCard>

          {/* Top Right: Global Map Heatmap */}
          <DarkCard className="lg:col-span-4 flex flex-col relative overflow-hidden">
             {/* Map Background SVG */}
             <div className="absolute inset-0 opacity-40 pointer-events-none p-4 mt-6">
                <img src="/world-lite.svg" alt="Map" className="w-full h-full object-contain [filter:invert(0.5)_sepia(1)_hue-rotate(180deg)_saturate(2)_brightness(0.6)]" />
             </div>
             {/* Live Pulses */}
             <div className="absolute inset-0 z-10 pointer-events-none">
                {recentAttacks.slice(0, 15).map((attack, i) => {
                  const pt = resolveCountryCoords(attack.sourceCountry)
                  return (
                    <div 
                      key={i} 
                      className="absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                      style={{ 
                        left: `${pt.x}%`, 
                        top: `${pt.y}%`, 
                        backgroundColor: '#ef4444',
                        boxShadow: '0 0 10px 2px rgba(239, 68, 68, 0.6)'
                      }}
                    >
                      <div className="absolute inset-0 w-full h-full rounded-full bg-red-500 animate-ping opacity-75" />
                    </div>
                  )
                })}
             </div>
          </DarkCard>
        </div>

        {/* ROW 2: KPI METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          
          <DarkCard className="lg:col-span-2 p-5 flex flex-col justify-center">
            <p className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-slate-500 text-sm"><ArrowUp size={16}/></span> 
              <CountUp to={activeThreats} />
            </p>
            <p className="text-xs text-slate-400 uppercase font-semibold mt-1 flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Activity size={10} />
              </span>
              Active Threats
            </p>
          </DarkCard>

          <DarkCard className="lg:col-span-2 p-5 flex flex-col justify-center">
            <p className="text-2xl font-bold text-white"><CountUp to={criticalAlerts} /></p>
            <p className="text-xs text-slate-400 uppercase font-semibold mt-1 flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-red-500/20 text-red-500 flex items-center justify-center">
                <TriangleAlert size={10} />
              </span>
              Critical Alerts
            </p>
          </DarkCard>

          <DarkCard className="lg:col-span-2 p-5 flex flex-col justify-center">
            <p className="text-2xl font-bold text-white"><CountUp to={systemVulnerabilities} /></p>
            <p className="text-xs text-slate-400 uppercase font-semibold mt-1 flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-red-500/20 text-red-500 flex items-center justify-center">
                <ShieldAlert size={10} />
              </span>
              System Vulnerabilities
            </p>
          </DarkCard>

          <DarkCard className="lg:col-span-3 p-5 flex flex-col justify-center">
            <div className="flex justify-between items-start">
              <p className="text-2xl font-bold text-emerald-400">{networkActivity}%</p>
            </div>
            <p className="text-xs text-slate-400 uppercase font-semibold mt-1 flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 size={10} />
              </span>
              Network Activity
            </p>
          </DarkCard>

          <DarkCard className="lg:col-span-3 p-4 flex items-center justify-between">
             <div className="space-y-3 flex-1 px-2">
               <p className="text-sm font-semibold text-white tracking-wider">Risk Level <span className="text-slate-500 text-xs ml-1">79</span></p>
               <ul className="space-y-2 text-[11px] font-mono">
                 <li className="flex items-center gap-2"><span className="w-3 h-[2px] bg-red-500"></span> Critical</li>
                 <li className="flex items-center gap-2"><span className="w-3 h-[2px] bg-purple-500"></span> Medium</li>
                 <li className="flex items-center gap-2"><span className="w-3 h-[2px] bg-sky-500"></span> Low</li>
               </ul>
             </div>
             <div className="w-[110px] h-[90px] relative shrink-0">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ value: riskScore }, { value: 100 - riskScore }]} cx="50%" cy="50%" innerRadius={35} outerRadius={45} stroke="none" startAngle={225} endAngle={-45}>
                      <Cell fill={riskColor} />
                      <Cell fill="#292e40" />
                    </Pie>
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-white">{riskScore}%</span>
                  <span className="text-[8px] uppercase font-bold text-slate-400 w-16 text-center leading-tight mt-1">RISK LEVEL HIGH</span>
               </div>
             </div>
          </DarkCard>

        </div>

        {/* ROW 3: LISTS AND BOTTOM PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-auto lg:h-[350px]">
          
          {/* Threats by Type + Mini Map */}
          <DarkCard className="lg:col-span-5 flex flex-col">
            <CardHeader title="Threats by Type" rightNode={<span className="text-[10px] text-slate-500">Recent Onries: <span className="text-emerald-500">Active</span></span>} />
            <div className="p-4 flex-1 flex flex-col relative overflow-hidden gap-4">
              
               {/* Complex Timeline Mockup */}
               <div className="h-24 w-full relative flex items-center">
                 {/* Baseline */}
                 <div className="absolute w-full h-[1px] bg-[#333a4d] top-1/2"></div>
                 {/* Nodes */}
                 <div className="absolute w-full flex items-center justify-between px-4 z-10">
                   {['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#ef4444'].map((color, i) => (
                     <div key={i} className="flex flex-col items-center" style={{ transform: `translateY(${i % 2 === 0 ? '-15px' : '15px'})`}}>
                       <div className="w-8 h-4 rounded-sm" style={{ backgroundColor: color }}></div>
                       {/* Connection Line */}
                       <svg className="absolute pointer-events-none" width="40" height="40" style={{ left: `calc(${(i/5)*100}% + 16px)`, top: i % 2 === 0 ? '16px' : '-20px' }}>
                          <path d={i % 2 === 0 ? "M 0 0 L 10 20 L 40 20" : "M 0 40 L 10 20 L 40 20"} fill="none" stroke={color} strokeWidth="2" opacity="0.5" />
                       </svg>
                     </div>
                   ))}
                 </div>
               </div>

               {/* Mini Map area */}
               <div className="flex-1 rounded-md bg-[#0c0e15] border border-[#202533] relative overflow-hidden flex items-center justify-center p-2">
                 <img src="/world-lite.svg" alt="Map" className="w-full h-full object-cover opacity-30 [filter:invert(0.5)]" />
                 <div className="absolute w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] left-1/3 top-1/2"></div>
                 <div className="absolute w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] right-1/4 top-1/3"></div>
               </div>
            </div>
          </DarkCard>

          {/* Asset Status */}
          <DarkCard className="lg:col-span-3 flex flex-col">
            <CardHeader title="Asset Status" />
            <div className="p-5 flex-1 flex flex-col justify-center gap-6">
               {assetStatus.map((asset, i) => (
                 <div key={i} className="space-y-2">
                   <div className="flex items-center justify-between text-[11px] font-mono">
                     <div className="flex items-center gap-2 w-20">
                       <span className="w-3 h-3 rounded-sm flex items-center justify-center text-[8px] text-white" style={{ backgroundColor: asset.color }}>{asset.name.charAt(0)}</span>
                       <span className="text-slate-300">{asset.name}</span>
                     </div>
                     <span className="text-slate-100 font-bold">{asset.count}</span>
                     <span style={{ color: asset.color }} className="w-10 text-right">{asset.pct.toFixed(1)}%</span>
                   </div>
                   <div className="w-full h-1 bg-[#252a38] rounded-full overflow-hidden">
                     <div className="h-full rounded-full" style={{ width: `${asset.pct}%`, backgroundColor: asset.color }}></div>
                   </div>
                 </div>
               ))}
               <div className="flex items-center justify-between mt-4 text-[10px] text-slate-500 border-t border-[#252a38] pt-4">
                 <span>System Total: 11,097</span>
                 <span><ArrowUp size={12} className="inline text-emerald-500"/> Capacity OK</span>
               </div>
            </div>
          </DarkCard>

          {/* Recent Category */}
          <DarkCard className="lg:col-span-4 flex flex-col">
            <CardHeader title="Recent Category" />
            <div className="p-1 flex-1 overflow-auto">
              <table className="w-full text-left text-[11px] font-mono border-collapse">
                <tbody>
                  {recentCategory.map((cat, i) => (
                    <tr key={i} className="border-b border-[#1f2430] hover:bg-[#1a1f2c] transition-colors">
                      <td className="py-4 pl-4 font-bold" style={{ color: cat.color }}>{cat.id}</td>
                      <td className="py-4 text-slate-300">{cat.name}</td>
                      <td className="py-4 text-slate-500">{cat.score}</td>
                      <td className="py-4 text-white font-bold">{cat.val}</td>
                      <td className="py-4 pr-4 w-20">
                        <div className="flex gap-1 justify-end">
                           <div className="h-4 w-2 bg-emerald-500 rounded-[1px]"></div>
                           <div className="h-4 w-2 bg-emerald-500 rounded-[1px]"></div>
                           <div className="h-4 w-2 bg-[#2d3345] rounded-[1px]"></div>
                           <div className="h-4 w-2 bg-[#2d3345] rounded-[1px]"></div>
                           <div className="h-4 w-2 bg-[#2d3345] rounded-[1px]"></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DarkCard>

        </div>
      </div>
    </div>
  )
}
