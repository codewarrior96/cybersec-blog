'use client';
import React from 'react';

export default function ThreatMapWidget() {
  return (
    <div className="absolute inset-0 flex flex-col font-mono overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#00ff41]/20 z-20 bg-[#021518]/90 shrink-0">
        <span className="text-[12px] lg:text-sm font-bold tracking-widest uppercase text-[#e2e8f0]">CYBER THREAT MAP</span>
        <span className="text-slate-500 tracking-widest text-[10px]">LIVE THREAT DETECTION</span>
      </div>
      
      {/* Map Area — fills remaining height */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        
        {/* Radar Center Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,65,0.04)_0%,transparent_70%)] pointer-events-none z-0" />

        {/* World Map SVG */}
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          <svg viewBox="0 0 1000 500" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            
            <defs>
              <mask id="world-map-mask-tm">
                <image href="/world.svg" x="0" y="0" width="1000" height="500" />
              </mask>
            </defs>
            {/* Landmass — bright teal-green, clearly visible */}
            <rect x="0" y="0" width="1000" height="500" fill="#1e4a38" mask="url(#world-map-mask-tm)" opacity="1" />
            <rect x="0" y="0" width="1000" height="500" fill="#22d3ee" mask="url(#world-map-mask-tm)" opacity="0.06" />

            {/* Hub to Moscow */}
            <path d="M 480 200 Q 530 140 590 160" stroke="rgba(239, 68, 68, 0.7)" strokeWidth="1.5" fill="none" className="animate-pulse" />
            {/* Hub to Beijing */}
            <path d="M 480 200 Q 640 150 750 210" stroke="rgba(239, 68, 68, 0.7)" strokeWidth="1.5" fill="none" />
            {/* Hub to US East */}
            <path d="M 480 200 Q 380 130 250 200" stroke="rgba(34, 211, 238, 0.6)" strokeWidth="1.5" fill="none" />
            {/* Hub to London */}
            <path d="M 480 200 Q 460 160 445 185" stroke="rgba(34, 211, 238, 0.8)" strokeWidth="1.5" fill="none" />
            {/* Hub to Brazil */}
            <path d="M 480 200 Q 400 280 320 320" stroke="rgba(34, 211, 238, 0.4)" strokeWidth="1.2" fill="none" />
            {/* Hub to South Africa */}
            <path d="M 480 200 Q 500 280 520 350" stroke="rgba(34, 211, 238, 0.35)" strokeWidth="1" fill="none" />
            {/* US East to West Coast */}
            <path d="M 250 200 Q 200 170 150 190" stroke="rgba(0, 255, 65, 0.4)" strokeWidth="1" strokeDasharray="4 2" fill="none" />

            {/* Central Hub (Europe) */}
            <circle cx="480" cy="200" r="10" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.5" />
            <circle cx="480" cy="200" r="4" fill="#ef4444" className="animate-pulse" />
            <circle cx="480" cy="200" r="24" fill="none" stroke="#ef4444" strokeWidth="0.8" opacity="0.35" className="animate-[ping_2s_infinite]" />

            {/* Moscow */}
            <circle cx="590" cy="160" r="6" fill="#ef4444" />
            <circle cx="590" cy="160" r="14" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.5" className="animate-spin" strokeDasharray="2 4" style={{ transformOrigin: '590px 160px' }} />
            <text x="605" y="164" fill="#e2e8f0" fontSize="13" fontFamily="monospace" fontWeight="bold">Moscow</text>

            {/* Beijing */}
            <circle cx="750" cy="210" r="6" fill="#ef4444" />
            <circle cx="750" cy="210" r="15" fill="none" stroke="#ef4444" strokeWidth="0.7" opacity="0.5" className="animate-pulse" />
            <text x="765" y="214" fill="#e2e8f0" fontSize="13" fontFamily="monospace" fontWeight="bold">Beijing</text>

            {/* US East */}
            <circle cx="250" cy="200" r="5" fill="#22d3ee" />
            <circle cx="250" cy="200" r="12" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="3 3" className="animate-[spin_4s_linear_infinite]" style={{ transformOrigin: '250px 200px' }} />

            {/* London */}
            <circle cx="445" cy="185" r="4" fill="#22d3ee" />
            <text x="420" y="205" fill="#94a3b8" fontSize="12" fontFamily="monospace">London</text>

            {/* Brazil */}
            <circle cx="320" cy="320" r="4" fill="#22d3ee" />
            <circle cx="320" cy="320" r="10" fill="none" stroke="#22d3ee" strokeWidth="0.5" className="animate-ping" />

            {/* South Africa */}
            <circle cx="520" cy="350" r="3" fill="#22d3ee" opacity="0.8" />

            {/* West Coast US */}
            <circle cx="150" cy="190" r="3" fill="#00ff41" className="animate-pulse" />

            {/* ANIMATED PACKETS */}
            <circle cx="0" cy="0" r="2.5" fill="#fb7185" className="animate-[move1_2s_linear_infinite]" style={{ offsetPath: "path('M 480 200 Q 530 140 590 160')" } as React.CSSProperties} />
            <circle cx="0" cy="0" r="2" fill="#fb7185" className="animate-[move1_2.5s_linear_infinite_0.8s]" style={{ offsetPath: "path('M 480 200 Q 530 140 590 160')" } as React.CSSProperties} />
            <circle cx="0" cy="0" r="2.5" fill="#fb7185" className="animate-[move1_3s_linear_infinite]" style={{ offsetPath: "path('M 480 200 Q 640 150 750 210')" } as React.CSSProperties} />
            <circle cx="0" cy="0" r="2" fill="#67e8f9" className="animate-[move1_2.5s_linear_infinite]" style={{ offsetPath: "path('M 480 200 Q 380 130 250 200')" } as React.CSSProperties} />
            <circle cx="0" cy="0" r="2" fill="#67e8f9" className="animate-[move1_3.5s_linear_infinite_1s]" style={{ offsetPath: "path('M 480 200 Q 400 280 320 320')" } as React.CSSProperties} />
          </svg>
        </div>

        {/* Bottom Left — LIVE THREAT DETECTION */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full border border-red-500/80 flex items-center justify-center relative shadow-[0_0_12px_rgba(239,68,68,0.5)] bg-red-500/10">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping absolute" />
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
          </div>
          <span className="text-[13px] lg:text-[15px] font-bold text-red-500 tracking-widest drop-shadow-[0_0_8px_rgba(239,68,68,0.9)] uppercase">LIVE THREAT DETECTION</span>
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
