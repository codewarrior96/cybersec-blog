'use client';
import React, { useState, useEffect, useRef } from 'react';

function generateInitialData(): { time: string; inbound: number; outbound: number }[] {
  const data = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const hourFactor = Math.sin((h - 6) * Math.PI / 12) * 0.5 + 0.5; // Peak at noon
      data.push({
        time: label,
        inbound: Math.max(5, hourFactor * 80 + Math.random() * 30),
        outbound: Math.max(3, hourFactor * 50 + Math.random() * 25),
      });
    }
  }
  return data;
}

export default function NetworkTrafficWidget() {
  const [data, setData] = useState<{ time: string; inbound: number; outbound: number }[]>([]);
  const [peak, setPeak] = useState({ inbound: 0, outbound: 0 });

  useEffect(() => {
    const initial = generateInitialData();
    setData(initial);
    setPeak({
      inbound: Math.max(...initial.map(d => d.inbound)),
      outbound: Math.max(...initial.map(d => d.outbound)),
    });

    const interval = setInterval(() => {
      setData(prev => {
        const updated = [...prev];
        const idx = Math.floor(Math.random() * updated.length);
        updated[idx] = {
          ...updated[idx],
          inbound: Math.max(5, updated[idx].inbound + (Math.random() - 0.5) * 15),
          outbound: Math.max(3, updated[idx].outbound + (Math.random() - 0.5) * 12),
        };
        return updated;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ w: 1000, h: 300 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          w: Math.max(300, entry.contentRect.width),
          h: Math.max(150, entry.contentRect.height)
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (data.length === 0) return <div className="absolute inset-0 bg-var(--bg-panel)" />;

  const maxVal = Math.max(...data.map(d => Math.max(d.inbound, d.outbound)), 1);
  const { w, h } = dimensions;
  
  // Dynamic padding based on sizing
  const isMobile = w < 500;
  const padL = isMobile ? 30 : 50;
  const padB = 30;
  const padT = 10;
  const chartW = w - padL;
  const chartH = h - padB - padT;

  const toX = (i: number) => padL + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => padT + chartH - (v / maxVal) * chartH;

  const inboundPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.inbound)}`).join(' ');
  const outboundPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.outbound)}`).join(' ');
  const inboundFill = `${inboundPath} L ${toX(data.length - 1)} ${h - padB} L ${padL} ${h - padB} Z`;
  const outboundFill = `${outboundPath} L ${toX(data.length - 1)} ${h - padB} L ${padL} ${h - padB} Z`;

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  // X-axis: show every 4 hours on desktop, 8 hours on mobile
  const xLabels = data.filter((_, i) => isMobile ? i % 32 === 0 : i % 16 === 0);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-cyan-500/15 bg-var(--bg-panel)/80 shrink-0">
        <span className="text-[var(--text-title)] font-bold text-slate-300 tracking-widest uppercase">// NETWORK TRAFFIC</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[var(--text-body)]">
            <span className="w-3 h-[2px] bg-cyan-400 rounded" /> <span className="text-cyan-400">INBOUND</span>
          </span>
          <span className="flex items-center gap-1.5 text-[var(--text-body)]">
            <span className="w-3 h-[2px] bg-orange-400 rounded" /> <span className="text-orange-400">OUTBOUND</span>
          </span>
          <span className="text-slate-600 text-[var(--text-body)]">⋮</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 p-2 relative" ref={containerRef}>
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block">
          <defs>
            <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb923c" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#fb923c" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yLabels.map(v => (
            <g key={v}>
              <line x1={padL} y1={toY(v)} x2={w} y2={toY(v)} stroke="#1e293b" strokeWidth="0.5" />
              <text x={padL - 6} y={toY(v) + 3} textAnchor="end" fill="#475569" fontSize={isMobile ? "8" : "10"} fontFamily="monospace">
                {v}%
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {xLabels.map((d, i) => (
            <text key={d.time} x={toX(isMobile ? i * 32 : i * 16)} y={h - 8} textAnchor="middle" fill="#475569" fontSize={isMobile ? "8" : "10"} fontFamily="monospace">
              {d.time}
            </text>
          ))}

          {/* Fills */}
          <path d={inboundFill} fill="url(#inboundGrad)" />
          <path d={outboundFill} fill="url(#outboundGrad)" />

          {/* Lines */}
          <path d={inboundPath} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />
          <path d={outboundPath} fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>

        {/* Scale label */}
        <div className="absolute bottom-8 left-14 text-[var(--text-body)] text-slate-500 font-mono">5 GB/s</div>
      </div>
    </div>
  );
}
