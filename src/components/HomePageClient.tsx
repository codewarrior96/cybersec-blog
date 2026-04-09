'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import EmbeddedLogin from '@/components/EmbeddedLogin'
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton'
import { useAuthStatus } from '@/lib/auth-client'

const DashboardLayout = dynamic(() => import('@/components/dashboard/DashboardLayout'), {
  ssr: false,
  loading: () => <DashboardSkeleton />,
})

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
  const authStatus = useAuthStatus(initialAuth)
  const [dashboardReady, setDashboardReady] = useState(false)

  useEffect(() => {
    if (!authStatus) {
      setDashboardReady(false)
      return
    }

    const idleWindow = typeof window !== 'undefined'
      ? (window as Window & {
          requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
          cancelIdleCallback?: (handle: number) => void
        })
      : null

    let cancelled = false
    let timeoutId: number | null = null
    let idleId: number | null = null

    const markReady = () => {
      if (!cancelled) {
        setDashboardReady(true)
      }
    }

    if (idleWindow?.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(markReady, { timeout: 180 })
    } else {
      timeoutId = window.setTimeout(markReady, 80)
    }

    return () => {
      cancelled = true
      if (idleId !== null && idleWindow?.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [authStatus])

  if (authStatus === null) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#000102] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-cyan-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-mono text-cyan-900 uppercase tracking-widest">Authenticating</span>
        </div>
      </div>
    )
  }

  if (authStatus) {
    return (
      <ErrorBoundary
        fallback={
          <div style={{ color: 'red', padding: '20px', fontFamily: 'monospace' }}>
            SOC Dashboard Error - Check Console
          </div>
        }
      >
        {dashboardReady ? <DashboardLayout /> : <DashboardSkeleton />}
      </ErrorBoundary>
    )
  }

  return <EmbeddedLogin />
}
