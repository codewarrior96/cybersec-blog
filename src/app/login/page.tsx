'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { getAuthSession, loginWithPassword } from '@/lib/auth-client'

export default function LoginPage() {
  const [username, setUsername] = useState('ghost')
  const [password, setPassword] = useState('demo_pass')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      const session = await getAuthSession(true)
      if (alive && session.authenticated) {
        window.location.href = '/'
      }
    }
    check()
    return () => {
      alive = false
    }
  }, [])

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await loginWithPassword(username, password)
      if (!result.ok) {
        setError(result.error ?? 'Giris basarisiz.')
        return
      }
      window.location.href = '/'
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 20%, rgba(0,255,65,0.09), rgba(0,0,0,0.98))',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          border: '1px solid rgba(0,255,65,0.35)',
          background: 'rgba(3,7,5,0.9)',
          padding: 22,
        }}
      >
        <div style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em' }}>
          BREACH TERMINAL / AUTH
        </div>

        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: '#4d7c4d', fontFamily: 'monospace', fontSize: 10 }}>USERNAME</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void submit()}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: '#4d7c4d', fontFamily: 'monospace', fontSize: 10 }}>PASSWORD</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void submit()}
              style={inputStyle}
            />
          </label>
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
          }}
        >
          {loading ? '[ CONNECTING... ]' : '[ ACCESS ]'}
        </button>

        <div style={{ marginTop: 8, color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>
          demo: ghost / demo_pass
        </div>
      </div>
    </div>
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
