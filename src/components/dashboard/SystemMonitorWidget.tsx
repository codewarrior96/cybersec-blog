'use client';
import React, { useState, useEffect } from 'react';

// Hexagonal progress ring SVG
function HexProgress({ percent, size = 72, color = '#22d3ee' }: { percent: number; size?: number; color?: string }) {
  const center = size / 2;
  const r = size * 0.38;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
  }).join(' ');
  const perimeter = 6 * 2 * r * Math.sin(Math.PI / 6);
  const offset = perimeter - (perimeter * percent) / 100;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={points} fill="none" stroke="#1e293b" strokeWidth="3" />
      <polygon points={points} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={perimeter} strokeDashoffset={offset} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={center} y={center - 4} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="monospace">
        {percent}%
      </text>
      <text x={center} y={center + 10} textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
        CPU
      </text>
    </svg>
  );
}

// Simple sparkline
function Sparkline({ data, color, height = 20 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 100;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * height}`).join(' ');
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <polyline points={`0,${height} ${pts} ${w},${height}`} fill={color} fillOpacity="0.1" strokeWidth="0" />
    </svg>
  );
}

export default function SystemMonitorWidget() {
  const [cpuPercent, setCpuPercent] = useState(49);
  const [cores, setCores] = useState<number[]>([45, 62, 38, 71, 55, 28, 67, 41]);
  const [temp, setTemp] = useState(72);
  const [memUsed, setMemUsed] = useState({ system: 2.1, apps: 4.7, cache: 1.9, free: 7.3 });
  const [uploadHistory, setUploadHistory] = useState<number[]>([]);
  const [downloadHistory, setDownloadHistory] = useState<number[]>([]);
  const [uploadSpeed, setUploadSpeed] = useState(847);
  const [downloadSpeed, setDownloadSpeed] = useState(2400);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuPercent(prev => Math.max(10, Math.min(95, prev + Math.floor((Math.random() - 0.5) * 12))));
      setCores(prev => prev.map(c => Math.max(5, Math.min(100, c + Math.floor((Math.random() - 0.5) * 20)))));
      setTemp(prev => Math.max(55, Math.min(90, prev + Math.floor((Math.random() - 0.5) * 4))));
      
      const newMem = {
        system: +(2.1 + (Math.random() - 0.5) * 0.3).toFixed(1),
        apps: +(4.7 + (Math.random() - 0.5) * 0.5).toFixed(1),
        cache: +(1.9 + (Math.random() - 0.5) * 0.4).toFixed(1),
        free: 0,
      };
      newMem.free = +(16 - newMem.system - newMem.apps - newMem.cache).toFixed(1);
      setMemUsed(newMem);

      const newUp = Math.max(100, Math.floor(1200 * Math.random()));
      const newDown = Math.max(500, Math.floor(4000 * Math.random()));
      setUploadSpeed(newUp);
      setDownloadSpeed(newDown);
      setUploadHistory(prev => [...prev.slice(-19), newUp]);
      setDownloadHistory(prev => [...prev.slice(-19), newDown]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const memTotal = 16;
  const memPercent = Math.round(((memTotal - memUsed.free) / memTotal) * 100);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-cyan-500/15 bg-[#0a1020]/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">// SYSTEM STATUS</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[8px] text-green-400 font-bold">LIVE</span>
          </span>
        </div>
        <span className="text-[8px] text-slate-500 font-mono">4 NODES</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2.5">

        {/* CPU + Cores Row */}
        <div className="flex items-center gap-3">
          {/* Hex Ring */}
          <div className="shrink-0">
            <HexProgress percent={cpuPercent} size={68} />
          </div>
          {/* Per-core bars */}
          <div className="flex-1 min-w-0">
            <div className="flex items-end gap-[3px] h-[38px]">
              {cores.map((c, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end h-full">
                  <div className="rounded-t-sm transition-all duration-500" style={{
                    height: `${c}%`,
                    background: c > 80 ? '#ef4444' : c > 60 ? '#f59e0b' : '#22d3ee',
                    boxShadow: c > 80 ? '0 0 4px #ef4444' : 'none',
                  }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] text-slate-500">8 CORES · 3.2 GHz</span>
              <span className="text-[8px] text-orange-400 flex items-center gap-0.5">🔥 {temp}°C</span>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-slate-400 font-bold tracking-wider">MEMORY</span>
            <span className="text-[9px] text-slate-300 font-bold">{memPercent}% · 16 GB DDR5</span>
          </div>
          <div className="flex h-3 rounded-sm overflow-hidden bg-[#1a1a2e]">
            <div className="transition-all duration-700" style={{ width: `${(memUsed.system / memTotal) * 100}%`, background: '#3b82f6' }} title="System" />
            <div className="transition-all duration-700" style={{ width: `${(memUsed.apps / memTotal) * 100}%`, background: '#22d3ee' }} title="Apps" />
            <div className="transition-all duration-700" style={{ width: `${(memUsed.cache / memTotal) * 100}%`, background: '#a855f7' }} title="Cache" />
          </div>
          <div className="flex gap-3 mt-1">
            <span className="text-[8px] text-blue-400">■ SYS {memUsed.system}G</span>
            <span className="text-[8px] text-cyan-400">■ APP {memUsed.apps}G</span>
            <span className="text-[8px] text-purple-400">■ CACHE {memUsed.cache}G</span>
            <span className="text-[8px] text-slate-500">■ FREE {memUsed.free}G</span>
          </div>
        </div>

        {/* Network I/O */}
        <div>
          <span className="text-[9px] text-slate-400 font-bold tracking-wider">NETWORK I/O</span>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8px] text-orange-400">↑ UPLOAD</span>
                <span className="text-[9px] text-orange-300 font-bold">{uploadSpeed} MB/s</span>
              </div>
              <Sparkline data={uploadHistory} color="#fb923c" height={18} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8px] text-cyan-400">↓ DOWNLOAD</span>
                <span className="text-[9px] text-cyan-300 font-bold">{(downloadSpeed / 1000).toFixed(1)} GB/s</span>
              </div>
              <Sparkline data={downloadHistory} color="#22d3ee" height={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Status Badges */}
      <div className="shrink-0 grid grid-cols-4 border-t border-cyan-500/15 bg-[#0a1020]/80">
        <div className="flex flex-col items-center py-1.5 border-r border-cyan-500/10">
          <span className="text-[7px] text-slate-500">FIREWALL</span>
          <span className="text-[9px] text-green-400 font-bold">✓ ON</span>
        </div>
        <div className="flex flex-col items-center py-1.5 border-r border-cyan-500/10">
          <span className="text-[7px] text-slate-500">VPN</span>
          <span className="text-[9px] text-green-400 font-bold">✓ UP</span>
        </div>
        <div className="flex flex-col items-center py-1.5 border-r border-cyan-500/10">
          <span className="text-[7px] text-slate-500">IDS</span>
          <span className="text-[9px] text-amber-400 font-bold">⚡ SCAN</span>
        </div>
        <div className="flex flex-col items-center py-1.5">
          <span className="text-[7px] text-slate-500">BACKUP</span>
          <span className="text-[9px] text-blue-400 font-bold">↻ SYNC</span>
        </div>
      </div>
    </div>
  );
}
