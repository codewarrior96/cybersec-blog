'use client';
import React from 'react';
import { Target } from 'lucide-react';

export default function ThreatMapWidget() {
  return (
    <div className="h-full flex flex-col font-mono relative group">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-green-500/20 z-10 relative">
        <Target className="text-green-400 w-5 h-5 drop-shadow-[0_0_8px_rgba(0,255,65,0.8)]" />
        <span className="text-sm font-bold tracking-widest text-green-400">[ THREAT_MAP ]</span>
        <span className="ml-auto text-[10px] text-green-500/50">SECURE_TUNNEL_ACTIVE</span>
      </div>
      
      {/* SVG Map Container */}
      <div className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_center,rgba(0,255,65,0.05)_0%,transparent_70%)] rounded-lg flex items-center justify-center">
        {/* Radar Sweeps */}
        <div className="absolute inset-0 rounded-full border border-green-500/10 scale-50 opacity-20" />
        <div className="absolute inset-0 rounded-full border border-green-500/10 scale-75 opacity-20" />
        <div className="absolute inset-0 rounded-full border border-green-500/10 scale-95 opacity-20" />
        
        <svg viewBox="0 0 400 300" className="w-full h-full drop-shadow-[0_0_5px_rgba(0,255,65,0.4)]">
          {/* Paths */}
          <path id="path1" d="M 200 150 L 100 80" stroke="rgba(0, 255, 65, 0.3)" strokeWidth="1" strokeDasharray="5,5" fill="none" />
          <path id="path2" d="M 200 150 L 300 100" stroke="rgba(0, 255, 65, 0.3)" strokeWidth="1" fill="none" />
          <path id="path3" d="M 250 220 L 200 150" stroke="rgba(0, 255, 65, 0.3)" strokeWidth="1" fill="none" />
          <path id="path4" d="M 200 150 L 80 200" stroke="rgba(0, 255, 65, 0.3)" strokeWidth="1" strokeDasharray="5,5" fill="none" />
          <path id="path5" d="M 300 100 L 350 180" stroke="rgba(0, 255, 65, 0.2)" strokeWidth="1" fill="none" />
          
          {/* Default SVGs using offset-path can be tricky without CSS setup. We will use simple CSS for the dots. */}
          <circle cx="0" cy="0" r="2.5" fill="#00ff41" className="animate-[move1_3s_linear_infinite]" style={{ offsetPath: "path('M 200 150 L 100 80')" } as React.CSSProperties} />
          <circle cx="0" cy="0" r="2.5" fill="#00ff41" className="animate-[move1_2s_linear_infinite]" style={{ offsetPath: "path('M 200 150 L 300 100')" } as React.CSSProperties} />
          <circle cx="0" cy="0" r="2.5" fill="#ff00ea" className="animate-[move1_4s_linear_infinite]" style={{ offsetPath: "path('M 250 220 L 200 150')" } as React.CSSProperties} />
          <circle cx="0" cy="0" r="2.5" fill="#00ff41" className="animate-[move1_2.5s_linear_infinite]" style={{ offsetPath: "path('M 200 150 L 80 200')" } as React.CSSProperties} />

          {/* Nodes */}
          {/* Central Node */}
          <circle cx="200" cy="150" r="8" fill="#001105" stroke="#00ff41" strokeWidth="2" className="animate-pulse" />
          <circle cx="200" cy="150" r="14" fill="none" stroke="#00ff41" strokeWidth="1" opacity="0.3" className="animate-[ping_3s_infinite]" />
          <text x="215" y="155" fill="#00ff41" fontSize="10" className="font-mono tracking-widest">CORE_DB</text>

          {/* Peripheral Nodes */}
          <circle cx="100" cy="80" r="5" fill="#00ff41" opacity="0.8" />
          <text x="80" y="65" fill="#00ff41" fontSize="8" opacity="0.7">WEB_NODE_1</text>
          
          <circle cx="300" cy="100" r="6" fill="#00ff41" opacity="0.9" />
          <circle cx="300" cy="100" r="12" fill="none" stroke="#00ff41" strokeWidth="1" strokeDasharray="2,2" className="animate-[spin_4s_linear_infinite]" style={{ transformOrigin: '300px 100px' }} />
          <text x="315" y="105" fill="#00ff41" fontSize="8" opacity="0.7">API_GATEWAY</text>
          
          <circle cx="250" cy="220" r="5" fill="#ff00ea" opacity="0.8" />
          <circle cx="250" cy="220" r="10" fill="none" stroke="#ff00ea" strokeWidth="1" opacity="0.5" className="animate-pulse" />
          <text x="260" y="235" fill="#ff00ea" fontSize="8" opacity="0.9">UNKNOWN_PEER</text>
          
          <circle cx="80" cy="200" r="4" fill="#00ff41" opacity="0.5" />
          <text x="45" y="215" fill="#00ff41" fontSize="8" opacity="0.5">DEV_ENV</text>
          
          <circle cx="350" cy="180" r="4" fill="#00ff41" opacity="0.4" />
        </svg>

        {/* Floating Tooltip visible on hover */}
        <div className="absolute top-4 right-4 bg-black/80 border border-green-500/40 p-3 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,65,0.2)]">
          <div className="mb-1"><span className="text-green-500/50">TARGET:</span> MULTIPLE_NODES</div>
          <div className="mb-1"><span className="text-green-500/50">STATUS:</span> <span className="text-green-400">SECURE</span></div>
          <div><span className="text-green-500/50">VULNERABILITY:</span> <span className="text-red-400 animate-pulse">DETECTED_AT_PEER</span></div>
        </div>
      </div>
      
      {/* Required CSS for offset path animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes move1 {
          0% { offset-distance: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
      `}} />
    </div>
  );
}
