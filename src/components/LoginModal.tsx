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
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState(false)
  const [remember, setRemember] = useState(false)
  const [hexVal, setHexVal] = useState('0000')

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', handleKey) }
  }, [onClose])

  useEffect(() => {
    const interval = setInterval(() => {
      setHexVal(Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase())
    }, 200)
    return () => clearInterval(interval)
  }, [])

  const handleLogin = () => {
    if (username === DEMO_USER && password === DEMO_PASS) {
      localStorage.setItem('auth_user', username)
      onClose()
    } else {
      setError(true)
      setTimeout(() => setError(false), 3000)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden', backgroundColor: 'black' }}>
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes eyePulse {
          0%,100% { opacity: 0.5; box-shadow: 0 0 8px #00ff41, 0 0 25px rgba(0,255,65,0.5); }
          50%     { opacity: 1;   box-shadow: 0 0 15px #00ff41, 0 0 50px #00ff41, 0 0 100px rgba(0,255,65,0.4); }
        }
        @keyframes ringPulse {
          0%,100% { box-shadow: 0 0 15px rgba(0,255,65,0.5), 0 0 30px rgba(0,255,65,0.2); }
          50%     { box-shadow: 0 0 30px rgba(0,255,65,0.9), 0 0 60px rgba(0,255,65,0.4); }
        }
        @keyframes skullFloat {
          0%,100% { transform: translateY(0) scale(1);    filter: drop-shadow(0 0 6px rgba(0,255,65,0.8)); }
          50%     { transform: translateY(-4px) scale(1.05); filter: drop-shadow(0 0 16px #00ff41); }
        }
        @keyframes statusBlink {
          0%,100% { opacity: 0.25; }
          50%     { opacity: 0.6; }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-8px); }
          40%     { transform: translateX(8px); }
          60%     { transform: translateX(-5px); }
          80%     { transform: translateX(5px); }
        }
        .lm-eye       { animation: eyePulse    2s   ease-in-out infinite; }
        .lm-ring      { animation: ringPulse   2.5s ease-in-out infinite; }
        .lm-skull     { animation: skullFloat  3s   ease-in-out infinite; }
        .lm-blink     { animation: statusBlink 1.5s ease-in-out infinite; }
        .lm-slide     { animation: fadeSlideDown 0.9s cubic-bezier(0.16,1,0.3,1) forwards; }
        .lm-shake     { animation: shake 0.4s ease-in-out; }

        .lm-input::placeholder { color: rgba(0,255,65,0.2); }
        .lm-input:focus        { outline: none; }

        .lm-checkbox {
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
        .lm-checkbox:checked {
          background: rgba(0,255,65,0.1);
          border-color: rgba(0,255,65,0.7);
        }
        .lm-checkbox:checked::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #00ff41;
          font-size: 10px;
          line-height: 1;
        }

        .lm-field {
          position: relative;
          border: 1px solid rgba(0,255,65,0.2);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .lm-field:focus-within {
          border-color: rgba(0,255,65,0.6);
          box-shadow: 0 0 15px rgba(0,255,65,0.1);
        }

        .lm-btn-login {
          width: 100%;
          padding: 0.75rem;
          font-family: monospace;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          background: rgba(0,255,65,0.1);
          border: 1px solid rgba(0,255,65,0.4);
          color: #00ff41;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.1s;
        }
        .lm-btn-login:hover {
          background: rgba(0,255,65,0.2);
          border-color: rgba(0,255,65,0.8);
          box-shadow: 0 0 25px rgba(0,255,65,0.25);
        }
        .lm-btn-login:active { transform: scale(0.97); }
      `}</style>

      {/* ── LAYER 1: HACKER IMAGE ── */}
      <img
        src="/hacker.jpg"
        alt=""
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        style={{
          position: 'absolute',
          bottom: '0',
          left: '50%',
          transform: visible
            ? 'translateX(-50%) translateY(0)'
            : 'translateX(-50%) translateY(100%)',
          transition: 'transform 1.4s cubic-bezier(0.16,1,0.3,1)',
          width: '100%',
          maxWidth: '700px',
          height: '90vh',
          objectFit: 'cover',
          objectPosition: 'top center',
          zIndex: 1,
        }}
      />

      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          background:
            'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.8) 100%), ' +
            'linear-gradient(to right, rgba(0,0,0,0.6) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* ── LAYER 2: MATRIX RAIN ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, opacity: 0.15, pointerEvents: 'none' }}>
        <MatrixRain />
      </div>

      {/* ── LAYER 3: SCANLINES ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 4,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px)',
        }}
      />

      {/* ── LAYER 4: EYE GLOW ── */}
      <div
        style={{
          position: 'absolute',
          bottom: '44%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5,
          display: 'flex',
          gap: '3.5rem',
          pointerEvents: 'none',
        }}
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            className="lm-eye"
            style={{
              width: '2rem',
              height: '0.625rem',
              borderRadius: '9999px',
              backgroundColor: '#00ff41',
              boxShadow: '0 0 10px #00ff41, 0 0 30px #00ff41, 0 0 60px rgba(0,255,65,0.6)',
            }}
          />
        ))}
      </div>

      {/* ── ESC BUTTON ── */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1.25rem',
          right: '1.25rem',
          zIndex: 50,
          fontFamily: 'monospace',
          fontSize: '10px',
          color: 'rgba(0,255,65,0.3)',
          border: '1px solid rgba(0,255,65,0.15)',
          padding: '0.25rem 0.625rem',
          background: 'transparent',
          cursor: 'pointer',
          transition: 'color 0.2s, border-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'rgba(0,255,65,0.7)'
          e.currentTarget.style.borderColor = 'rgba(0,255,65,0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(0,255,65,0.3)'
          e.currentTarget.style.borderColor = 'rgba(0,255,65,0.15)'
        }}
      >
        [ ESC ]
      </button>

      {/* ── LAYER 5: LOGIN CARD ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className={`lm-slide${error ? ' lm-shake' : ''}`}
          style={{
            width: '100%',
            maxWidth: '420px',
            margin: '0 1rem',
            padding: '2.5rem',
            position: 'relative',
            background: 'rgba(0, 0, 0, 0)',
            backdropFilter: 'blur(0px)',
            WebkitBackdropFilter: 'blur(0px)',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            boxShadow:
              '0 0 100px rgba(0,255,65,0.15), 0 0 40px rgba(0,255,65,0.08), inset 0 0 60px rgba(0,255,65,0.04)',
          }}
        >
          {/* Corner brackets */}
          {(['top-2.5 left-3', 'top-2.5 right-3', 'bottom-2.5 left-3', 'bottom-2.5 right-3'] as const).map((pos, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                ...(pos.includes('top') ? { top: '0.625rem' } : { bottom: '0.625rem' }),
                ...(pos.includes('left') ? { left: '0.75rem' } : { right: '0.75rem' }),
                fontFamily: 'monospace',
                fontSize: '10px',
                color: 'rgba(0,255,65,0.2)',
              }}
            >
              {i === 0 ? '┌──' : i === 1 ? '──┐' : i === 2 ? '└──' : '──┘'}
            </span>
          ))}

          {/* Version */}
          <span style={{ position: 'absolute', bottom: '0.75rem', left: '0.75rem', fontFamily: 'monospace', fontSize: '8px', color: 'rgba(0,255,65,0.15)' }}>
            v2.0.26
          </span>

          {/* Hex counter */}
          <span style={{ position: 'absolute', bottom: '0.75rem', right: '2rem', fontFamily: 'monospace', fontSize: '8px', color: 'rgba(0,255,65,0.15)' }}>
            {hexVal}
          </span>

          {/* ── SKULL LOGO ── */}
          <div style={{ margin: '0 auto', position: 'relative', width: '5rem', height: '5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              className="lm-ring"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '9999px',
                border: '2px solid #00ff41',
                boxShadow: '0 0 20px rgba(0,255,65,0.7), 0 0 40px rgba(0,255,65,0.3)',
              }}
            />
            <svg
              viewBox="0 0 100 120"
              fill="#00ff41"
              xmlns="http://www.w3.org/2000/svg"
              className="lm-skull"
              style={{ width: '2.75rem', height: '2.75rem' }}
            >
              <path d="M50 8 C28 8 12 24 12 46 C12 58 17 68 26 75 L26 95 C26 98 29 100 32 100 L44 100 L44 88 L56 88 L56 100 L68 100 C71 100 74 98 74 95 L74 75 C83 68 88 58 88 46 C88 24 72 8 50 8 Z M37 60 C32 60 28 56 28 51 C28 46 32 42 37 42 C42 42 46 46 46 51 C46 56 42 60 37 60 Z M63 60 C58 60 54 56 54 51 C54 46 58 42 63 42 C68 42 72 46 72 51 C72 56 68 60 63 60 Z M42 72 L42 78 L36 78 L36 72 Z M52 72 L52 78 L48 72 Z M64 72 L64 78 L58 78 L58 72 Z" />
            </svg>
          </div>

          {/* Title */}
          <p style={{ color: '#00ff41', fontWeight: 700, letterSpacing: '0.3em', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.75rem', fontFamily: 'monospace' }}>
            BREACH TERMINAL
          </p>
          <p style={{ color: 'rgba(0,255,65,0.35)', fontSize: '9px', letterSpacing: '0.15em', textAlign: 'center', marginTop: '0.25rem', fontFamily: 'monospace' }}>
            [ SECURE ACCESS REQUIRED ]
          </p>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(0,255,65,0.1)', margin: '1.25rem 0', position: 'relative' }}>
            <span style={{
              position: 'absolute',
              top: '-9px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.65)',
              padding: '0 0.75rem',
              color: 'rgba(0,255,65,0.3)',
              fontSize: '9px',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}>
              ◈ AUTHENTICATE ◈
            </span>
          </div>

          {/* ── USERNAME ── */}
          <div>
            <p style={{ color: 'rgba(0,255,65,0.4)', fontSize: '9px', fontFamily: 'monospace', marginBottom: '0.25rem' }}>USER_ID:</p>
            <div className="lm-field">
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,255,65,0.5)', fontFamily: 'monospace', fontSize: '0.75rem' }}>›</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="enter username..."
                className="lm-input"
                style={{
                  width: '100%',
                  background: 'transparent',
                  paddingLeft: '1.75rem',
                  paddingRight: '1rem',
                  paddingTop: '0.625rem',
                  paddingBottom: '0.625rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#00ff41',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* ── PASSWORD ── */}
          <div style={{ marginTop: '0.75rem' }}>
            <p style={{ color: 'rgba(0,255,65,0.4)', fontSize: '9px', fontFamily: 'monospace', marginBottom: '0.25rem' }}>PASS_KEY:</p>
            <div className="lm-field">
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,255,65,0.5)', fontFamily: 'monospace', fontSize: '0.75rem' }}>›</span>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="enter password..."
                className="lm-input"
                style={{
                  width: '100%',
                  background: 'transparent',
                  paddingLeft: '1.75rem',
                  paddingRight: '2.5rem',
                  paddingTop: '0.625rem',
                  paddingBottom: '0.625rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#00ff41',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(0,255,65,0.35)',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPass ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '0.875rem', height: '0.875rem' }}>
                    <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '0.875rem', height: '0.875rem' }}>
                    <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* ── REMEMBER ME ── */}
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="lm-remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="lm-checkbox"
            />
            <label htmlFor="lm-remember" style={{ color: 'rgba(0,255,65,0.4)', fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer' }}>
              OTURUMU AÇIK TUT
            </label>
          </div>

          {/* ── ERROR ── */}
          {error && (
            <div className="lm-shake" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
              <p style={{ color: '#ef4444', fontSize: '9px', fontFamily: 'monospace' }}>
                [ ACCESS DENIED — INVALID CREDENTIALS ]
              </p>
            </div>
          )}

          {/* ── LOGIN BUTTON ── */}
          <button
            onClick={handleLogin}
            className="lm-btn-login"
            style={{ marginTop: '1rem' }}
          >
            [ INITIATE ACCESS ]
          </button>

          {/* ── FORGOT PASSWORD ── */}
          <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            <button
              onClick={() => alert('Demo hesap — şifre: demo_pass')}
              style={{ background: 'transparent', border: 'none', color: 'rgba(0,255,65,0.25)', fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(0,255,65,0.55)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(0,255,65,0.25)')}
            >
              şifreyi unuttum?
            </button>
          </div>

          {/* ── DIVIDER 2 ── */}
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

          {/* ── REGISTER LINK ── */}
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <span style={{ color: 'rgba(100,116,139,0.6)', fontSize: '9px', fontFamily: 'monospace' }}>Hesabın yok mu?</span>
            <button
              onClick={() => alert('Kayıt sistemi yakında aktif olacak.')}
              style={{ background: 'transparent', border: 'none', marginLeft: '0.25rem', color: 'rgba(0,255,65,0.4)', fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(0,255,65,0.7)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(0,255,65,0.4)')}
            >
              [ KAYIT OL ]
            </button>
          </div>

          {/* ── BOTTOM STATUS ── */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <p style={{ color: 'rgba(0,255,65,0.15)', fontSize: '9px', fontFamily: 'monospace', marginBottom: '0.25rem' }}>
              [ CONNECTION: ENCRYPTED — TLS 1.3 ]
            </p>
            <p className="lm-blink" style={{ color: 'rgba(0,255,65,0.25)', fontSize: '9px', fontFamily: 'monospace' }}>
              [ STATUS: AWAITING AUTHENTICATION ]
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
