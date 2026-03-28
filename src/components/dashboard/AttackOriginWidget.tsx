'use client';
import React from 'react';
import type { AttackEvent, WorkflowMetrics } from '@/lib/dashboard-types';

interface AttackOriginWidgetProps {
  attacks: AttackEvent[];
  metrics: WorkflowMetrics | null;
}

const COUNTRY_COLORS = [
  '#ef4444', '#f97316', '#f97316',
  '#8b5cf6', '#8b5cf6', '#c084fc', '#c084fc',
];

const TAG_COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#c084fc', '#22d3ee'];

export default function AttackOriginWidget({ attacks, metrics }: AttackOriginWidgetProps) {
  /* ── Top Countries ── */
  const topCountries: { name: string; count: number }[] =
    metrics?.attack.topCountries?.length
      ? metrics.attack.topCountries.slice(0, 7)
      : (() => {
          const map: Record<string, number> = {};
          attacks.forEach(a => { map[a.sourceCountry] = (map[a.sourceCountry] || 0) + 1; });
          return Object.entries(map)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 7);
        })();

  /* ── Top Attack Vectors ── */
  const topTags: { name: string; count: number }[] =
    metrics?.attack.topTags?.length
      ? metrics.attack.topTags.slice(0, 6)
      : (() => {
          const map: Record<string, number> = {};
          attacks.forEach(a => { map[a.type] = (map[a.type] || 0) + 1; });
          return Object.entries(map)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
        })();

  const maxCountry = Math.max(...topCountries.map(c => c.count), 1);
  const maxTag     = Math.max(...topTags.map(t => t.count), 1);

  const totalLast24h = metrics?.attack.totalLast24h ?? attacks.length;
  const activeIps    = metrics?.attack.activeIps ?? new Set(attacks.map(a => a.sourceIP)).size;
  const apm          = metrics?.attack.attacksPerMinute != null
    ? metrics.attack.attacksPerMinute.toFixed(1)
    : '—';

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden font-mono text-xs">

      {/* ── Header ── */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-violet-500/20 shrink-0">
        <span className="text-violet-400 font-bold tracking-widest uppercase">⬡ ATTACK ORIGIN</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500">
            24H: <span className="font-bold text-violet-400">{totalLast24h.toLocaleString()}</span>
          </span>
          <span className="text-slate-600">⋮</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Left — Top Countries */}
        <div className="flex-[3] min-w-0 flex flex-col px-3 py-2 border-r border-violet-500/10 overflow-hidden">
          <div className="text-[9px] text-slate-600 tracking-widest mb-2">▸ TOP ATTACKING NATIONS</div>
          <div className="flex flex-col gap-[7px] flex-1 min-h-0 overflow-hidden">
            {topCountries.length === 0 && (
              <span className="text-slate-600 text-[10px] mt-2">Scanning origins...</span>
            )}
            {topCountries.map((c, i) => {
              const col = COUNTRY_COLORS[i] ?? '#8b5cf6';
              const pct = (c.count / maxCountry) * 100;
              return (
                <div key={c.name} className="flex items-center gap-2">
                  {/* Rank */}
                  <span className="text-[9px] text-slate-600 w-[14px] shrink-0 text-right">{i + 1}</span>
                  {/* Country name */}
                  <span className="w-[72px] shrink-0 text-[10px] text-slate-300 truncate">{c.name}</span>
                  {/* Bar */}
                  <div className="flex-1 h-[5px] bg-[#0d0018] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${col}66, ${col})`,
                        boxShadow: `0 0 5px ${col}55`,
                      }}
                    />
                  </div>
                  {/* Count */}
                  <span
                    className="w-[28px] text-right shrink-0 font-bold tabular-nums text-[10px]"
                    style={{ color: col }}
                  >{c.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Attack Vectors */}
        <div className="flex-[2] min-w-0 flex flex-col px-3 py-2 overflow-hidden">
          <div className="text-[9px] text-slate-600 tracking-widest mb-2">▸ ATTACK VECTORS</div>
          <div className="flex flex-col gap-[7px] flex-1 min-h-0 overflow-hidden">
            {topTags.length === 0 && (
              <span className="text-slate-600 text-[10px] mt-2">Analyzing vectors...</span>
            )}
            {topTags.map((t, i) => {
              const col = TAG_COLORS[i % TAG_COLORS.length];
              const pct = (t.count / maxTag) * 100;
              return (
                <div key={t.name} className="flex flex-col gap-[3px]">
                  <div className="flex justify-between items-center">
                    <span
                      className="text-[10px] truncate max-w-[110px]"
                      style={{ color: col }}
                    >{t.name}</span>
                    <span className="text-[10px] tabular-nums text-slate-400 shrink-0 ml-1">{t.count}</span>
                  </div>
                  <div className="h-[3px] bg-[#0d0018] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: col, opacity: 0.75 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Footer Stats ── */}
      <div className="shrink-0 flex items-center justify-around border-t border-violet-500/15 py-1.5 px-2">
        {([
          ['ATTACKS/MIN', apm,                        '#ef4444'],
          ['ACTIVE IPs',  activeIps,                  '#f97316'],
          ['TOTAL 24H',   totalLast24h.toLocaleString(), '#8b5cf6'],
        ] as [string, string | number, string][]).map(([label, value, col]) => (
          <span key={label} className="text-[10px] text-slate-400 border border-violet-900/40 px-2 py-0.5 rounded whitespace-nowrap">
            {label}: <span className="font-bold" style={{ color: col }}>{value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
