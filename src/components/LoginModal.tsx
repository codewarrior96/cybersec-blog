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
          0%,100% { transform: translateY(0) scale(1);       filter: drop-shadow(0 0 6px rgba(0,255,65,0.8)); }
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
        .lm-ring  { animation: ringPulse   2.5s ease-in-out infinite; }
        .lm-blink { animation: statusBlink 1.5s ease-in-out infinite; }
        .lm-slide { animation: fadeSlideDown 0.9s cubic-bezier(0.16,1,0.3,1) forwards; }
        .lm-shake { animation: shake 0.4s ease-in-out; }

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
          border: 1px solid rgba(0,255,65,0.35);
          background: rgba(0,0,0,0.7);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .lm-field:focus-within {
          border-color: rgba(0,255,65,0.6);
          box-shadow: 0 0 15px rgba(0,255,65,0.1);
        }
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
        style={{ position: 'absolute', bottom: '38%', left: '50%', transform: 'translateX(-50%)', zIndex: 6, display: 'flex', gap: '4.5rem', pointerEvents: 'none' }}
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              width: '3.5rem',
              height: '1.25rem',
              borderRadius: '50%',
              backgroundColor: '#00ff41',
              opacity: 0.9,
              boxShadow: '0 0 15px #00ff41, 0 0 40px #00ff41, 0 0 80px rgba(0,255,65,0.7), 0 0 120px rgba(0,255,65,0.4)',
              animation: 'eyePulse 2s ease-in-out infinite',
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

      {/* ── TOP: SKULL + TITLE ── */}
      <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', zIndex: 10, textAlign: 'center', width: '100%' }}>
        <div style={{ margin: '0 auto', position: 'relative', width: '7rem', height: '7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          <img
            src="/skull.jpg"
            alt="skull"
            style={{ width: '4.5rem', height: '4.5rem', borderRadius: '9999px', objectFit: 'cover', animation: 'skullFloat 3s ease-in-out infinite' }}
          />
        </div>
        <p style={{ color: '#00ff41', fontWeight: 700, letterSpacing: '0.3em', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.75rem', fontFamily: 'monospace' }}>
          BREACH TERMINAL
        </p>
        <p style={{ color: 'rgba(0,255,65,0.35)', fontSize: '9px', letterSpacing: '0.15em', textAlign: 'center', marginTop: '0.25rem', fontFamily: 'monospace' }}>
          [ SECURE ACCESS REQUIRED ]
        </p>
      </div>

      {/* ── BOTTOM: LOGIN FORM ── */}
      <div style={{ position: 'absolute', bottom: '5%', left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: '100%', maxWidth: '380px', padding: '0 1rem' }}>

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(0,255,65,0.1)', marginBottom: '1.25rem', position: 'relative' }}>
          <span style={{
            position: 'absolute',
            top: '-9px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'transparent',
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
                background: 'rgba(0,0,0,0.7)',
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
                background: 'rgba(0,0,0,0.7)',
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

        {/* ── ERROR ── */}
        {error && (
          <div className="lm-shake" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            <p style={{ color: '#ef4444', fontSize: '9px', fontFamily: 'monospace' }}>
              [ ACCESS DENIED — INVALID CREDENTIALS ]
            </p>
          </div>
        )}

        {/* ── REMEMBER ME + LOGIN BUTTON ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1rem', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          <button
            onClick={handleLogin}
            style={{ padding: '0.4rem 2rem', fontFamily: 'monospace', fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.2s', background: 'rgba(0,255,65,0.08)', border: '1px solid rgba(0,255,65,0.5)', color: '#00ff41' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,255,65,0.18)'; e.currentTarget.style.borderColor = 'rgba(0,255,65,0.8)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,255,65,0.08)'; e.currentTarget.style.borderColor = 'rgba(0,255,65,0.5)' }}
          >
            [ ACCESS ]
          </button>
        </div>

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
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        {/* ── REGISTER LINK ── */}
        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
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
        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <p style={{ color: 'rgba(0,255,65,0.15)', fontSize: '9px', fontFamily: 'monospace', marginBottom: '0.25rem' }}>
            [ CONNECTION: ENCRYPTED — TLS 1.3 ]
          </p>
          <p className="lm-blink" style={{ color: 'rgba(0,255,65,0.25)', fontSize: '9px', fontFamily: 'monospace' }}>
            [ STATUS: AWAITING AUTHENTICATION ]
          </p>
        </div>

        {/* Version + Hex */}
        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', color: 'rgba(0,255,65,0.15)' }}>v2.0.26</span>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', color: 'rgba(0,255,65,0.15)' }}>{hexVal}</span>
        </div>
      </div>
    </div>
  )
}
