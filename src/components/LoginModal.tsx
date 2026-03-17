"use client"

import { useEffect, useState } from 'react'
import MatrixRain from '@/components/MatrixRain'

const DEMO_USER = 'ghost'
const DEMO_PASS = 'demo_pass'

interface LoginModalProps {
  onClose: () => void
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const [visible, setVisible] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [hexVal, setHexVal] = useState('0000')

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setHexVal(Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase())
    }, 200)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleLogin = () => {
    if (username === DEMO_USER && password === DEMO_PASS) {
      localStorage.setItem('auth_user', 'ghost')
      onClose()
    } else {
      setError(true)
      setShakeKey(k => k + 1)
      setTimeout(() => setError(false), 3000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity:0; transform:translateY(-30px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes eyePulse {
          0%,100% { opacity:0.5; box-shadow:0 0 8px #00ff41,0 0 25px rgba(0,255,65,0.5); }
          50% { opacity:1; box-shadow:0 0 15px #00ff41,0 0 50px #00ff41,0 0 100px rgba(0,255,65,0.4); }
        }
        @keyframes ringPulse {
          0%,100% { box-shadow:0 0 15px rgba(0,255,65,0.5),0 0 30px rgba(0,255,65,0.2); }
          50% { box-shadow:0 0 30px rgba(0,255,65,0.9),0 0 60px rgba(0,255,65,0.4); }
        }
        @keyframes skullFloat {
          0%,100% { transform:translateY(0) scale(1); filter:drop-shadow(0 0 6px rgba(0,255,65,0.8)); }
          50% { transform:translateY(-4px) scale(1.05); filter:drop-shadow(0 0 16px #00ff41); }
        }
        @keyframes statusBlink {
          0%,100% { opacity:0.25; }
          50% { opacity:0.6; }
        }
        @keyframes shake {
          0%,100% { transform:translateX(0); }
          20% { transform:translateX(-8px); }
          40% { transform:translateX(8px); }
          60% { transform:translateX(-5px); }
          80% { transform:translateX(5px); }
        }
        .eye-pulse { animation:eyePulse 2s ease-in-out infinite; }
        .ring-pulse { animation:ringPulse 2.5s ease-in-out infinite; }
        .skull-float { animation:skullFloat 3s ease-in-out infinite; }
        .status-blink { animation:statusBlink 1.5s ease-in-out infinite; }
        .fade-slide-down { animation:fadeSlideDown 0.9s cubic-bezier(0.16,1,0.3,1) forwards; }
        .shake { animation:shake 0.4s ease-in-out; }
        .custom-checkbox {
          -webkit-appearance: none;
          appearance: none;
          width: 1rem;
          height: 1rem;
          border: 1px solid rgba(0,255,65,0.3);
          background: transparent;
          cursor: pointer;
          position: relative;
          flex-shrink: 0;
        }
        .custom-checkbox:checked {
          background: rgba(0,255,65,0.1);
          border-color: rgba(0,255,65,0.7);
        }
        .custom-checkbox:checked::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #00ff41;
          font-size: 10px;
          line-height: 1;
        }
      `}</style>

      {/* LAYER 1 — HACKER IMAGE */}
      <img
        src="/login-hacker.jpg"
        alt=""
        className="absolute bottom-0 left-0 w-full h-full object-cover object-center"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 1.4s cubic-bezier(0.16,1,0.3,1)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.75) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,255,65,0.04)', mixBlendMode: 'screen' }}
      />

      {/* LAYER 2 — MATRIX RAIN */}
      <div className="absolute inset-0 z-10 opacity-20 pointer-events-none">
        <MatrixRain />
      </div>

      {/* LAYER 3 — SCANLINES */}
      <div
        className="fixed inset-0 pointer-events-none z-20"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.35) 3px, rgba(0,0,0,0.35) 4px)',
        }}
      />

      {/* LAYER 4 — EYE GLOW */}
      <div
        className="absolute z-20 pointer-events-none flex gap-12"
        style={{ bottom: '26%', left: '50%', transform: 'translateX(-50%)' }}
      >
        <div
          className="eye-pulse w-8 h-2.5 rounded-full bg-[#00ff41]"
          style={{
            boxShadow:
              '0 0 10px #00ff41, 0 0 30px #00ff41, 0 0 60px rgba(0,255,65,0.6), 0 0 120px rgba(0,255,65,0.3)',
          }}
        />
        <div
          className="eye-pulse w-8 h-2.5 rounded-full bg-[#00ff41]"
          style={{
            boxShadow:
              '0 0 10px #00ff41, 0 0 30px #00ff41, 0 0 60px rgba(0,255,65,0.6), 0 0 120px rgba(0,255,65,0.3)',
          }}
        />
      </div>

      {/* ESC BUTTON */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-50 font-mono text-[10px] text-[#00ff41]/30 hover:text-[#00ff41]/70 border border-[#00ff41]/15 hover:border-[#00ff41]/40 px-2.5 py-1 transition-all"
      >
        [ ESC ]
      </button>

      {/* LAYER 5 — LOGIN CARD */}
      <div className="absolute inset-0 z-30 flex items-center justify-center">
        <div
          key={shakeKey}
          className={`fade-slide-down w-full max-w-[400px] mx-4 p-8 relative${error ? ' shake' : ''}`}
          style={{
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(0,255,65,0.25)',
            boxShadow: '0 0 80px rgba(0,255,65,0.12), inset 0 0 40px rgba(0,255,65,0.03)',
          }}
        >
          {/* Corner brackets */}
          <span className="absolute top-2.5 left-3 font-mono text-[10px] text-[#00ff41]/20">┌──</span>
          <span className="absolute top-2.5 right-3 font-mono text-[10px] text-[#00ff41]/20">──┐</span>
          <span className="absolute bottom-2.5 left-3 font-mono text-[10px] text-[#00ff41]/20">└──</span>
          <span className="absolute bottom-2.5 right-3 font-mono text-[10px] text-[#00ff41]/20">──┘</span>

          {/* Hex counter */}
          <span className="absolute bottom-3 right-8 text-[#00ff41]/15 text-[8px] font-mono">
            {hexVal}
          </span>

          {/* Version */}
          <span className="absolute bottom-3 left-3 text-[#00ff41]/15 text-[8px] font-mono">
            v2.0.26
          </span>

          {/* SKULL LOGO */}
          <div className="mx-auto relative w-20 h-20 flex items-center justify-center">
            <div
              className="ring-pulse absolute inset-0 rounded-full border-2 border-[#00ff41]"
              style={{
                boxShadow: '0 0 20px rgba(0,255,65,0.7), 0 0 40px rgba(0,255,65,0.3)',
              }}
            />
            <svg
              viewBox="0 0 100 120"
              fill="#00ff41"
              xmlns="http://www.w3.org/2000/svg"
              className="skull-float w-11 h-11"
            >
              <path d="M50 8 C28 8 12 24 12 46 C12 58 17 68 26 75 L26 95 C26 98 29 100 32 100 L44 100 L44 88 L56 88 L56 100 L68 100 C71 100 74 98 74 95 L74 75 C83 68 88 58 88 46 C88 24 72 8 50 8 Z M37 60 C32 60 28 56 28 51 C28 46 32 42 37 42 C42 42 46 46 46 51 C46 56 42 60 37 60 Z M63 60 C58 60 54 56 54 51 C54 46 58 42 63 42 C68 42 72 46 72 51 C72 56 68 60 63 60 Z M42 72 L42 78 L36 78 L36 72 Z M52 72 L52 78 L48 72 Z M64 72 L64 78 L58 78 L58 72 Z" />
            </svg>
          </div>

          {/* Title */}
          <p className="text-[#00ff41] font-bold tracking-[0.3em] text-xs text-center mt-3">
            BREACH TERMINAL
          </p>
          <p className="text-[#00ff41]/35 text-[9px] tracking-widest text-center mt-1">
            [ SECURE ACCESS REQUIRED ]
          </p>

          {/* Divider */}
          <div className="border-t border-[#00ff41]/10 my-5 relative">
            <span className="absolute -top-[9px] left-1/2 -translate-x-1/2 bg-black px-3 text-[#00ff41]/30 text-[9px] font-mono">
              ◈ AUTHENTICATE ◈
            </span>
          </div>

          {/* USERNAME */}
          <div>
            <p className="text-[#00ff41]/40 text-[9px] font-mono mb-1">USER_ID:</p>
            <div
              className="relative border border-[#00ff41]/20 focus-within:border-[#00ff41]/60 transition-all"
              style={{ boxShadow: 'none' }}
              onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 15px rgba(0,255,65,0.1)')}
              onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
            >
              <span className="text-[#00ff41]/50 absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs">
                ›
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="enter username..."
                className="w-full bg-transparent pl-7 pr-4 py-2.5 font-mono text-xs text-[#00ff41] placeholder-[#00ff41]/20 outline-none"
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div className="mt-3">
            <p className="text-[#00ff41]/40 text-[9px] font-mono mb-1">PASS_KEY:</p>
            <div className="relative border border-[#00ff41]/20 focus-within:border-[#00ff41]/60 transition-all">
              <span className="text-[#00ff41]/50 absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs">
                ›
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="enter password..."
                className="w-full bg-transparent pl-7 pr-10 py-2.5 font-mono text-xs text-[#00ff41] placeholder-[#00ff41]/20 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00ff41]/30 hover:text-[#00ff41]/70 transition-colors"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                    <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                    <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* REMEMBER ME */}
          <div className="mt-3 flex items-center gap-2">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="custom-checkbox"
            />
            <label
              htmlFor="remember"
              className="text-[#00ff41]/40 text-[9px] font-mono cursor-pointer"
            >
              OTURUMU AÇIK TUT
            </label>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="mt-3 text-center shake">
              <p className="text-red-500 text-[9px] font-mono">
                [ ACCESS DENIED — INVALID CREDENTIALS ]
              </p>
            </div>
          )}

          {/* LOGIN BUTTON */}
          <button
            onClick={handleLogin}
            className="mt-4 w-full py-3 font-mono text-xs font-bold tracking-widest bg-[#00ff41]/10 border border-[#00ff41]/40 text-[#00ff41] hover:bg-[#00ff41]/20 hover:border-[#00ff41]/80 active:scale-95 transition-all duration-200"
            style={{ boxShadow: 'none' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.boxShadow = '0 0 25px rgba(0,255,65,0.25)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
          >
            [ INITIATE ACCESS ]
          </button>

          {/* FORGOT PASSWORD */}
          <div className="mt-2 text-center">
            <button
              onClick={() => alert('Demo hesap — şifre: demo_pass')}
              className="text-[#00ff41]/25 hover:text-[#00ff41]/50 text-[9px] font-mono cursor-pointer transition-colors"
            >
              şifreyi unuttum?
            </button>
          </div>

          {/* DIVIDER 2 */}
          <div className="mt-5 border-t border-white/5" />

          {/* REGISTER LINK */}
          <div className="mt-4 text-center">
            <span className="text-slate-600 text-[9px] font-mono">Hesabın yok mu?</span>
            <button
              onClick={() => alert('Kayıt sistemi yakında aktif olacak.')}
              className="text-[#00ff41]/40 hover:text-[#00ff41]/70 font-mono text-[9px] cursor-pointer transition-colors ml-1"
            >
              [ KAYIT OL ]
            </button>
          </div>

          {/* BOTTOM STATUS */}
          <div className="mt-5 text-center space-y-1">
            <p className="text-[#00ff41]/15 text-[9px] font-mono">
              [ CONNECTION: ENCRYPTED — TLS 1.3 ]
            </p>
            <p className="status-blink text-[#00ff41]/25 text-[9px] font-mono">
              [ STATUS: AWAITING AUTHENTICATION ]
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
