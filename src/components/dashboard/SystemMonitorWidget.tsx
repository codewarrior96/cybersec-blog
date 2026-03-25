'use client';
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, YAxis, CartesianGrid } from 'recharts';

export default function SystemMonitorWidget() {
  const [cpuData, setCpuData] = useState(Array.from({ length: 30 }, (_, i) => ({ time: i, value: 40 + Math.random() * 30 })));
  const [netData, setNetData] = useState(Array.from({ length: 20 }, (_, i) => ({ time: i, value: Math.random() * 100 })));

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuData(prev => {
        const newData = [...prev.slice(1)];
        newData.push({ time: prev[prev.length - 1].time + 1, value: Math.max(10, Math.min(95, newData[newData.length - 1].value + (Math.random() - 0.5) * 40)) });
        return newData;
      });
      setNetData(prev => {
        const newData = [...prev.slice(1)];
        newData.push({ time: prev[prev.length - 1].time + 1, value: Math.max(5, Math.random() * 100) });
        return newData;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col font-mono text-slate-200 overflow-hidden">

      {/* Outer grouped header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#00ff41]/20 z-10 bg-[#021518]/80">
        <span className="text-[12px] lg:text-sm font-bold text-slate-200 tracking-widest uppercase mt-1">SYSTEM MONITORING</span>
        <span className="text-slate-500 tracking-widest text-[10px]">...</span>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-2">
        {/* CPU LOAD */}
        <div className="flex-1 flex flex-col relative overflow-hidden group border border-[#00ff41]/20 rounded p-2 bg-[#021a20]/40">
          <div className="flex justify-between items-start mb-1 z-10">
            <span className="text-[11px] lg:text-xs font-bold text-slate-300 tracking-widest group-hover:text-white transition-colors">CPU LOAD</span>
            <div className="text-right leading-none">
              <div className="text-xs lg:text-sm font-bold text-cyan-400">{Math.floor(cpuData[cpuData.length - 1].value)}%</div>
              <div className="text-[9px] text-cyan-400/50">volatile</div>
            </div>
          </div>
          <div className="flex-1 w-full relative flex mt-1">
            <div className="flex flex-col justify-between text-[8px] text-slate-500 pb-4 pr-1">
              <span>80</span><span>60</span><span>40</span><span>20</span><span>0</span>
            </div>
            <div className="flex-1 relative border-l border-b border-cyan-500/30">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cpuData}>
                  <defs>
                    <linearGradient id="cpuGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={[0, 100]} />
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#06b6d4" strokeOpacity={0.1} />
                  <Area type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#cpuGlow)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="absolute -bottom-4 left-0 w-full flex justify-between text-[8px] text-slate-500 px-1">
                <span>0</span><span>20%</span><span>40%</span><span>60%</span><span>48M</span>
              </div>
            </div>
          </div>
        </div>

        {/* NETWORK TRAFFIC */}
        <div className="flex-1 flex flex-col relative overflow-hidden group mt-1 border border-[#00ff41]/20 rounded p-2 bg-[#021a20]/40">
          <div className="flex justify-between items-center mb-1 z-10">
            <span className="text-[11px] lg:text-xs font-bold text-slate-300 tracking-widest group-hover:text-white transition-colors">NETWORK TRAFFIC</span>
            <span className="text-xs lg:text-sm font-bold text-orange-400">1.2 Gbps</span>
          </div>
          <div className="flex-1 w-full relative flex mt-1">
            <div className="flex flex-col justify-between text-[8px] text-slate-500 pb-4 pr-1">
              <span>1.0B</span><span>1.2B</span><span>1.0B</span><span>0.5B</span><span>0</span>
            </div>
            <div className="flex-1 relative border-l border-b border-orange-500/30">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={netData} barCategoryGap="10%">
                  <YAxis hide domain={[0, 100]} />
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f97316" strokeOpacity={0.1} />
                  <Bar dataKey="value" fill="#f97316" isAnimationActive={false} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
              <div className="absolute -bottom-4 left-0 w-full flex justify-between text-[8px] text-slate-500 px-1">
                <span>0</span><span>300</span><span>600</span><span>900</span><span>120k</span><span>150k</span>
              </div>
            </div>
          </div>
        </div>

        {/* MEMORY USAGE */}
        <div className="flex-[0.8] flex flex-col relative group mt-1 border border-[#00ff41]/20 rounded p-2 bg-[#021a20]/40">
          <div className="flex justify-between items-center mb-2 z-10">
            <span className="text-[11px] lg:text-xs font-bold text-slate-300 tracking-widest">MEMORY USAGE</span>
            <span className="text-xs lg:text-sm font-bold text-slate-200">72%</span>
          </div>
          {/* Full-width horizontal bar matching target */}
          <div className="flex-1 flex flex-col justify-center gap-1">
            <div className="relative w-full h-6 bg-[#021a20] border border-cyan-500/30 rounded-sm overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-[72%] bg-gradient-to-r from-cyan-900/80 via-cyan-700/90 to-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
              <div className="absolute top-0 bottom-0 w-0.5 bg-cyan-200 left-[72%] shadow-[0_0_6px_rgba(34,211,238,0.9)] animate-pulse" />
            </div>
            <div className="flex justify-between text-[8px] text-slate-500 px-0.5">
              <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
