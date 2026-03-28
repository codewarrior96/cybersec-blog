'use client';
import React from 'react';
import type { AttackEvent, WorkflowMetrics } from '@/lib/dashboard-types';

const CHAIN = [
  { id: 'recon',    tr: 'KEŞİF',       en: 'Reconnaissance', mitre: 'TA0043', color: '#22d3ee' },
  { id: 'weapon',   tr: 'SİLAHLANMA',  en: 'Weaponization',  mitre: 'TA0042', color: '#a78bfa' },
  { id: 'delivery', tr: 'TESLİMAT',    en: 'Delivery',       mitre: 'TA0001', color: '#f59e0b' },
  { id: 'exploit',  tr: 'İSTİSMAR',    en: 'Exploitation',   mitre: 'TA0004', color: '#f97316' },
  { id: 'install',  tr: 'KURULUM',     en: 'Installation',   mitre: 'TA0003', color: '#fb923c' },
  { id: 'c2',       tr: 'KOMUTA & KO', en: 'Command & Ctrl', mitre: 'TA0011', color: '#ef4444' },
  { id: 'action',   tr: 'HEDEF',       en: 'Actions on Obj', mitre: 'TA0040', color: '#dc2626' },
] as const;

function attackTypeToStage(type: string, tagName?: string): number {
  const t = (type + ' ' + (tagName ?? '')).toLowerCase();
  if (t.includes('scan') || t.includes('recon')) return 0;
  if (t.includes('phish')) return 2;
  if (t.includes('sql') || t.includes('sqli') || t.includes('inject')) return 3;
  if (t.includes('rce') || t.includes('exploit') || t.includes('ssh') || t.includes('brute')) return 3;
  if (t.includes('install') || t.includes('persist') || t.includes('rootkit')) return 4;
  if (t.includes('ddos') || t.includes('botnet') || t.includes('c2') || t.includes('beacon')) return 5;
  if (t.includes('exfil') || t.includes('ransomware') || t.includes('wipe')) return 6;
  return 1;
}

interface KillChainWidgetProps {
  attacks: AttackEvent[];
  metrics: WorkflowMetrics | null;
}

export default function KillChainWidget({ attacks, metrics }: KillChainWidgetProps) {
  const stageCounts = new Array(7).fill(0) as number[];

  if (metrics?.attack.topTags && metrics.attack.topTags.length > 0) {
    for (const tag of metrics.attack.topTags) {
      const stage = attackTypeToStage('', tag.name);
      stageCounts[stage] += tag.count;
    }
  } else {
    for (const a of attacks) {
      const stage = attackTypeToStage(a.type);
      stageCounts[stage]++;
    }
  }

  const maxCount = Math.max(...stageCounts, 1);
  const activeCount = stageCounts.filter(c => c > 0).length;
  const totalMapped = stageCounts.reduce((s, c) => s + c, 0);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden font-mono text-xs">

      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-violet-500/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-violet-400 font-bold tracking-widest uppercase">⬡ KILL CHAIN ANALİZİ</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-slate-500">
            AKTİF: <span className="font-bold text-orange-400">{activeCount}</span>
            <span className="text-slate-700">/7</span>
          </span>
          <span className="text-slate-500">
            OLAY: <span className="font-bold text-violet-400">{totalMapped}</span>
          </span>
        </div>
      </div>

      {/* Chain stages */}
      <div className="flex-1 min-h-0 flex flex-col px-3 py-2 gap-1 overflow-hidden">
        {CHAIN.map((stage, i) => {
          const count = stageCounts[i];
          const pct = count / maxCount;
          const active = count > 0;

          return (
            <div key={stage.id} className="flex items-center gap-2 flex-1 min-h-0" style={{ minHeight: 0 }}>
              {/* Stage number */}
              <span className="text-[9px] text-slate-700 w-3 text-right shrink-0 font-bold">{i + 1}</span>

              {/* Connector line */}
              <div className="flex flex-col items-center shrink-0" style={{ width: 8, alignSelf: 'stretch' }}>
                <div
                  className="flex-1 w-px"
                  style={{ background: active ? `${stage.color}40` : '#1a0a2e' }}
                />
                <div
                  className="w-2 h-2 rounded-full shrink-0 my-0.5"
                  style={{
                    background: active ? stage.color : '#1a0a2e',
                    boxShadow: active ? `0 0 6px ${stage.color}` : 'none',
                  }}
                />
                {i < 6 && (
                  <div
                    className="flex-1 w-px"
                    style={{ background: active && stageCounts[i + 1] > 0 ? `${stage.color}40` : '#1a0a2e' }}
                  />
                )}
                {i === 6 && <div className="flex-1" />}
              </div>

              {/* Stage card */}
              <div
                className="flex-1 min-h-0 flex items-center gap-2 rounded px-2 border transition-all duration-700"
                style={{
                  borderColor: active ? `${stage.color}35` : '#1a0a2e',
                  background: active ? `${stage.color}06` : 'transparent',
                  paddingTop: 3,
                  paddingBottom: 3,
                }}
              >
                {/* Turkish name */}
                <span
                  className="text-[9px] font-black w-[72px] shrink-0 tracking-wider"
                  style={{ color: active ? stage.color : '#334155' }}
                >
                  {stage.tr}
                </span>

                {/* Progress bar */}
                <div className="flex-1 h-[5px] bg-[#0d0018] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct * 100}%`,
                      background: active
                        ? `linear-gradient(90deg, ${stage.color}55, ${stage.color})`
                        : 'transparent',
                      boxShadow: active ? `0 0 5px ${stage.color}55` : 'none',
                    }}
                  />
                </div>

                {/* Count */}
                <span
                  className="text-[10px] font-bold w-[22px] text-right tabular-nums shrink-0"
                  style={{ color: active ? stage.color : '#334155' }}
                >
                  {active ? count : '—'}
                </span>

                {/* MITRE tag */}
                <span className="text-[8px] text-slate-700 shrink-0 w-[40px] hidden lg:block">{stage.mitre}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between border-t border-violet-500/15 py-1.5 px-3">
        <span className="text-[8px] text-slate-700 tracking-wider">LOCKHEED MARTIN CYBER KILL CHAIN™</span>
        <span className="text-[9px] text-slate-600">
          MITRE ATT&CK <span className="text-violet-500">v15</span> haritalandı
        </span>
      </div>
    </div>
  );
}
