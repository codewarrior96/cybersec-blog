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
  const [booting, setBooting] = useState(true)
  const [bootLog, setBootLog] = useState<string[]>([])

  useEffect(() => {
    let current = 0
    const steps = [
      'INIT SECURE_KERNEL v2.0.26',
      'ESTABLISHING CONNECTION... TLS 1.3',
      'BYPASSING FIREWALL... [ OK ]',
      'ACQUIRING BIOMETRICS... [ OK ]',
      'DECRYPTING GHOST PROTOCOL... [ OK ]',
      'SYSTEM READY.'
    ]
    const interval = setInterval(() => {
      if (current < steps.length) {
        setBootLog(prev => [...prev, steps[current]])
        current++
      } else {
        clearInterval(interval)
        setTimeout(() => setBooting(false), 500)
      }
    }, 280)
    return () => clearInterval(interval)
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

  if (booting) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#020502', color: '#00ff41', fontFamily: 'monospace', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '4rem' }}>
        {bootLog.map((log, i) => (
          <div key={i} style={{ fontSize: '0.85rem', marginBottom: '0.6rem', textShadow: '0 0 6px rgba(0,255,65,0.7)', opacity: 0.9 }}>
            {'>'} {log}
          </div>
        ))}
        <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', animation: 'statusBlink 1s step-end infinite', textShadow: '0 0 6px rgba(0,255,65,0.8)' }}>
          {'>'} █
        </div>
      </div>
    )
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
      `}</style>

      <img
        src="/hacker.jpg"
        alt=""
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(90%)',
          transition: 'transform 1.3s cubic-bezier(0.16, 1, 0.3, 1)',
          width: '100%',
          maxWidth: 720,
          height: '94vh',
          objectFit: 'cover',
          objectPosition: 'top center',
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          background:
            'linear-gradient(to top, rgba(0,0,0,0.985) 0%, rgba(0,0,0,0.2) 45%, rgba(0,0,0,0.85) 100%), linear-gradient(to right, rgba(0,0,0,0.65) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      <div style={{ position: 'absolute', inset: 0, zIndex: 3, opacity: 0.17, pointerEvents: 'none' }}>
        <MatrixRain />
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px)',
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

      <div
        style={{
          position: 'absolute',
          bottom: '2%',
          left: '50%',
          transform: 'translateX(-50%)',
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
