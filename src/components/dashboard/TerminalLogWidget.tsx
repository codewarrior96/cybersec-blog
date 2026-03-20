'use client';
import React, { useEffect, useState, useRef } from 'react';

const mockLogs = [
  { type: 'ALERT', time: '14:01:23', msg: 'Brute force attack detected on SHADOW_SRV (192.168.1.102)' },
  { type: 'INFO', time: '14:01:21', msg: 'Updated signatures database successfully' },
  { type: 'MALWARE', time: '14:01:18', msg: 'Phishing campaign block executed' },
  { type: 'SYS', time: '14:01:15', msg: 'Server node capacity at 88%' },
  { type: 'HEX', time: '', msg: '6k60020001 hexC00E5 5a8e525620' },
  { type: 'HEX', time: '', msg: '8hG0820002 hexC10Ee 902808c002' },
  { type: 'HEX', time: '', msg: '0000000008 hexC00E5 9a6e886300' },
  { type: 'MALWARE', time: '14:01:10', msg: '1hx001000 hexC0565 985004c62d blocked' },
  { type: 'INFO', time: '14:01:05', msg: '#0060270000 signature matched' },
  { type: 'INFO', time: '14:01:04', msg: '#8000306500 packet analyzed' },
];

export default function TerminalLogWidget() {
  const [logs, setLogs] = useState<typeof mockLogs>([mockLogs[0], mockLogs[1]]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 2;
    const interval = setInterval(() => {
      setLogs((prev) => {
        const newLogs = [...prev, mockLogs[i % mockLogs.length]];
        if (newLogs.length > 30) newLogs.shift();
        return newLogs;
      });
      i++;
    }, 600);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getColor = (type: string) => {
    if (type === 'ALERT') return 'text-red-500 drop-shadow-[0_0_2px_rgba(239,68,68,0.8)]';
    if (type === 'MALWARE') return 'text-[#ff00ea] drop-shadow-[0_0_2px_rgba(255,0,234,0.8)]';
    if (type === 'HEX') return 'text-slate-500';
    if (type === 'SYS') return 'text-slate-300';
    return 'text-[#00ff41] drop-shadow-[0_0_2px_rgba(0,255,65,0.6)]';
  };

  return (
    <div className="h-full flex flex-col font-mono relative overflow-hidden">
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-green-500/20 z-10 bg-[#0a1114]">
        <span className="text-[11px] lg:text-sm font-bold text-slate-200 tracking-widest uppercase">DATA-STREAM GRID</span>
        <span className="text-slate-500 tracking-widest text-[10px]">...</span>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent text-[10px] leading-tight font-medium relative">
        <div className="relative z-0 space-y-2 py-2">
          {logs.map((log, idx) => (
            <div key={idx} className={`${getColor(log.type)}`}>
              {log.time && <span className="mr-1 opacity-90">[{log.type}] {log.time}</span>}
              <span className="block opacity-80 break-words mt-0.5">{log.msg}</span>
            </div>
          ))}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>
      {/* Top Edge Fade */}
      <div className="absolute top-[32px] left-0 right-0 h-4 bg-gradient-to-b from-[#0a1114] to-transparent pointer-events-none" />
    </div>
  );
}
