'use client';
import React from 'react';

export default function ThreatMapWidget() {
  return (
    <div className="h-full flex flex-col font-mono relative overflow-hidden group">
      <div className="flex justify-between items-center mb-4 z-10 border-b border-green-500/20 pb-2">
        <span className="text-[11px] lg:text-sm font-bold tracking-widest text-slate-200 group-hover:text-white transition-colors">CYBER THREAT MAP</span>
        <span className="text-[9px] lg:text-[10px] text-green-500/50 tracking-widest uppercase">LIVE THREAT DETECTION</span>
      </div>
      
      <div className="flex-1 relative flex items-center justify-center mt-2 bg-black/40 rounded shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] border border-green-500/10 overflow-hidden">
        {/* Simplified pseudo-world map backdrop using a subtle SVG or CSS approach. 
            For exact shape, a stylized node network is visually distinct and robust. */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] bg-center bg-no-repeat bg-cover filter invert sepia hue-rotate-[130deg] saturate-[300%] brightness-[1]" />

        {/* Radar Center Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,65,0.05)_0%,transparent_70%)] pointer-events-none" />

        {/* Overlay Vectors and Connections */}
        <svg viewBox="0 0 800 400" className="w-full h-full absolute inset-0 z-10 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
          
          {/* Attack Arcs */}
          {/* Moscow to US */}
          <path d="M 460 120 Q 300 50 180 150" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="2" fill="none" />
          {/* Beijing to Europe */}
          <path d="M 640 160 Q 550 100 460 120" stroke="rgba(239, 68, 68, 0.5)" strokeWidth="1.5" fill="none" />
          {/* London to US */}
          <path d="M 380 120 Q 280 100 180 150" stroke="rgba(0, 255, 65, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
          {/* US to South America */}
          <path d="M 180 150 Q 200 250 250 300" stroke="rgba(0, 255, 65, 0.3)" strokeWidth="1" fill="none" />

          {/* Animated Packets */}
          <circle cx="0" cy="0" r="3" fill="#ef4444" className="animate-[move1_3s_linear_infinite]" style={{ offsetPath: "path('M 460 120 Q 300 50 180 150')" } as React.CSSProperties} />
          <circle cx="0" cy="0" r="3" fill="#ef4444" className="animate-[move1_3s_linear_infinite_0.5s]" style={{ offsetPath: "path('M 640 160 Q 550 100 460 120')" } as React.CSSProperties} />
          <circle cx="0" cy="0" r="2" fill="#00ff41" className="animate-[move1_2.5s_linear_infinite]" style={{ offsetPath: "path('M 380 120 Q 280 100 180 150')" } as React.CSSProperties} />

          {/* Nodes */}
          {/* Moscow */}
          <circle cx="460" cy="120" r="6" fill="#ef4444" opacity="0.8" className="animate-pulse" />
          <circle cx="460" cy="120" r="16" fill="none" stroke="#ef4444" strokeWidth="1" className="animate-[ping_2s_infinite]" />
          <circle cx="460" cy="120" r="22" fill="none" stroke="#ef4444" strokeWidth="0.5" opacity="0.5" />
          <text x="475" y="115" fill="#cbd5e1" fontSize="14" className="tracking-wider drop-shadow-md">Moscow</text>

          {/* Beijing */}
          <circle cx="640" cy="160" r="6" fill="#ef4444" opacity="0.8" />
          <circle cx="640" cy="160" r="14" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.5" className="animate-spin" strokeDasharray="4 4" style={{ transformOrigin: '640px 160px' }} />
          <text x="655" y="165" fill="#cbd5e1" fontSize="14" className="tracking-wider">Beijing</text>

          {/* London */}
          <circle cx="380" cy="120" r="5" fill="#00ff41" opacity="0.8" />
          <circle cx="380" cy="120" r="10" fill="none" stroke="#00ff41" strokeWidth="1" opacity="0.5" className="animate-pulse" />
          <text x="360" y="140" fill="#00f0ff" fontSize="11" opacity="0.8">London</text>

          {/* Central US (New York/DC) */}
          <circle cx="180" cy="150" r="6" fill="#00ff41" opacity="0.9" />
          <circle cx="180" cy="150" r="15" fill="none" stroke="#00ff41" strokeWidth="1" strokeDasharray="2 2" className="animate-[spin_6s_linear_infinite]" style={{ transformOrigin: '180px 150px' }} />
          <text x="140" y="130" fill="#00f0ff" fontSize="12" opacity="0.9">US_EAST</text>

          {/* South America (Sao Paulo) */}
          <circle cx="250" cy="300" r="4" fill="#00ff41" opacity="0.6" />
          <text x="210" y="320" fill="#00f0ff" fontSize="10" opacity="0.6">SA_NODE</text>
        </svg>

        {/* Bottom Status Marker */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 bg-[#0a1114]/80 p-2 border border-red-500/20 backdrop-blur-md rounded">
          <div className="w-5 h-5 rounded-full border-2 border-red-500/50 flex items-center justify-center relative shadow-[0_0_10px_rgba(239,68,68,0.5)]">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping absolute" />
            <div className="w-2 h-2 bg-red-500 rounded-full" />
          </div>
          <span className="text-[11px] lg:text-sm font-bold text-red-500 tracking-widest drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">LIVE THREAT DETECTION</span>
        </div>
      </div>
      
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
