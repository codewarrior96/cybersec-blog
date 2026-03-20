'use client';
import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

export default function SystemMonitorWidget() {
  const [data, setData] = useState(Array.from({ length: 25 }, (_, i) => ({ time: i, value: 30 + Math.random() * 40 })));

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const newData = [...prev.slice(1)];
        const lastVal = newData[newData.length - 1].value;
        const change = (Math.random() - 0.5) * 25;
        newData.push({ time: prev[prev.length - 1].time + 1, value: Math.max(10, Math.min(95, lastVal + change)) });
        return newData;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col font-mono relative">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-cyan-500/20">
        <Activity className="text-cyan-400 w-5 h-5 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
        <span className="text-sm font-bold tracking-widest text-cyan-400">[ NETWORK_TRAFFIC ]</span>
        <span className="ml-auto text-xs text-cyan-400/80">
          {Math.floor(data[data.length - 1].value)}.{(Math.random()*99).toFixed(0)} TB/s
        </span>
      </div>
      <div className="flex-1 w-full min-h-[120px] relative mt-2 bg-black/40 border border-cyan-500/10 rounded overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, 100]} />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#22d3ee" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* Glow Overlay */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_20px_rgba(6,182,212,0.15)] rounded" />
      </div>
    </div>
  );
}
