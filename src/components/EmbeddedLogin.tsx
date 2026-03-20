'use client'

import { useEffect, useState } from 'react'
import MatrixRain from '@/components/MatrixRain'
import { getAuthSession, loginWithPassword } from '@/lib/auth-client'

interface EmbeddedLoginProps {
  redirectTo?: string
}

export default function EmbeddedLogin({ redirectTo = '/' }: EmbeddedLoginProps) {
  const [visible, setVisible] = useState(false)
  const [username, setUsername] = useState('ghost')
  const [password, setPassword] = useState('demo_pass')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hexVal, setHexVal] = useState('0000')
  const [hint, setHint] = useState('')
  const [quoteText, setQuoteText] = useState('')

  const fullQuote = '"The quieter you become, the more you are able to hear."'
  const [glitchActive, setGlitchActive] = useState(false)

  useEffect(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*'
    let iteration = 0
    let interval: ReturnType<typeof setInterval>
    
    const delay = setTimeout(() => {
      interval = setInterval(() => {
        setQuoteText(fullQuote.split('').map((char, index) => {
          if (index < Math.floor(iteration)) return char
          if (char === ' ') return ' '
          return chars[Math.floor(Math.random() * chars.length)]
        }).join(''))

        if (iteration >= fullQuote.length) {
          clearInterval(interval)
          setTimeout(() => setGlitchActive(true), 1500)
        }
        
        iteration += 1 / 3
      }, 35)
    }, 1200)
    
    return () => {
      clearTimeout(delay)
      if (interval) clearInterval(interval)
    }
  }, [])


  useEffect(() => {
    let alive = true
    const check = async () => {
      const session = await getAuthSession(false)
      if (alive && session.authenticated) {
        window.location.href = redirectTo
      }
    }
    void check()
    return () => {
      alive = false
    }
  }, [redirectTo])

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 120)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setHexVal(Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase())
    }, 220)
    return () => clearInterval(interval)
  }, [])

  const handleLogin = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await loginWithPassword(username.trim(), password)
      if (!result.ok) {
        setError(result.error ?? 'ACCESS DENIED - INVALID CREDENTIALS')
        return
      }
      window.location.href = redirectTo
    } finally {
      setLoading(false)
    }
  }


  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', backgroundColor: '#000' }}>
      <style>{`
        @keyframes eyePulse {
          0%,100% { opacity: 0.55; box-shadow: 0 0 8px #00ff41, 0 0 24px rgba(0,255,65,0.5); }
          50%     { opacity: 1; box-shadow: 0 0 16px #00ff41, 0 0 44px #00ff41, 0 0 90px rgba(0,255,65,0.3); }
        }
        @keyframes ringPulse {
          0%,100% { box-shadow: 0 0 15px rgba(0,255,65,0.5), 0 0 30px rgba(0,255,65,0.2); }
          50%     { box-shadow: 0 0 30px rgba(0,255,65,0.8), 0 0 60px rgba(0,255,65,0.35); }
        }
        @keyframes skullFloat {
          0%,100% { transform: translateY(0) scale(1); }
          50%     { transform: translateY(-4px) scale(1.05); }
        }
        @keyframes statusBlink {
          0%,100% { opacity: 0.3; }
          50%     { opacity: 0.8; }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-6px); }
          40%     { transform: translateX(6px); }
          60%     { transform: translateX(-4px); }
          80%     { transform: translateX(4px); }
        }

        .el-ring { animation: ringPulse 2.5s ease-in-out infinite; }
        .el-blink { animation: statusBlink 1.5s ease-in-out infinite; }
        .el-shake { animation: shake 0.4s ease-in-out; }

        .el-input::placeholder { color: rgba(0,255,65,0.2); }
        .el-input:focus { outline: none; }

        .el-checkbox {
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
        .el-checkbox:checked {
          background: rgba(0,255,65,0.1);
          border-color: rgba(0,255,65,0.7);
        }
        .el-checkbox:checked::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #00ff41;
          font-size: 10px;
          line-height: 1;
        }
        .el-field {
          position: relative;
          border: 1px solid rgba(0,255,65,0.35);
          background: rgba(0,0,0,0.7);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .el-field:focus-within {
          border-color: rgba(0,255,65,0.6);
          box-shadow: 0 0 15px rgba(0,255,65,0.1);
        }
        @keyframes gridMove {
          0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
          100% { transform: perspective(500px) rotateX(60deg) translateY(50px); }
        }
        @keyframes slowGlow {
          0%,100% { opacity: 0.15; box-shadow: 0 0 40px rgba(0,255,65,0.2); }
          50% { opacity: 0.4; box-shadow: 0 0 80px rgba(0,255,65,0.5); }
        }
        @media (max-width: 768px) {
          .login-form-panel {
            top: auto !important;
            bottom: 2% !important;
            right: auto !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 90% !important;
          }
          .quote-panel {
            top: 10% !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            text-align: center;
            width: 85% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* 1. Deep space/void backdrop */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(circle at 50% 40%, #001206 0%, #000000 70%)' }} />

      {/* 2. Cyberpunk Perspective Grid Base */}
      <div 
        style={{ 
          position: 'absolute', 
          bottom: '-10%', left: '-50%', right: '-50%', height: '80%',
          zIndex: 0,
          background: 'linear-gradient(transparent 65%, rgba(0,255,65,0.15) 67%, transparent 70%), linear-gradient(90deg, transparent 48%, rgba(0,255,65,0.08) 50%, transparent 52%)',
          backgroundSize: '100% 50px, 50px 100%',
          animation: 'gridMove 5s linear infinite',
          opacity: 0.5,
          pointerEvents: 'none'
        }} 
      />

      {/* 3. Original Hacker Image with cinematic entrance and blend */}
      <img
        src="/hacker.jpg"
        alt=""
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: visible ? 'translateX(-50%) translateY(0) scale(1.03)' : 'translateX(-50%) translateY(40%) scale(0.95)',
          transition: 'transform 1.8s cubic-bezier(0.16, 1, 0.3, 1), filter 1.8s',
          filter: visible ? 'contrast(1.15) brightness(0.8) drop-shadow(0 -10px 40px rgba(0,255,65,0.15))' : 'brightness(0)',
          width: '100%',
          maxWidth: 950,
          height: '100vh',
          objectFit: 'cover',
          objectPosition: 'top center',
          zIndex: 1,
          opacity: 0.65,
          mixBlendMode: 'lighten'
        }}
      />

      {/* 4. Deep vignette and shadow gradient to wrap the glowing elements */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 30%, transparent 20%, rgba(0,0,0,0.85) 65%, #000 100%), linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.95) 90%, #000 100%)',
        }}
      />

      {/* 5. Central glowing aurora radiating from behind the skull */}
      <div 
        style={{
          position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '45vw', height: '45vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,65,0.3) 0%, transparent 60%)',
          zIndex: 2, pointerEvents: 'none',
          animation: 'slowGlow 5s ease-in-out infinite',
          mixBlendMode: 'screen'
        }}
      />

      {/* 6. Enriched Matrix Rain */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, opacity: 0.35, pointerEvents: 'none', mixBlendMode: 'screen', filter: 'blur(0.5px)' }}>
        <MatrixRain />
      </div>

      {/* 7. Advanced CRT overlay with scanlines and monitor shadow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.03) 2px, rgba(0,0,0,0.1) 4px)',
          boxShadow: 'inset 0 0 120px rgba(0,0,0,0.95)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: '38%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 6,
          display: 'flex',
          gap: '4.4rem',
          pointerEvents: 'none',
        }}
      >
        {[0, 1].map((idx) => (
          <div
            key={idx}
            style={{
              width: '3.5rem',
              height: '1.15rem',
              background: 'radial-gradient(ellipse at center, #ffffff 0%, #00ff41 40%, rgba(0,255,65,0.3) 100%)',
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              boxShadow: '0 0 10px #00ff41, 0 0 25px #00ff41, 0 0 50px rgba(0,255,65,0.7)',
              animation: 'eyePulse 2s ease-in-out infinite',
              transform: 'skewX(-5deg)',
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            margin: '0 auto',
            position: 'relative',
            width: '9.7rem',
            height: '9.7rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="el-ring"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '9999px',
              border: '2px solid #00ff41',
            }}
          />
          <img
            src="/skull.jpg"
            alt="skull"
            style={{
              width: '6.5rem',
              height: '6.5rem',
              borderRadius: '9999px',
              objectFit: 'cover',
              animation: 'skullFloat 3s ease-in-out infinite',
            }}
          />
        </div>
        <p
          style={{
            color: '#00ff41',
            fontWeight: 700,
            letterSpacing: '0.3em',
            fontSize: '0.76rem',
            marginTop: '0.75rem',
            fontFamily: 'monospace',
          }}
        >
          BREACH TERMINAL
        </p>
        <p
          style={{
            color: 'rgba(0,255,65,0.35)',
            fontSize: 9,
            letterSpacing: '0.15em',
            marginTop: '0.25rem',
            fontFamily: 'monospace',
          }}
        >
          [ SECURE ACCESS REQUIRED ]
        </p>
      </div>

      {/* Motivational Left Panel */}
      <div
        className="quote-panel"
        style={{
          position: 'absolute',
          top: '50%',
          left: '5%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          maxWidth: '320px',
          fontFamily: 'monospace',
          color: '#00ff41',
          paddingLeft: '1.25rem',
          borderLeft: '2px solid rgba(0,255,65,0.6)',
          boxShadow: '-6px 0 15px -6px rgba(0,255,65,0.5)',
        }}
      >
        <div style={{ position: 'relative' }}>
          <p 
            style={{ 
              fontSize: '1.05rem', 
              lineHeight: '1.6', 
              marginBottom: '0.5rem',
              fontWeight: 500,
              textShadow: glitchActive ? '2px 0 #ff00ea, -2px 0 #00ccff' : '0 0 8px rgba(0,255,65,0.8)',
              animation: glitchActive ? 'glitch-anim-1 2s infinite linear alternate-reverse' : 'none',
              opacity: 0.9,
            }}
          >
            {quoteText}
            {quoteText.length < fullQuote.length && <span style={{ animation: 'statusBlink 0.3s step-end infinite', marginLeft: 4 }}>█</span>}
          </p>
        </div>
        <div style={{
          overflow: 'hidden',
          transition: 'max-height 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
          maxHeight: quoteText === fullQuote ? '50px' : '0px'
        }}>
          <p 
            style={{ 
              fontSize: '0.75rem', 
              letterSpacing: '0.25em', 
              color: 'rgba(0,255,65,0.6)',
              marginTop: '0.75rem',
              transform: quoteText === fullQuote ? 'translateY(0)' : 'translateY(-20px)',
              transition: 'transform 1s ease-out',
            }}
          >
            › KALI_LINUX_CORE
          </p>
        </div>
      </div>

      <div
        className="login-form-panel"
        style={{
          position: 'absolute',
          top: '50%',
          right: '5%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          width: '100%',
          maxWidth: 390,
          padding: '1.25rem 1.5rem',
          background: 'rgba(0, 10, 5, 0.4)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 255, 65, 0.15)',
          boxShadow: '0 0 40px rgba(0, 255, 65, 0.05), inset 0 0 20px rgba(0,0,0,0.8)',
          borderRadius: '4px',
        }}
      >
        <div style={{ position: 'absolute', top: -1, left: -1, width: 12, height: 12, borderTop: '2px solid #00ff41', borderLeft: '2px solid #00ff41', boxShadow: '-2px -2px 8px rgba(0,255,65,0.4)', borderRadius: '2px 0 0 0' }} />
        <div style={{ position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderTop: '2px solid #00ff41', borderRight: '2px solid #00ff41', boxShadow: '2px -2px 8px rgba(0,255,65,0.4)', borderRadius: '0 2px 0 0' }} />
        <div style={{ position: 'absolute', bottom: -1, left: -1, width: 12, height: 12, borderBottom: '2px solid #00ff41', borderLeft: '2px solid #00ff41', boxShadow: '-2px 2px 8px rgba(0,255,65,0.4)', borderRadius: '0 0 0 2px' }} />
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderBottom: '2px solid #00ff41', borderRight: '2px solid #00ff41', boxShadow: '2px 2px 8px rgba(0,255,65,0.4)', borderRadius: '0 0 2px 0' }} />

        <div style={{ borderTop: '1px solid rgba(0,255,65,0.1)', marginBottom: '1.25rem', position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              top: -9,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'rgba(0,255,65,0.3)',
              fontSize: 9,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              letterSpacing: '0.08em',
            }}
          >
            [ AUTHENTICATE ]
          </span>
        </div>

        <div>
          <p style={{ color: 'rgba(0,255,65,0.4)', fontSize: 9, fontFamily: 'monospace', marginBottom: 4 }}>
            USER_ID:
          </p>
          <div className="el-field">
            <span
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(0,255,65,0.5)',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
              }}
            >
              {'>'}
            </span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void handleLogin()}
              placeholder="enter username..."
              className="el-input"
              style={fieldInputStyle}
            />
          </div>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ color: 'rgba(0,255,65,0.4)', fontSize: 9, fontFamily: 'monospace', marginBottom: 4 }}>
            PASS_KEY:
          </p>
          <div className="el-field">
            <span
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(0,255,65,0.5)',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
              }}
            >
              {'>'}
            </span>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void handleLogin()}
              placeholder="enter password..."
              className="el-input"
              style={{ ...fieldInputStyle, paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPass((value) => !value)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(0,255,65,0.35)',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            >
              {showPass ? 'HIDE' : 'SHOW'}
            </button>
          </div>
        </div>

        {error && (
          <div className="el-shake" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            <p style={{ color: '#ef4444', fontSize: 9, fontFamily: 'monospace' }}>[ {error} ]</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1rem', gap: '0.7rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="el-remember"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="el-checkbox"
            />
            <label
              htmlFor="el-remember"
              style={{ color: 'rgba(0,255,65,0.4)', fontSize: 9, fontFamily: 'monospace', cursor: 'pointer' }}
            >
              OTURUMU ACIK TUT
            </label>
          </div>
          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loading}
            style={{
              padding: '0.4rem 2rem',
              fontFamily: 'monospace',
              fontSize: '0.66rem',
              fontWeight: 700,
              letterSpacing: '0.15em',
              cursor: loading ? 'default' : 'pointer',
              background: 'rgba(0,255,65,0.08)',
              border: '1px solid rgba(0,255,65,0.5)',
              color: '#00ff41',
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading ? '[ CONNECTING ]' : '[ ACCESS ]'}
          </button>
        </div>

        <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setHint('demo: ghost / demo_pass')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(0,255,65,0.25)',
              fontSize: 9,
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            sifremi unuttum?
          </button>
        </div>

        <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <span style={{ color: 'rgba(100,116,139,0.6)', fontSize: 9, fontFamily: 'monospace' }}>
            Hesabin yok mu?
          </span>
          <button
            type="button"
            onClick={() => setHint('Kayit sistemi yakinda aktif olacak.')}
            style={{
              background: 'transparent',
              border: 'none',
              marginLeft: '0.25rem',
              color: 'rgba(0,255,65,0.4)',
              fontSize: 9,
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            [ KAYIT OL ]
          </button>
        </div>

        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <p
            style={{
              color: 'rgba(0,255,65,0.15)',
              fontSize: 9,
              fontFamily: 'monospace',
              marginBottom: '0.25rem',
            }}
          >
            [ CONNECTION: ENCRYPTED - TLS 1.3 ]
          </p>
          <p className="el-blink" style={{ color: 'rgba(0,255,65,0.25)', fontSize: 9, fontFamily: 'monospace' }}>
            [ STATUS: AWAITING AUTHENTICATION ]
          </p>
          {!!hint && (
            <p style={{ color: '#4d7c4d', fontSize: 9, fontFamily: 'monospace', marginTop: 6 }}>{hint}</p>
          )}
        </div>

        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(0,255,65,0.15)' }}>v2.0.26</span>
          <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(0,255,65,0.15)' }}>{hexVal}</span>
        </div>
      </div>
    </div>
  )
}

const fieldInputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,0.7)',
  paddingLeft: '1.75rem',
  paddingRight: '1rem',
  paddingTop: '0.625rem',
  paddingBottom: '0.625rem',
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  color: '#00ff41',
  boxSizing: 'border-box' as const,
}
