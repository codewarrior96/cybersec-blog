'use client';
import React, { useEffect, useState } from 'react';

interface ThreatBannerProps {
  threatScore: number;
  totalLast24h: number;
  attacksPerMinute: number;
  demoMode?: boolean;
  onToggleDemo?: () => void;
}

function getThreatLevel(score: number): { label: string; color: string; bgGrad: string; bars: number } {
  if (score >= 7.5) return { label: 'KRİTİK',  color: '#ef4444', bgGrad: 'rgba(239,68,68,0.13)',    bars: 5 };
  if (score >= 5.0) return { label: 'YÜKSEK',  color: '#f97316', bgGrad: 'rgba(249,115,22,0.10)',   bars: 4 };
  if (score >= 3.0) return { label: 'ORTA',    color: '#eab308', bgGrad: 'rgba(234,179,8,0.08)',    bars: 3 };
  return              { label: 'DÜŞÜK',   color: '#22c55e', bgGrad: 'rgba(34,197,94,0.07)',    bars: 2 };
}

export default function ThreatBanner({ threatScore, totalLast24h, attacksPerMinute, demoMode, onToggleDemo }: ThreatBannerProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC+3');
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  const lvl = getThreatLevel(threatScore);

  return (
    <div
      className="shrink-0 flex items-center justify-between px-4 border-b border-[#00ff88]/20 font-mono select-none overflow-hidden"
      style={{
        height: 32,
        background: `linear-gradient(90deg, #000000 0%, ${lvl.bgGrad} 50%, #000000 100%)`,
      }}
    >
      {/* Left: Platform identity */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[#00ff88] text-[10px] font-black tracking-widest shrink-0 hidden sm:block">⬡</span>
        <span className="text-[#00ff88] font-bold tracking-widest text-[10px] shrink-0 uppercase whitespace-nowrap hidden md:block">
          TÜRKİYE SİBER GÜVENLİK OPERASYON MERKEZİ
        </span>
        <span className="text-[#00ff88] font-bold tracking-widest text-[10px] shrink-0 uppercase whitespace-nowrap md:hidden">
          TR-SGOM
        </span>
        <span className="text-[#333333] text-[10px] shrink-0">|</span>
        <span className="text-[#525252] text-[9px] shrink-0">BTDK-SOC v2.4</span>
      </div>

      {/* Center: Threat level */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[#525252] text-[9px] tracking-widest uppercase hidden sm:block">Ulusal Tehdit Seviyesi</span>
        <div className="flex items-center gap-[3px]">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="rounded-sm"
              style={{
                width: 10,
                height: 10,
                background: i <= lvl.bars ? lvl.color : '#111111',
                boxShadow: i <= lvl.bars ? `0 0 4px ${lvl.color}` : 'none',
                transition: 'all 0.5s',
              }}
            />
          ))}
        </div>
        <span
          className="font-black text-[11px] tracking-widest ml-1 whitespace-nowrap"
          style={{ color: lvl.color, textShadow: `0 0 10px ${lvl.color}` }}
        >
          {lvl.label}
        </span>
      </div>

      {/* Right: Stats + clock + demo toggle */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[#525252] text-[9px] hidden sm:block">
          24H: <span className="font-bold text-[#00d4ff]">{totalLast24h.toLocaleString()}</span>
        </span>
        <span className="text-[#525252] text-[9px]">
          ATK/DK: <span className="font-bold" style={{ color: lvl.color }}>{attacksPerMinute.toFixed(1)}</span>
        </span>
        <span className="text-[#333333] text-[9px]">|</span>
        <span className="text-[#00ff88] font-bold text-[9px] tabular-nums">{time}</span>
        {onToggleDemo && (
          <>
            <span className="text-[#333333] text-[9px]">|</span>
            <button
              onClick={onToggleDemo}
              className="text-[9px] px-1.5 py-0.5 rounded border font-bold tracking-widest transition-all"
              style={{
                borderColor: demoMode ? '#ff4444' : '#222222',
                color: demoMode ? '#ff4444' : '#525252',
                background: demoMode ? 'rgba(255,68,68,0.1)' : 'transparent',
              }}
              title={demoMode ? 'Demo modunu kapat' : 'Hızlı demo modunu aç'}
            >
              {demoMode ? '⏸ DEMO' : '▶ DEMO'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
