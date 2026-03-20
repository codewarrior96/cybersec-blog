'use client';

import React from 'react';

export default function Logo() {
  return (
    <div className="relative flex items-center gap-3 group cursor-pointer select-none">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes svb-pulse {
          0%, 100% { filter: drop-shadow(0 0 5px rgba(0,255,65,0.4)) drop-shadow(0 0 10px rgba(0,255,65,0.1)); }
          50% { filter: drop-shadow(0 0 10px #00ff41) drop-shadow(0 0 20px rgba(0,255,65,0.5)); transform: scale(1.02); }
        }
        @keyframes scanline {
          0% { transform: translateY(-10px); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translateY(40px); opacity: 0; }
        }
        @keyframes dash-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes inner-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .logo-icon-container {
          position: relative;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .group:hover .logo-icon-container {
          animation: svb-pulse 1.5s ease-in-out infinite;
        }
        .logo-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        
        /* The Shield outline */
        .logo-shield {
          fill: none;
          stroke: #00ff41;
          stroke-width: 1.5;
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: dash-draw 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          opacity: 0.8;
          transition: stroke 0.3s ease, filter 0.3s ease;
        }
        .group:hover .logo-shield {
          stroke: #66ff8f;
          filter: drop-shadow(0 0 8px #00ff41);
        }

        /* The Inner core geometric shapes */
        .logo-core {
          fill: rgba(0,255,65,0.1);
          stroke: #00ff41;
          stroke-width: 1;
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: dash-draw 2s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards;
          transform-origin: center;
        }
        .group:hover .logo-core {
          animation: inner-spin 10s linear infinite;
          fill: rgba(0,255,65,0.25);
        }

        /* Glitch Text Layering */
        .logo-text-wrapper {
          position: relative;
          display: inline-block;
          font-family: monospace;
          font-weight: 800;
          letter-spacing: -0.02em;
          font-size: 1.15rem;
          color: #cbd5e1; /* slate-300 */
          transition: color 0.3s;
        }

        .logo-text-glitch-1, .logo-text-glitch-2 {
          position: absolute;
          top: 0;
          left: 0;
          opacity: 0;
          color: #00ff41; 
          pointer-events: none;
        }

        .logo-text-wrapper:hover .logo-text-glitch-1 {
          opacity: 0.7;
          animation: glitch-anim-1 0.4s infinite linear alternate-reverse;
          color: #ff00ea; /* magenta glitch */
        }
        .logo-text-wrapper:hover .logo-text-glitch-2 {
          opacity: 0.7;
          animation: glitch-anim-2 0.3s infinite linear alternate-reverse;
          color: #00ccff; /* cyan glitch */
        }

        .group:hover .logo-text-wrapper {
          text-shadow: 0 0 8px rgba(0,255,65,0.4);
        }

        .logo-text-bracket {
          color: #475569; /* slate-600 */
          font-weight: 500;
          transition: color 0.3s;
        }
        .group:hover .logo-text-bracket {
          color: #00ff41;
          opacity: 0.7;
        }

        .logo-cursor {
          display: inline-block;
          width: 8px;
          height: 16px;
          background-color: #00ff41;
          margin-left: 2px;
          vertical-align: middle;
          animation: blink 1s step-end infinite;
          box-shadow: 0 0 8px #00ff41;
        }

        @keyframes glitch-anim-1 {
          0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px, 1px); }
          20% { clip-path: inset(60% 0 10% 0); transform: translate(2px, -1px); }
          40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px, 2px); }
          60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); }
          80% { clip-path: inset(10% 0 70% 0); transform: translate(-2px, 1px); }
          100% { clip-path: inset(30% 0 50% 0); transform: translate(2px, -1px); }
        }
        @keyframes glitch-anim-2 {
          0% { clip-path: inset(10% 0 60% 0); transform: translate(2px, -1px); }
          20% { clip-path: inset(80% 0 5% 0); transform: translate(-2px, 2px); }
          40% { clip-path: inset(30% 0 20% 0); transform: translate(2px, 1px); }
          60% { clip-path: inset(70% 0 10% 0); transform: translate(-2px, -1px); }
          80% { clip-path: inset(40% 0 50% 0); transform: translate(2px, 2px); }
          100% { clip-path: inset(5% 0 80% 0); transform: translate(-2px, -2px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}} />

      {/* Futuristic SVG Icon */}
      <div className="logo-icon-container">
        <svg viewBox="0 0 100 100" className="logo-svg">
          {/* Hexagon Outline Shield */}
          <path 
            className="logo-shield" 
            d="M 50 5 L 90 25 L 90 75 L 50 95 L 10 75 L 10 25 Z" 
          />
          
          {/* Inner Circuit/Eye Elements */}
          <g className="logo-core">
            <path d="M 50 25 L 75 50 L 50 75 L 25 50 Z" />
            <circle cx="50" cy="50" r="8" fill="#00ff41" opacity="0.8" />
            <circle cx="50" cy="50" r="15" fill="none" stroke="#00ff41" strokeWidth="2" strokeDasharray="4 4" />
          </g>
          
          {/* Scanning Line overlay inside svg container */}
          <rect x="0" y="0" width="100" height="2" fill="#00ff41" style={{ animation: 'scanline 2.5s linear infinite' }} />
        </svg>
      </div>

      {/* Styled Typography */}
      <div className="flex items-center gap-0.5 mt-1">
        <span className="logo-text-bracket">[</span>
        <div className="logo-text-wrapper ml-1">
          <span className="text-green-400 font-normal opacity-70">~/</span>cybersec
          <span className="logo-text-glitch-1" aria-hidden="true">~/cybersec</span>
          <span className="logo-text-glitch-2" aria-hidden="true">~/cybersec</span>
        </div>
        <span className="logo-text-bracket mr-1">]</span>
        <span className="logo-cursor" />
      </div>

    </div>
  );
}
