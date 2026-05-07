'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MatrixRain from '@/components/MatrixRain'
import { getAuthSession, loginWithPassword } from '@/lib/auth-client'

interface EmbeddedLoginProps {
  redirectTo?: string
  autoRedirectIfAuthenticated?: boolean
}

export default function EmbeddedLogin({ redirectTo = '/home', autoRedirectIfAuthenticated = true }: EmbeddedLoginProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hexVal, setHexVal] = useState('0000')
  const [hint, setHint] = useState('')
  // Phase 4.5 — unverified-email recovery state. `unverifiedEmail` is
  // non-null after a 403 EMAIL_NOT_VERIFIED login response; the UI then
  // reveals a resend-verification block. `resendEmailInput` lets the
  // user edit/correct the address before re-triggering the email,
  // pre-filled from the server when available.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [resendEmailInput, setResendEmailInput] = useState('')
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [resendError, setResendError] = useState<string | null>(null)
  const [kaliQuoteText, setKaliQuoteText] = useState('')
  const fullKaliQuote = '"The quieter you become, the more you are able to hear."'
  const [kaliGlitchActive, setKaliGlitchActive] = useState(false)

  const [pythonQuoteText, setPythonQuoteText] = useState('')
  const fullPythonQuote = '"Code is read much more often than it is written."'
  const [pythonGlitchActive, setPythonGlitchActive] = useState(false)

  useEffect(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*'
    let interval: ReturnType<typeof setInterval>
    
    // First animation starting (Python Quote)
    const delay = setTimeout(() => {
      let iteration1 = 0
      interval = setInterval(() => {
        setPythonQuoteText(fullPythonQuote.split('').map((char, index) => {
          if (index < Math.floor(iteration1)) return char
          if (char === ' ') return ' '
          return chars[Math.floor(Math.random() * chars.length)]
        }).join(''))

        if (iteration1 >= fullPythonQuote.length) {
          clearInterval(interval)
          setTimeout(() => setPythonGlitchActive(true), 800)
          
          // Trigger the Kali Linux quote animation after Python is done
          setTimeout(startKaliAnimation, 1400)
        }
        
        iteration1 += 1 / 3
      }, 35)
    }, 1200)

    const startKaliAnimation = () => {
      let iteration2 = 0
      interval = setInterval(() => {
        setKaliQuoteText(fullKaliQuote.split('').map((char, index) => {
          if (index < Math.floor(iteration2)) return char
          if (char === ' ') return ' '
          return chars[Math.floor(Math.random() * chars.length)]
        }).join(''))

        if (iteration2 >= fullKaliQuote.length) {
          clearInterval(interval)
          setTimeout(() => setKaliGlitchActive(true), 1500)
        }
        
        iteration2 += 1 / 3
      }, 35)
    }
    
    return () => {
      clearTimeout(delay)
      if (interval) clearInterval(interval)
    }
  }, [])


  useEffect(() => {
    if (!autoRedirectIfAuthenticated) return
    let alive = true
    const check = async () => {
      const session = await getAuthSession(false)
      if (alive && session.authenticated) {
        router.push(redirectTo)
      }
    }
    void check()
    return () => {
      alive = false
    }
  }, [autoRedirectIfAuthenticated, redirectTo, router])

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
    setUnverifiedEmail(null)
    setResendStatus('idle')
    setResendError(null)
    try {
      const result = await loginWithPassword(username.trim(), password, { remember })
      if (!result.ok) {
        if (result.code === 'EMAIL_NOT_VERIFIED') {
          // Reveal the resend-verification block. Pre-fill the email
          // when the server supplied it so the operator can hit
          // "yeniden gönder" without retyping; otherwise leave the
          // input empty and let them enter it manually.
          const prefill = result.email ?? ''
          setUnverifiedEmail(prefill)
          setResendEmailInput(prefill)
          setError(result.error ?? 'E-posta doğrulanmamış')
          return
        }
        setError(result.error ?? 'Giriş bilgileri hatalı')
        return
      }
      router.push(redirectTo)
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (resending) return
    const target = resendEmailInput.trim()
    if (!target) {
      setResendError('E-posta adresi gerekli.')
      setResendStatus('error')
      return
    }
    setResending(true)
    setResendError(null)
    setResendStatus('idle')
    try {
      const response = await fetch('/api/auth/verify/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      })
      if (response.status === 429) {
        setResendStatus('error')
        setResendError('Çok fazla deneme. Bir saat sonra tekrar deneyin.')
        return
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        setResendStatus('error')
        setResendError(payload.error === 'INVALID_EMAIL' ? 'Geçersiz e-posta formatı.' : 'E-posta gönderilemedi.')
        return
      }
      setResendStatus('sent')
    } catch {
      setResendStatus('error')
      setResendError('Bağlantı hatası.')
    } finally {
      setResending(false)
    }
  }


  const loginStyles = `
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

        .el-input {
          -webkit-appearance: none;
          appearance: none;
          background: transparent !important;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          color: #00ff41;
          caret-color: #00ff41;
        }
        .el-input::placeholder { color: rgba(0,255,65,0.2); }
        .el-input:focus { outline: none; }
        .el-input:-webkit-autofill,
        .el-input:-webkit-autofill:hover,
        .el-input:-webkit-autofill:focus,
        .el-input:-webkit-autofill:active {
          -webkit-text-fill-color: #00ff41 !important;
          -webkit-box-shadow: 0 0 0 1000px rgba(0,0,0,0.7) inset !important;
          box-shadow: 0 0 0 1000px rgba(0,0,0,0.7) inset !important;
          transition: background-color 9999s ease-in-out 0s;
          border: 0;
        }

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
          content: "\\2713";
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
        .login-root {
          min-height: 100dvh;
        }
        .hero-image {
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 100%;
          max-width: 950px;
          height: 100vh;
          object-fit: cover;
          object-position: top center;
          z-index: 1;
          opacity: 0.65;
          mix-blend-mode: lighten;
        }
        .aurora-field {
          position: absolute;
          top: 25%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 45vw;
          height: 45vw;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0,255,65,0.3) 0%, transparent 60%);
          z-index: 2;
          pointer-events: none;
          animation: slowGlow 5s ease-in-out infinite;
          mix-blend-mode: screen;
        }
        .mobile-container {
          position: absolute;
          inset: 0;
          z-index: 10;
          pointer-events: none;
        }
        .skull-group {
          pointer-events: auto;
          position: absolute;
          top: 25%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          text-align: center;
          width: 100%;
        }
        .skull-frame {
          margin: 0 auto;
          position: relative;
          width: 9.7rem;
          height: 9.7rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .skull-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 2px solid #00ff41;
        }
        .skull-image {
          width: 6.5rem;
          height: 6.5rem;
          border-radius: 9999px;
          object-fit: cover;
          animation: skullFloat 3s ease-in-out infinite;
        }
        .hero-eyes {
          position: absolute;
          bottom: 38%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 6;
          display: flex;
          gap: 4.4rem;
          pointer-events: none;
        }
        @media (max-width: 960px) {
          .mobile-container {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            padding: calc(env(safe-area-inset-top, 0px) + 1.1rem) 1rem calc(env(safe-area-inset-bottom, 0px) + 1.8rem) !important;
            gap: 1.1rem !important;
            overflow-y: auto !important;
            pointer-events: auto !important;
          }
          .mobile-container {
            scrollbar-width: none !important;
          }
          .mobile-container::-webkit-scrollbar {
            display: none !important;
          }
          .skull-group {
            position: static !important;
            transform: none !important;
            width: min(100%, 22rem) !important;
            margin-top: 0 !important;
            padding: 0.25rem 0 0.35rem !important;
          }
          .skull-frame {
            width: 6.6rem !important;
            height: 6.6rem !important;
          }
          .skull-ring {
            border-width: 1.5px !important;
          }
          .skull-image {
            width: 4.8rem !important;
            height: 4.8rem !important;
          }
          .quote-panel {
            display: none !important;
          }
          .login-form-panel {
            position: static !important;
            transform: none !important;
            width: min(100%, 22rem) !important;
            max-width: min(100%, 22rem) !important;
            margin-bottom: 0 !important;
            padding: 1rem 1rem 0.9rem !important;
            background: linear-gradient(180deg, rgba(0, 12, 6, 0.84), rgba(0, 8, 4, 0.72)) !important;
            backdrop-filter: blur(12px) !important;
            box-shadow: 0 0 0 1px rgba(0, 255, 65, 0.12), 0 18px 42px rgba(0, 0, 0, 0.55), inset 0 0 28px rgba(0, 0, 0, 0.72) !important;
          }
          .hero-image {
            left: 50% !important;
            width: 130% !important;
            max-width: none !important;
            height: 100dvh !important;
            opacity: 0.28 !important;
            transform: translateX(-50%) scale(1.05) !important;
            object-position: center top !important;
          }
          .aurora-field {
            top: 18% !important;
            width: 82vw !important;
            height: 82vw !important;
            opacity: 0.72 !important;
            filter: blur(4px) !important;
          }
          .hero-eyes {
            bottom: 18% !important;
            gap: 2.7rem !important;
            opacity: 0.18 !important;
            transform: translateX(-50%) scale(0.62) !important;
          }
        }
        @media (max-width: 560px) {
          .login-root {
            min-height: 100svh !important;
          }
          .mobile-container {
            padding-top: calc(env(safe-area-inset-top, 0px) + 0.9rem) !important;
            gap: 0.9rem !important;
          }
          .skull-group p:first-of-type {
            margin-top: 0.55rem !important;
            font-size: 0.68rem !important;
            letter-spacing: 0.25em !important;
          }
          .skull-group p:last-of-type {
            font-size: 8px !important;
          }
          .login-form-panel {
            border-radius: 6px !important;
          }
        }
        @media (max-width: 400px) {
          .mobile-container {
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
          }
          .login-form-panel {
            width: 100% !important;
            max-width: 100% !important;
            padding-left: 0.9rem !important;
            padding-right: 0.9rem !important;
          }
        }
  `;

  return (
    <div className="login-root" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', backgroundColor: '#000' }}>
      <style dangerouslySetInnerHTML={{ __html: loginStyles }} />

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
        className="hero-image"
        src="/hacker.jpg"
        alt=""
        style={{
          bottom: 0,
          transform: visible ? 'translateX(-50%) translateY(0) scale(1.03)' : 'translateX(-50%) translateY(40%) scale(0.95)',
          transition: 'transform 1.8s cubic-bezier(0.16, 1, 0.3, 1), filter 1.8s',
          filter: visible ? 'contrast(1.15) brightness(0.8) drop-shadow(0 -10px 40px rgba(0,255,65,0.15))' : 'brightness(0)',
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
        className="aurora-field"
        style={{
          top: '25%', left: '50%', transform: 'translate(-50%, -50%)',
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

      <div className="hero-eyes">
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

      <div className="mobile-container">
        <div
          className="skull-group"
          style={{
            top: '25%',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
        <div
          className="skull-frame"
          style={{
          }}
        >
          <div
            className="el-ring skull-ring"
            style={{
            }}
          />
          <img
            className="skull-image"
            src="/skull.jpg"
            alt="skull"
            style={{
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
          pointerEvents: 'auto',
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
        <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
          <p 
            style={{ 
              fontSize: '1.05rem', 
              lineHeight: '1.6', 
              marginBottom: '0.5rem',
              fontWeight: 500,
              textShadow: pythonGlitchActive ? '2px 0 #ff00ea, -2px 0 #00ccff' : '0 0 8px rgba(0,255,65,0.8)',
              animation: pythonGlitchActive ? 'glitch-anim-1 2s infinite linear alternate-reverse' : 'none',
              opacity: 0.9,
            }}
          >
            {pythonQuoteText}
            {pythonQuoteText.length > 0 && pythonQuoteText.length < fullPythonQuote.length && <span style={{ animation: 'statusBlink 0.3s step-end infinite', marginLeft: 4 }}>█</span>}
          </p>
          <div style={{
            overflow: 'hidden',
            transition: 'max-height 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
            maxHeight: pythonQuoteText === fullPythonQuote ? '50px' : '0px'
          }}>
            <p 
              style={{ 
                fontSize: '0.75rem', 
                letterSpacing: '0.25em', 
                color: 'rgba(0,255,65,0.6)',
                marginTop: '0.75rem',
                transform: pythonQuoteText === fullPythonQuote ? 'translateY(0)' : 'translateY(-20px)',
                transition: 'transform 1s ease-out',
              }}
            >
              › GUIDO_VAN_ROSSUM
            </p>
          </div>
        </div>

        {pythonGlitchActive && (
          <div style={{ position: 'relative' }}>
            <p 
              style={{ 
                fontSize: '1.05rem', 
                lineHeight: '1.6', 
                marginBottom: '0.5rem',
                fontWeight: 500,
                textShadow: kaliGlitchActive ? '2px 0 #ff00ea, -2px 0 #00ccff' : '0 0 8px rgba(0,255,65,0.8)',
                animation: kaliGlitchActive ? 'glitch-anim-1 2s infinite linear alternate-reverse' : 'none',
                opacity: 0.9,
              }}
            >
              {kaliQuoteText}
              {kaliQuoteText.length < fullKaliQuote.length && <span style={{ animation: 'statusBlink 0.3s step-end infinite', marginLeft: 4 }}>█</span>}
            </p>
            <div style={{
              overflow: 'hidden',
              transition: 'max-height 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: kaliQuoteText === fullKaliQuote ? '50px' : '0px'
            }}>
              <p 
                style={{ 
                  fontSize: '0.75rem', 
                  letterSpacing: '0.25em', 
                  color: 'rgba(0,255,65,0.6)',
                  marginTop: '0.75rem',
                  transform: kaliQuoteText === fullKaliQuote ? 'translateY(0)' : 'translateY(-20px)',
                  transition: 'transform 1s ease-out',
                }}
              >
                › KALI_LINUX_CORE
              </p>
            </div>
          </div>
        )}
      </div>

      <div
        className="login-form-panel"
        style={{
          pointerEvents: 'auto',
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
            Kullanıcı adı
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
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="Kullanıcı adınızı giriniz"
              className="el-input"
              style={fieldInputStyle}
            />
          </div>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ color: 'rgba(0,255,65,0.4)', fontSize: 9, fontFamily: 'monospace', marginBottom: 4 }}>
            Şifre
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
              autoComplete="current-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="Şifrenizi giriniz"
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
              {showPass ? 'Gizle' : 'Göster'}
            </button>
          </div>
        </div>

        {error && (
          <div className="el-shake" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            <p style={{ color: '#ef4444', fontSize: 9, fontFamily: 'monospace' }}>{error}</p>
          </div>
        )}

        {unverifiedEmail !== null && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              background: 'rgba(245, 158, 11, 0.06)',
              borderRadius: 4,
            }}
          >
            <p
              style={{
                color: 'rgba(245, 158, 11, 0.85)',
                fontSize: 9,
                fontFamily: 'monospace',
                letterSpacing: '0.12em',
                marginBottom: '0.5rem',
              }}
            >
              E-posta doğrulanmamış
            </p>
            <p
              style={{
                color: 'rgba(0,255,65,0.55)',
                fontSize: 10,
                fontFamily: 'monospace',
                lineHeight: 1.55,
                marginBottom: '0.6rem',
              }}
            >
              Hesabin var ama email henuz dogrulanmamis. Mail kutunu kontrol et veya yeni bir baglanti talep et.
            </p>
            <input
              type="email"
              value={resendEmailInput}
              onChange={(event) => setResendEmailInput(event.target.value)}
              placeholder="email adresi"
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="el-input"
              style={{
                ...fieldInputStyle,
                paddingLeft: '0.75rem',
                border: '1px solid rgba(0,255,65,0.25)',
                marginBottom: '0.5rem',
              }}
            />
            <button
              type="button"
              onClick={() => void handleResendVerification()}
              disabled={resending || resendStatus === 'sent'}
              style={{
                width: '100%',
                padding: '0.4rem 0',
                fontFamily: 'monospace',
                fontSize: '0.66rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                cursor: resending || resendStatus === 'sent' ? 'default' : 'pointer',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                color: '#fbbf24',
                opacity: resending ? 0.75 : 1,
              }}
            >
              {resending
                ? 'Gönderiliyor...'
                : resendStatus === 'sent'
                  ? 'Gönderildi'
                  : 'Yeniden gönder'}
            </button>
            {resendStatus === 'sent' && (
              <p
                style={{
                  marginTop: '0.5rem',
                  color: 'rgba(74, 222, 128, 0.85)',
                  fontSize: 9,
                  fontFamily: 'monospace',
                  textAlign: 'center',
                }}
              >
                Eger email kayitliysa, yeni dogrulama bagi gonderildi.
              </p>
            )}
            {resendStatus === 'error' && resendError && (
              <p
                style={{
                  marginTop: '0.5rem',
                  color: '#ef4444',
                  fontSize: 9,
                  fontFamily: 'monospace',
                  textAlign: 'center',
                }}
              >
                {resendError}
              </p>
            )}
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
              Bu cihazda oturumumu 30 gün hatırla
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
            {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
          </button>
        </div>

        <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
          {/* Phase 5: live link to the forgot-password gateway. The
              existing "sifremi unuttum?" placeholder used to be a
              no-op button calling setHint('') — replaced with a real
              router.push so the user lands on /forgot and can request
              a reset link. */}
          <button
            type="button"
            onClick={() => router.push('/forgot')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(0,255,65,0.85)',
              fontSize: 11,
              fontFamily: 'monospace',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationColor: 'rgba(0,255,65,0.5)',
              textUnderlineOffset: '3px',
              padding: '0.25rem 0.5rem',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#00ff41' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(0,255,65,0.85)' }}
          >
            Şifremi unuttum
          </button>
        </div>

        <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <span style={{ color: 'rgba(148,163,184,0.85)', fontSize: 11, fontFamily: 'monospace' }}>
            Hesabınız yok mu?
          </span>
          <button
            type="button"
            onClick={() => router.push('/register')}
            style={{
              background: 'transparent',
              border: 'none',
              marginLeft: '0.5rem',
              color: 'rgba(0,255,65,0.95)',
              fontSize: 11,
              fontFamily: 'monospace',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationColor: 'rgba(0,255,65,0.5)',
              textUnderlineOffset: '3px',
              padding: '0.25rem 0.5rem',
              fontWeight: 600,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#00ff41' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(0,255,65,0.95)' }}
          >
            Kayıt ol
          </button>
        </div>

        {!!hint && (
          <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            <p style={{ color: '#4d7c4d', fontSize: 9, fontFamily: 'monospace' }}>{hint}</p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

const fieldInputStyle = {
  width: '100%',
  background: 'transparent',
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  border: 'none',
  paddingLeft: '1.75rem',
  paddingRight: '1rem',
  paddingTop: '0.625rem',
  paddingBottom: '0.625rem',
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  color: '#00ff41',
  caretColor: '#00ff41',
  colorScheme: 'dark' as const,
  boxSizing: 'border-box' as const,
}
