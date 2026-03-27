'use client'

import NavigationBar from '@/components/NavigationBar'

export default function NavPreviewPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#050a14' }}>
      <NavigationBar threatCount={6} warnCount={14} currentPath="/portfolio" onLogout={() => { void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(() => { window.location.href = '/login' }) }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px', color: '#94a3b8', fontFamily: 'monospace' }}>
        <h1 style={{ color: '#00ff88', fontSize: 18, letterSpacing: '0.08em' }}>NAV PREVIEW</h1>
        <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}>
          This page exists only for validating the top bar on desktop and mobile.
        </p>
      </div>
    </div>
  )
}
