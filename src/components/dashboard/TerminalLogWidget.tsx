'use client';
import React, { useEffect, useState, useRef } from 'react';
import { Terminal } from 'lucide-react';

const mockLogs = [
  '[ OK ] Initializing core node routing protocol...',
  '[ INFO ] Fetching latest threat intelligence from CIRCL API',
  '[ WARN ] Unexpected traffic spike detected on port 443',
  '[ OK ] Intrusion Detection System (IDS) is active',
  '[ OK ] Decrypting payload... 100%',
  '[ ERROR ] Connection timed out to shadow-node-04',
  '[ INFO ] Re-routing traffic through secure tunnel B',
  '[ OK ] Payload execution isolated in sandboxed environment',
  '[ INFO ] Updating signature database (14,204 records)',
  '[ INFO ] Deep scan initiated on subnet 192.168.1.0/24'
];

export default function TerminalLogWidget() {
  const [logs, setLogs] = useState<string[]>([mockLogs[0]]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 1;
    const interval = setInterval(() => {
      setLogs((prev) => {
        const newLogs = [...prev, mockLogs[i % mockLogs.length]];
        if (newLogs.length > 25) newLogs.shift();
        return newLogs;
      });
      i++;
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="h-full flex flex-col focus:outline-none">
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="text-green-500/70 w-4 h-4" />
        <span className="text-xs font-mono text-green-500/70 tracking-widest">[ SYSTEM_LOGS ]</span>
      </div>
      <div className="flex-1 bg-black/60 border border-green-500/20 p-3 overflow-y-auto font-mono text-[11px] leading-loose relative shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
        <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,65,0.03)_2px,rgba(0,0,0,0.1)_4px)] z-10" />
        <div className="relative z-0">
          {logs.map((log, idx) => (
            <div key={idx} className={`mb-1 transition-all ${log.includes('[ ERROR ]') ? 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]' : log.includes('[ WARN ]') ? 'text-orange-400' : 'text-green-500/80'}`}>
              <span className="opacity-40 mr-3">[{new Date().toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
              {log}
            </div>
          ))}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>
    </div>
  );
}
