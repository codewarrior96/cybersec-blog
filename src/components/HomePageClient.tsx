'use client'

import React from 'react'
import EmbeddedLogin from '@/components/EmbeddedLogin'
import DashboardLayout from '@/components/dashboard/DashboardLayout'

interface EBProps {
  children: React.ReactNode
  fallback: React.ReactNode
}

interface EBState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      console.error('SOC Dashboard crashed:', this.state.error)
      return this.props.fallback
    }
    return this.props.children
  }
}

interface HomePageClientProps {
  initialAuth: boolean
}

export default function HomePageClient({ initialAuth }: HomePageClientProps) {
  if (!initialAuth) {
    return <EmbeddedLogin redirectTo="/home" />
  }

  return (
    <ErrorBoundary
      fallback={
        <div style={{ color: 'red', padding: '20px', fontFamily: 'monospace' }}>
          SOC Dashboard Error - Check Console
        </div>
      }
    >
      <DashboardLayout />
    </ErrorBoundary>
  )
}
