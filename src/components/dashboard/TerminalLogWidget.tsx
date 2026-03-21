'use client';
import React, { useEffect, useState, useRef } from 'react';
import type { AttackEvent } from '@/lib/dashboard-types';

const mockLogs = [
  { type: 'ALERT',  time: '14:01:23', msg: 'Brute force attack detected on SHADOW_SRV (192.168.1.102)' },
  { type: 'INFO',   time: '14:01:21', msg: 'Updated signatures database successfully' },
  { type: 'MALWARE',time: '14:01:18', msg: 'Phishing campaign blocked' },
  { type: 'SYS',   time: '14:01:15', msg: 'Brute canettiva set load high (192.168.1.62)' },
  { type: 'HEX',   time: '', msg: '6kG0020001 hexC8065 5a8e525620' },
  { type: 'HEX',   time: '', msg: '8hG0820002 hexc03ee 982808c002' },
  { type: 'HEX',   time: '', msg: '0000000008 hexC8065 9a6e886380' },
  { type: 'HEX',   time: '', msg: '0000000000 hexC00E5 8758952728' },
  { type: 'HEX',   time: '', msg: '0000600900 hexc0865 0277328fF5' },
  { type: 'MALWARE',time: '14:01:18', msg: '1hX001000 hexC0565 985004c62d blocked' },
  { type: 'INFO',   time: '14:01:23', msg: 'Brute fore secatine beoond tev cod-protoslos -A...' },
  { type: 'INFO',   time: '14:01:23', msg: '#0060270000 signature matched' },
  { type: 'INFO',   time: '14:01:23', msg: '#8000306500 packet analyzed' },
  { type: 'ALERT',  time: '14:01:12', msg: 'Brute force scanning on SHADOW_SRV (192.168.0.82)' },
  { type: 'MALWARE',time: '14:01:18', msg: 'Phishing campaign blocked' },
  { type: 'SYS',   time: '14:01:15', msg: 'Server load high' },
  { type: 'INFO',   time: '14:01:21', msg: 'Updated signatures database successfully' },
];

interface TerminalLogWidgetProps {
  attacks?: AttackEvent[];
}

export default function TerminalLogWidget({ attacks = [] }: TerminalLogWidgetProps) {

  const [logs, setLogs] = useState<typeof mockLogs>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(100);

  useEffect(() => {
    if (attacks && attacks.length > 0) {
      const live = attacks.map(attack => ({
        type: attack.severity === 'critical' ? 'ALERT' : attack.severity === 'high' ? 'MALWARE' : 'INFO',
        time: attack.time || new Date(attack.createdAt).toLocaleTimeString('tr-TR'),
        msg: `${attack.type.toUpperCase()} from ${attack.sourceIP} port ${attack.targetPort}`
      }));
      setLogs(live);
    } else {
      let i = 5;
      const interval = setInterval(() => {
        setLogs((prev) => {
          const newLogs = [...prev, mockLogs[i % mockLogs.length]];
          if (newLogs.length > 40) newLogs.shift();
          return newLogs;
        });
        i++;
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [attacks]);


  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      const maxScroll = el.scrollHeight - el.clientHeight;
      setScrollPct(maxScroll > 0 ? (el.scrollTop / maxScroll) * 100 : 100);
    }
  }, [logs]);

  const getColor = (type: string) => {
    if (type === 'ALERT')   return 'text-red-500';
    if (type === 'MALWARE') return 'text-cyan-400';
    if (type === 'HEX')     return 'text-orange-400';
    if (type === 'SYS')     return 'text-slate-300';
    return 'text-[#00ff41]';
  };

  return (
    <div className="absolute inset-0 flex flex-col font-mono overflow-hidden">
      {/* Header: THREAT FEED */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#00ff41]/20 z-10 bg-[#021518]/90 shrink-0">
        <span className="text-[12px] lg:text-sm font-bold text-slate-200 tracking-widest uppercase">THREAT FEED</span>
        <span className="text-slate-500 tracking-widest text-[10px]">...</span>
      </div>

      {/* Inner Box: DATA-STREAM GRID */}
      <div className="flex-1 min-h-0 flex flex-col mx-3 my-3 border border-[#00ff41]/20 rounded bg-[#021a20]/40 overflow-hidden relative">
        <div className="flex justify-between items-center px-3 py-2 border-b border-[#00ff41]/20 z-10 bg-[#021518]/60 shrink-0">
          <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">DATA-STREAM GRID</span>
          <span className="text-slate-500 tracking-widest text-[10px]">...</span>
        </div>

        {/* Scroll area + green right indicator side-bar */}
        <div className="flex-1 min-h-0 flex overflow-hidden relative">
          {/* Log content */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-3 text-[9px] lg:text-[10px] leading-snug font-medium"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            <div className="space-y-1.5 py-2 pb-4">
              {logs.map((log, idx) => (
                <div key={idx} className={getColor(log.type)}>
                  {log.type === 'HEX' ? (
                    <span className="block break-all tracking-widest bg-[#001114]/50 border-y border-orange-500/10 py-0.5 text-[9px]">
                      {log.msg}
                    </span>
                  ) : (
                    <>
                      <span className="opacity-90 font-semibold">[{log.type}] {log.time}</span>
                      <span className="block opacity-80 break-words mt-0.5 pl-2">{log.msg}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Green right-edge indicator bar — matches target design */}
          <div className="w-1.5 shrink-0 bg-[#021a20] border-l border-[#00ff41]/10 relative overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 bg-[#00ff41] transition-all duration-300"
              style={{ height: `${scrollPct}%` }}
            />
            <div
              className="absolute left-0 right-0 h-3 bg-[#00ff41] animate-pulse shadow-[0_0_6px_#00ff41]"
              style={{ top: `${100 - scrollPct}%` }}
            />
          </div>
        </div>

        {/* Top fade */}
        <div className="absolute top-[33px] left-0 right-2 h-4 bg-gradient-to-b from-[#021518] to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}
