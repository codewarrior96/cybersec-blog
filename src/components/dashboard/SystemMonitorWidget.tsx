'use client';
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, YAxis } from 'recharts';

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
    <div className="h-full w-full flex flex-col gap-4 font-mono">
      
      {/* CPU LOAD */}
      <div className="flex-1 bg-[#0a1114]/80 border border-green-500/20 p-4 rounded-sm shadow-[0_0_10px_rgba(0,0,0,0.5)] flex flex-col relative overflow-hidden backdrop-blur-sm group">
        <div className="flex justify-between items-center mb-1 z-10">
          <span className="text-[11px] lg:text-xs font-bold text-slate-200 tracking-widest group-hover:text-white transition-colors">CPU LOAD</span>
          <div className="text-right">
            <div className="text-xs lg:text-sm font-bold text-cyan-400">{Math.floor(cpuData[cpuData.length-1].value)}%</div>
            <div className="text-[8px] text-cyan-400/50 uppercase leading-none mt-0.5">volatile</div>
          </div>
        </div>
        <div className="flex-1 w-full relative -mx-2 mt-2">
          <ResponsiveContainer width="105%" height="100%">
            <AreaChart data={cpuData}>
              <defs>
                <linearGradient id="cpuGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, 100]} />
              <Area type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#cpuGlow)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-[8px] text-slate-500 mt-1 px-1 border-t border-cyan-500/10 pt-1">
          <span>0</span><span>20%</span><span>40%</span><span>60%</span><span>48M</span>
        </div>
      </div>

      {/* NETWORK TRAFFIC */}
      <div className="flex-1 bg-[#0a1114]/80 border border-green-500/20 p-4 rounded-sm shadow-[0_0_10px_rgba(0,0,0,0.5)] flex flex-col relative overflow-hidden backdrop-blur-sm group">
        <div className="flex justify-between items-center mb-2 z-10">
          <span className="text-[11px] lg:text-xs font-bold text-slate-200 tracking-widest group-hover:text-white transition-colors">NETWORK TRAFFIC</span>
          <span className="text-xs lg:text-sm font-bold text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.5)]">1.2 Gbps</span>
        </div>
        <div className="flex-1 w-full relative -mx-2 mt-2">
          <ResponsiveContainer width="105%" height="100%">
            <BarChart data={netData} barCategoryGap="25%">
              <YAxis hide domain={[0, 100]} />
              <Bar dataKey="value" fill="#f97316" isAnimationActive={false} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-[8px] text-slate-500 mt-1 px-1 border-t border-orange-500/10 pt-1">
          <span>0</span><span>300</span><span>600</span><span>900</span><span>120k</span><span>150k</span>
        </div>
      </div>

      {/* MEMORY USAGE */}
      <div className="flex-[0.8] min-h-[100px] bg-[#0a1114]/80 border border-green-500/20 p-4 rounded-sm shadow-[0_0_10px_rgba(0,0,0,0.5)] flex flex-col justify-center relative backdrop-blur-sm group">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] lg:text-xs font-bold text-slate-200 tracking-widest group-hover:text-white transition-colors">MEMORY USAGE</span>
          <span className="text-sm font-bold text-slate-200">72%</span>
        </div>
        <div className="relative w-full h-8 bg-[#00111a] border border-cyan-500/30 rounded-sm shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] overflow-hidden">
          <div className="absolute top-0 left-0 h-full bg-cyan-500/70 w-[72%] shadow-[0_0_15px_rgba(6,182,212,0.8)] border-r-2 border-white" />
          <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_white] left-[72%] animate-pulse" />
        </div>
        <div className="flex justify-between text-[8px] text-slate-500 mt-3 border-t border-cyan-500/10 pt-1">
          <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300</span>
        </div>
      </div>

    </div>
  );
}
