'use client';
import React, { useEffect, useState, useRef } from 'react';
import type { AttackEvent } from '@/lib/dashboard-types';

const mockLogs = [
  { type: 'ALERT',   time: '14:01:23', msg: 'Brute force attack detected on SHADOW_SRV (192.168.1.102)' },
  { type: 'INFO',    time: '14:01:21', msg: 'Updated signatures database successfully' },
  { type: 'MALWARE', time: '14:01:18', msg: 'Phishing campaign blocked — source neutralized' },
  { type: 'SYS',    time: '14:01:15', msg: 'Node load elevated — redistributing (192.168.1.62)' },
  { type: 'HEX',    time: '',         msg: '6kG0020001 hexC8065 5a8e525620' },
  { type: 'HEX',    time: '',         msg: '8hG0820002 hexc03ee 982808c002' },
  { type: 'HEX',    time: '',         msg: '0000000008 hexC8065 9a6e886380' },
  { type: 'HEX',    time: '',         msg: '0000000000 hexC00E5 8758952728' },
  { type: 'HEX',    time: '',         msg: '0000600900 hexc0865 0277328fF5' },
  { type: 'MALWARE', time: '14:01:18', msg: '1hX001000 hexC0565 985004c62d blocked' },
  { type: 'INFO',    time: '14:01:23', msg: 'Sequence scan suppressed — firewall rule active' },
  { type: 'INFO',    time: '14:01:23', msg: '#0060270000 signature matched' },
  { type: 'INFO',    time: '14:01:23', msg: '#8000306500 packet analyzed' },
  { type: 'ALERT',   time: '14:01:12', msg: 'Port scan on SHADOW_SRV (192.168.0.82)' },
  { type: 'MALWARE', time: '14:01:18', msg: 'Phishing campaign blocked' },
  { type: 'SYS',    time: '14:01:15', msg: 'Server load nominal' },
  { type: 'INFO',    time: '14:01:21', msg: 'Signatures database updated' },
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
        time: new Date(attack.createdAt).toLocaleTimeString('tr-TR'),
        msg:  `${attack.type.toUpperCase()} from ${attack.sourceIP} port ${attack.targetPort}`,
      }));
      setLogs(live);
    } else {
      let i = 5;
      const interval = setInterval(() => {
        setLogs(prev => {
          const next = [...prev, mockLogs[i % mockLogs.length]];
          if (next.length > 40) next.shift();
          return next;
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
    if (type === 'MALWARE') return 'text-fuchsia-400';
    if (type === 'HEX')     return 'text-amber-400';
    if (type === 'SYS')     return 'text-violet-400';
    return 'text-purple-300';               // INFO
  };

  return (
    <div className="absolute inset-0 flex flex-col font-mono overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-violet-500/20 z-10 bg-[#0d0018]/90 shrink-0">
        <span className="text-[12px] lg:text-sm font-bold text-violet-400 tracking-widest uppercase">⬡ GHOST FEED</span>
        <span className="text-slate-500 tracking-widest text-[10px]">...</span>
      </div>

      {/* Inner box */}
      <div className="flex-1 min-h-0 flex flex-col mx-3 my-3 border border-violet-500/20 rounded bg-[#0a0015]/50 overflow-hidden relative">
        <div className="flex justify-between items-center px-3 py-2 border-b border-violet-500/20 z-10 bg-[#0d0018]/60 shrink-0">
          <span className="text-[10px] font-bold text-violet-400 tracking-widest uppercase">NEURAL FEED ACTIVE</span>
          <span className="text-slate-500 tracking-widest text-[10px]">...</span>
        </div>

        {/* Scroll area + violet indicator bar */}
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
                    <span className="block break-all tracking-widest bg-[#0d0018]/60 border-y border-amber-500/10 py-0.5 text-[9px]">
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

          {/* Violet right-edge scroll indicator */}
          <div className="w-1.5 shrink-0 bg-[#0a0015] border-l border-violet-500/10 relative overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 bg-violet-600 transition-all duration-300"
              style={{ height: `${scrollPct}%` }}
            />
            <div
              className="absolute left-0 right-0 h-3 bg-violet-400 animate-pulse shadow-[0_0_6px_#8b5cf6]"
              style={{ top: `${100 - scrollPct}%` }}
            />
          </div>
        </div>

        {/* Top fade */}
        <div className="absolute top-[33px] left-0 right-2 h-4 bg-gradient-to-b from-[#0d0018] to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}
