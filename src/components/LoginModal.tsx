'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { getAuthSession, loginWithPassword } from '@/lib/auth-client'

interface LoginModalProps {
  onClose: () => void
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      const session = await getAuthSession(true)
      if (alive && session.authenticated) {
        onClose()
      }
    }
    check()
    return () => {
      alive = false
    }
  }, [onClose])

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await loginWithPassword(username, password)
      if (!result.ok) {
        setError(result.error ?? 'Giris basarisiz.')
        return
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'radial-gradient(circle at 50% 20%, rgba(0,255,65,0.1), rgba(0,0,0,0.96))',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          className="glitch-text"
          data-text="COEACH"
          style={{
            color: '#00ff41',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 'clamp(40px, 8vw, 72px)',
            letterSpacing: '0.04em',
            lineHeight: 1,
            textShadow: '0 0 18px rgba(0,255,65,0.25)',
          }}
        >
          COEACH
        </div>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 420,
          border: '1px solid rgba(0,255,65,0.35)',
          background: 'rgba(3,7,5,0.88)',
          padding: 20,
        }}
      >
        <div style={{ color: '#00ff41', fontFamily: 'monospace', letterSpacing: '0.2em', fontSize: 12 }}>
          BREACH TERMINAL LOGIN
        </div>
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <Field label="USER_ID">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void submit()}
              style={inputStyle}
            />
          </Field>
          <Field label="PASS_KEY">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void submit()}
              style={inputStyle}
            />
          </Field>
        </div>
        {error && (
          <div style={{ marginTop: 10, color: '#ef4444', fontFamily: 'monospace', fontSize: 11 }}>
            [ {error} ]
          </div>
        )}
        <button
          onClick={() => void submit()}
          disabled={loading}
          style={{
            marginTop: 16,
            width: '100%',
            border: '1px solid rgba(0,255,65,0.6)',
            background: 'rgba(0,255,65,0.08)',
            color: '#00ff41',
            padding: '8px 10px',
            fontFamily: 'monospace',
            fontSize: 11,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '[ CONNECTING... ]' : '[ ACCESS ]'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ color: '#4d7c4d', fontFamily: 'monospace', fontSize: 10 }}>{label}:</span>
      {children}
    </label>
  )
}

const inputStyle: CSSProperties = {
  border: '1px solid rgba(0,255,65,0.25)',
  background: 'rgba(0,0,0,0.7)',
  color: '#00ff41',
  fontFamily: 'monospace',
  fontSize: 12,
  padding: '8px 10px',
}
