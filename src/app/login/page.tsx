"use client"

import MatrixRain from '@/components/MatrixRain'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="overflow-hidden w-screen h-screen bg-black relative font-mono">
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes eyePulse {
          0%, 100% { opacity: 0.5; box-shadow: 0 0 8px #00ff41, 0 0 20px rgba(0,255,65,0.6); }
          50% { opacity: 1; box-shadow: 0 0 12px #00ff41, 0 0 40px #00ff41, 0 0 80px rgba(0,255,65,0.5); }
        }
        @keyframes ringPulse {
          0%, 100% { box-shadow: 0 0 15px rgba(0,255,65,0.5), 0 0 30px rgba(0,255,65,0.3); opacity: 0.7; }
          50% { box-shadow: 0 0 25px rgba(0,255,65,0.9), 0 0 50px rgba(0,255,65,0.5), 0 0 80px rgba(0,255,65,0.2); opacity: 1; }
        }
        @keyframes skullFloat {
          0%, 100% { transform: translateY(0px) scale(1); filter: drop-shadow(0 0 6px rgba(0,255,65,0.8)); }
          50% { transform: translateY(-4px) scale(1.05); filter: drop-shadow(0 0 14px rgba(0,255,65,1)); }
        }
        @keyframes statusBlink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        .eye-pulse { animation: eyePulse 2s ease-in-out infinite; }
        .ring-pulse { animation: ringPulse 2.5s ease-in-out infinite; }
        .skull-float { animation: skullFloat 3s ease-in-out infinite; }
        .status-blink { animation: statusBlink 1.5s ease-in-out infinite; }
        .fade-slide-down { animation: fadeSlideDown 0.9s cubic-bezier(0.16,1,0.3,1) forwards; }
        .bg-image-zoom {
          transition: transform 8s ease-out;
          transform: scale(1.08);
        }
        .bg-image-zoom.loaded {
          transform: scale(1);
        }
      `}</style>

      {/* LAYER 1 — HACKER BACKGROUND */}
      <img
        src="/login-hacker.jpg"
        alt=""
        className={`absolute inset-0 w-full h-full object-cover object-center bg-image-zoom${mounted ? ' loaded' : ''}`}
        style={{ filter: 'brightness(0.4) saturate(1.2) hue-rotate(10deg)' }}
      />
      {/* Image overlay gradients */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,255,65,0.08) 0%, transparent 60%),
            linear-gradient(to top, black 0%, transparent 40%),
            linear-gradient(to bottom, black 0%, transparent 30%),
            linear-gradient(to right, black 0%, transparent 20%),
            linear-gradient(to left, black 0%, transparent 20%)
          `,
        }}
      />

      {/* LAYER 2 — MATRIX RAIN */}
      <div className="absolute inset-0" style={{ opacity: 0.2, mixBlendMode: 'screen' }}>
        <MatrixRain />
      </div>

      {/* LAYER 3 — SCANLINES */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 3px,
            rgba(0,0,0,0.4) 3px,
            rgba(0,0,0,0.4) 4px
          )`,
        }}
      />

      {/* LAYER 4 — NOISE GRAIN */}
      <div
        className="fixed inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* LAYER 5 — HACKER EYES GLOW */}
      <div
        className="absolute z-20 pointer-events-none flex items-center gap-12"
        style={{
          bottom: '36%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <div
          className="eye-pulse w-8 h-2 rounded-full bg-[#00ff41]"
          style={{
            boxShadow: '0 0 8px #00ff41, 0 0 25px #00ff41, 0 0 50px rgba(0,255,65,0.8), 0 0 100px rgba(0,255,65,0.4)',
          }}
        />
        <div
          className="eye-pulse w-8 h-2 rounded-full bg-[#00ff41]"
          style={{
            boxShadow: '0 0 8px #00ff41, 0 0 25px #00ff41, 0 0 50px rgba(0,255,65,0.8), 0 0 100px rgba(0,255,65,0.4)',
          }}
        />
      </div>

      {/* LAYER 6 — LOGIN CARD */}
      <div className="absolute inset-0 flex items-center justify-center z-30">
        <div
          className={`w-full max-w-[400px] mx-4 p-10 relative${mounted ? ' fade-slide-down' : ''}`}
          style={{
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(0, 255, 65, 0.25)',
            boxShadow:
              '0 0 0 1px rgba(0,255,65,0.05), 0 0 40px rgba(0,255,65,0.1), 0 0 80px rgba(0,255,65,0.05), inset 0 0 40px rgba(0,255,65,0.03)',
            opacity: mounted ? undefined : 0,
          }}
        >
          {/* Corner decorations */}
          <span className="absolute top-3 left-3 text-[#00ff41]/25 text-[10px]">┌──</span>
          <span className="absolute top-3 right-3 text-[#00ff41]/25 text-[10px]">──┐</span>
          <span className="absolute bottom-3 left-3 text-[#00ff41]/25 text-[10px]">└──</span>
          <span className="absolute bottom-3 right-3 text-[#00ff41]/25 text-[10px]">──┘</span>

          {/* SKULL LOGO */}
          <div className="skull-container mx-auto w-20 h-20 relative flex items-center justify-center">
            {/* Outer glow ring */}
            <div
              className="ring-pulse absolute inset-0 rounded-full"
              style={{
                border: '2px solid #00ff41',
                boxShadow:
                  '0 0 15px rgba(0,255,65,0.7), 0 0 30px rgba(0,255,65,0.4), 0 0 60px rgba(0,255,65,0.2)',
              }}
            />
            {/* Skull SVG */}
            <svg
              viewBox="0 0 100 120"
              fill="#00ff41"
              xmlns="http://www.w3.org/2000/svg"
              className="skull-float w-11 h-11"
            >
              <path d="M50 8 C28 8 12 24 12 46 C12 58 17 68 26 75 L26 95 C26 98 29 100 32 100 L44 100 L44 88 L56 88 L56 100 L68 100 C71 100 74 98 74 95 L74 75 C83 68 88 58 88 46 C88 24 72 8 50 8 Z M37 60 C32 60 28 56 28 51 C28 46 32 42 37 42 C42 42 46 46 46 51 C46 56 42 60 37 60 Z M63 60 C58 60 54 56 54 51 C54 46 58 42 63 42 C68 42 72 46 72 51 C72 56 68 60 63 60 Z M42 72 L42 78 L36 78 L36 72 Z M52 72 L52 78 L48 72 Z M64 72 L64 78 L58 78 L58 72 Z" />
            </svg>
          </div>

          {/* TITLE */}
          <div className="mt-4 text-center">
            <p className="text-[#00ff41] font-bold tracking-[0.3em] text-sm">BREACH TERMINAL</p>
            <p className="text-[#00ff41]/35 text-[9px] tracking-widest mt-1">[ SECURE ACCESS REQUIRED ]</p>
          </div>

          {/* DIVIDER */}
          <div className="mt-7 mb-6 border-t border-[#00ff41]/10 relative">
            <span className="absolute -top-[9px] left-1/2 -translate-x-1/2 bg-transparent px-3 text-[#00ff41]/30 text-[9px]">
              ◈ AUTHENTICATE ◈
            </span>
          </div>

          {/* GITHUB BUTTON */}
          <button
            className="w-full py-3 px-5 font-mono text-[11px] flex items-center justify-between transition-all duration-300 text-[#00ff41]/75 hover:text-[#00ff41]"
            style={{
              background: 'rgba(0,255,65,0.0)',
              border: '1px solid rgba(0,255,65,0.25)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.background = 'rgba(0,255,65,0.06)'
              el.style.border = '1px solid rgba(0,255,65,0.6)'
              el.style.boxShadow = '0 0 20px rgba(0,255,65,0.15)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.background = 'rgba(0,255,65,0.0)'
              el.style.border = '1px solid rgba(0,255,65,0.25)'
              el.style.boxShadow = 'none'
            }}
          >
            <span className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              → GITHUB İLE GİRİŞ YAP
            </span>
            <span className="text-[#00ff41]/40">›</span>
          </button>

          {/* GOOGLE BUTTON */}
          <button
            className="mt-3 w-full py-3 px-5 font-mono text-[11px] flex items-center justify-between transition-all duration-300 text-slate-400 hover:text-slate-200"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.background = 'rgba(255,255,255,0.03)'
              el.style.border = '1px solid rgba(255,255,255,0.2)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.background = 'transparent'
              el.style.border = '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <span className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              → GOOGLE İLE GİRİŞ YAP
            </span>
            <span className="opacity-40">›</span>
          </button>

          {/* BOTTOM STATUS */}
          <div className="mt-8 text-center space-y-1.5">
            <p className="text-[#00ff41]/20 text-[9px]">[ CONNECTION: ENCRYPTED ]</p>
            <p className="text-[#00ff41]/20 text-[9px]">[ PROTOCOL: TLS 1.3 ]</p>
            <p className="status-blink text-[#00ff41]/30 text-[9px]">[ STATUS: AWAITING AUTHENTICATION ]</p>
          </div>
        </div>
      </div>

      {/* BACK LINK */}
      <div className="absolute bottom-6 w-full text-center z-30">
        <Link
          href="/"
          className="text-[#00ff41]/25 hover:text-[#00ff41]/60 text-[10px] font-mono transition-colors duration-300"
        >
          ← ana sayfaya dön
        </Link>
      </div>
    </div>
  )
}
