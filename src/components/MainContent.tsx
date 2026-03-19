'use client'

import type { ReactNode } from 'react'
import { useAuthStatus } from '@/lib/auth-client'

export default function MainContent({ children }: { children: ReactNode }) {
  const loggedIn = useAuthStatus()

  return (
    <div
      style={{
        paddingLeft: loggedIn ? 'var(--operator-shell-offset, 280px)' : '0',
        transition: 'padding-left 0.3s ease',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  )
}
