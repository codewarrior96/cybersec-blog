'use client'

import { useEffect, useState } from 'react'

export default function MainContent({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    setLoggedIn(localStorage.getItem('auth_user') === 'ghost')
  }, [])

  return (
    <div
      style={{
        paddingLeft: loggedIn ? '220px' : '0',
        transition: 'padding-left 0.3s ease',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  )
}
