'use client';
import React from 'react';

export default function ThreatMapWidget() {
  return (
    <div className="h-full flex flex-col font-mono relative overflow-hidden group w-full bg-[#070b0e]">
      <div className="flex justify-between items-center z-20 pb-2 relative px-2">
        <span className="text-[12px] lg:text-sm font-bold tracking-widest text-slate-200 uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">CYBER THREAT MAP</span>
        <span className="text-[9px] lg:text-[10px] text-slate-400 tracking-widest uppercase">LIVE THREAT DETECTION</span>
      </div>
      
      <div className="flex-1 relative flex items-center justify-center mt-2 w-full h-full bg-[#0a1114] border border-green-500/10 rounded overflow-hidden">
        
        {/* Radar Center Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,65,0.03)_0%,transparent_70%)] pointer-events-none" />

        {/* Threat Overlay Vectors - The single SVG source of truth */}
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center p-2">
          <svg viewBox="0 0 1000 500" className="w-full h-full drop-shadow-[0_0_5px_rgba(0,0,0,0.8)] saturate-[1.2]" preserveAspectRatio="xMidYMid meet">
            
            {/* 1. Flawless SVG Background Alignment via Inline Masking */}
            <defs>
              <mask id="world-map-mask">
                {/* SVG path mask uses the luminance to block out the oceans */}
                <image href="/world.svg" x="0" y="0" width="1000" height="500" />
              </mask>
            </defs>
            {/* The actual colored landmass locked inside the SVG coordinates */}
            <rect x="0" y="0" width="1000" height="500" fill="#182e2c" mask="url(#world-map-mask)" opacity="0.9" />

            {/* ARC DEFINITIONS: Central Hub approx (480, 200) Europe */}
            {/* Hub to Moscow (590, 160) - Red */}
            <path d="M 480 200 Q 530 140 590 160" stroke="rgba(239, 68, 68, 0.6)" strokeWidth="1.5" fill="none" className="animate-pulse" />
            
            {/* Hub to Beijing (750, 210) - Red */}
            <path d="M 480 200 Q 640 150 750 210" stroke="rgba(239, 68, 68, 0.6)" strokeWidth="1.5" fill="none" />

            {/* Hub to US East (250, 200) - Cyan */}
            <path d="M 480 200 Q 380 130 250 200" stroke="rgba(34, 211, 238, 0.6)" strokeWidth="1.5" fill="none" />

            {/* Hub to London (445, 185) - Cyan */}
            <path d="M 480 200 Q 460 160 445 185" stroke="rgba(34, 211, 238, 0.8)" strokeWidth="1.5" fill="none" />

            {/* Hub to Brazil (320, 320) - Cyan */}
            <path d="M 480 200 Q 400 280 320 320" stroke="rgba(34, 211, 238, 0.4)" strokeWidth="1.5" fill="none" />

            {/* Hub to South Africa (520, 350) - Cyan */}
            <path d="M 480 200 Q 500 280 520 350" stroke="rgba(34, 211, 238, 0.4)" strokeWidth="1.5" fill="none" />

            {/* US East to West Coast US (150, 190) - Cyan */}
            <path d="M 250 200 Q 200 170 150 190" stroke="rgba(0, 255, 65, 0.4)" strokeWidth="1" strokeDasharray="4 2" fill="none" />


            {/* NODES */}
            {/* Central Hub (Europe) */}
            <circle cx="480" cy="200" r="10" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1.5" />
            <circle cx="480" cy="200" r="4" fill="#ef4444" className="animate-pulse" />
            <circle cx="480" cy="200" r="24" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4" className="animate-[ping_2s_infinite]" />

            {/* Moscow */}
            <circle cx="590" cy="160" r="6" fill="#ef4444" />
            <circle cx="590" cy="160" r="14" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" className="animate-spin" strokeDasharray="2 4" style={{ transformOrigin: '590px 160px' }} />
            <text x="605" y="164" fill="#e2e8f0" fontSize="13" className="tracking-widest drop-shadow-[0_0_5px_rgba(0,0,0,1)] font-bold">Moscow</text>

            {/* Beijing */}
            <circle cx="750" cy="210" r="6" fill="#ef4444" />
            <circle cx="750" cy="210" r="16" fill="none" stroke="#ef4444" strokeWidth="0.5" opacity="0.6" className="animate-pulse" />
            <text x="765" y="214" fill="#e2e8f0" fontSize="13" className="tracking-widest font-bold">Beijing</text>

            {/* US East */}
            <circle cx="250" cy="200" r="5" fill="#22d3ee" />
            <circle cx="250" cy="200" r="12" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="3 3" className="animate-[spin_4s_linear_infinite]" style={{ transformOrigin: '250px 200px' }} />

            {/* London */}
            <circle cx="445" cy="185" r="4" fill="#22d3ee" />
            <text x="420" y="205" fill="#cbd5e1" fontSize="12" className="tracking-wider">London</text>

            {/* Brazil */}
            <circle cx="320" cy="320" r="4" fill="#22d3ee" />
            <circle cx="320" cy="320" r="10" fill="none" stroke="#22d3ee" strokeWidth="0.5" className="animate-ping" />

            {/* South Africa */}
            <circle cx="520" cy="350" r="3" fill="#22d3ee" opacity="0.8" />

            {/* West Coast US */}
            <circle cx="150" cy="190" r="3" fill="#00ff41" className="animate-pulse" />


            {/* ANIMATED PACKETS */}
            <circle cx="0" cy="0" r="2.5" fill="#fb7185" className="animate-[move1_2s_linear_infinite]" style={{ offsetPath: "path('M 480 200 Q 530 140 590 160')" } as React.CSSProperties} />
            <circle cx="0" cy="0" r="2" fill="#fb7185" className="animate-[move1_2s_linear_infinite_0.8s]" style={{ offsetPath: "path('M 480 200 Q 530 140 590 160')" } as React.CSSProperties} />
            <circle cx="0" cy="0" r="2.5" fill="#fb7185" className="animate-[move1_3s_linear_infinite]" style={{ offsetPath: "path('M 480 200 Q 640 150 750 210')" } as React.CSSProperties} />
            <circle cx="0" cy="0" r="2" fill="#67e8f9" className="animate-[move1_2.5s_linear_infinite]" style={{ offsetPath: "path('M 480 200 Q 380 130 250 200')" } as React.CSSProperties} />
            <circle cx="0" cy="0" r="2" fill="#67e8f9" className="animate-[move1_3.5s_linear_infinite_1s]" style={{ offsetPath: "path('M 480 200 Q 400 280 320 320')" } as React.CSSProperties} />
          </svg>
        </div>

        {/* Bottom Left Target Icon (LIVE THREAT DETECTION) */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-red-500/80 flex items-center justify-center relative shadow-[0_0_15px_rgba(239,68,68,0.5)] bg-red-500/10">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute" />
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <div className="w-10 h-10 rounded-full border border-red-500/40 absolute animate-[pulse_2s_infinite]" />
          </div>
          <span className="text-[14px] lg:text-[16px] font-bold text-red-500 tracking-widest drop-shadow-[0_0_8px_rgba(239,68,68,0.9)] uppercase">LIVE THREAT DETECTION</span>
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
