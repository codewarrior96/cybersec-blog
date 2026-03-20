'use client';
import React, { useEffect, useState, useRef } from 'react';

const mockLogs = [
  { type: 'ALERT', time: '14:01:23', msg: 'Brute force attack detected on SHADOW_SRV (192.168.1.102)' },
  { type: 'INFO', time: '14:01:21', msg: 'Updated signatures database successfully' },
  { type: 'MALWARE', time: '14:01:18', msg: 'Phishing campaign blocked' },
  { type: 'SYS', time: '14:01:15', msg: 'Brute canettiva set load high (192.168.1.62)' },
  { type: 'HEX', time: '', msg: '6kG0020001 hexC8065 5a8e525620' },
  { type: 'HEX', time: '', msg: '8hG0820002 hexc03ee 982808c002' },
  { type: 'HEX', time: '', msg: '0000000008 hexC8065 9a6e886380' },
  { type: 'HEX', time: '', msg: '0000000000 hexC00E5 8758952728' },
  { type: 'HEX', time: '', msg: '0000600900 hexc0865 0277328fF5' },
  { type: 'MALWARE', time: '14:01:18', msg: '1hX001000 hexC0565 985004c62d blocked' },
  { type: 'INFO', time: '14:01:23', msg: 'Brute fore secatine beoond tev cod protoslos -A...' },
  { type: 'INFO', time: '14:01:23', msg: '#0060270000 signature matched' },
  { type: 'INFO', time: '14:01:23', msg: '#8000306500 packet analyzed' },
];

export default function TerminalLogWidget() {
  const [logs, setLogs] = useState<typeof mockLogs>([mockLogs[0], mockLogs[1], mockLogs[2]]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 3;
    const interval = setInterval(() => {
      setLogs((prev) => {
        const newLogs = [...prev, mockLogs[i % mockLogs.length]];
        if (newLogs.length > 50) newLogs.shift();
        return newLogs;
      });
      i++;
    }, 600);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getColor = (type: string) => {
    if (type === 'ALERT') return 'text-red-500';
    if (type === 'MALWARE') return 'text-cyan-400';
    if (type === 'HEX') return 'text-orange-400 opacity-90';
    if (type === 'SYS') return 'text-slate-300';
    return 'text-[#00ff41]';
  };

  return (
    <div className="absolute inset-0 p-4 flex flex-col font-mono overflow-hidden">
      {/* Outer Header: THREAT FEED */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#00ff41]/20 z-10 bg-[#021518]/80 -mx-4 -mt-4 mb-4">
        <span className="text-[12px] lg:text-sm font-bold text-slate-200 tracking-widest uppercase mt-1">THREAT FEED</span>
        <span className="text-slate-500 tracking-widest text-[10px]">...</span>
      </div>
      
      {/* Inner Box: DATA-STREAM GRID */}
      <div className="flex-1 flex flex-col border border-[#00ff41]/20 rounded bg-[#021a20]/40 overflow-hidden relative">
        <div className="flex justify-between items-center px-4 py-2 border-b border-[#00ff41]/20 z-10 bg-[#021518]/50">
          <span className="text-[10px] lg:text-xs font-bold text-slate-300 tracking-widest uppercase">DATA-STREAM GRID</span>
          <span className="text-slate-500 tracking-widest text-[10px]">...</span>
        </div>
        
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent text-[10px] leading-tight font-medium relative"
        >
          <div className="relative z-0 space-y-2 py-2 pb-4">
            {logs.map((log, idx) => (
              <div key={idx} className={`${getColor(log.type)}`}>
                {log.type === 'HEX' ? (
                  <span className="block break-words tracking-widest bg-[#001114]/50 border-y border-orange-500/20 py-0.5">{log.msg}</span>
                ) : (
                  <>
                    <span className="mr-2 opacity-90">[{log.type}] {log.time}</span>
                    <span className="block opacity-80 break-words mt-0.5">{log.msg}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Top Edge Fade Inside Box */}
        <div className="absolute top-[32px] left-0 right-0 h-4 bg-gradient-to-b from-[#021518] to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
