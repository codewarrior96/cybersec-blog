'use client'

/**
 * SectionErrorBoundary — Wave 5A R-UI-10 closure.
 *
 * Generic per-section error boundary wrapper. Pre-Wave-5A,
 * HomePageClient's single top-level ErrorBoundary caught every
 * render failure and replaced the entire dashboard with a single
 * error message. Per-section boundaries isolate failures so one
 * panel crashing doesn't blank the whole page.
 *
 * Usage:
 *   <SectionErrorBoundary section="Dashboard">
 *     <DashboardLayout />
 *   </SectionErrorBoundary>
 *
 * Pattern derived from HomePageClient's inline class ErrorBoundary
 * (Phase 4.A R-UI-10 audit). Centralizing here avoids re-implementing
 * the class component per consumer.
 *
 * SENIOR ARCHITECT NOTE: React Error Boundaries MUST be class
 * components (hooks API doesn't support error catching yet). Inline
 * use across consumers is fine; this wrapper just sugar-coats the
 * common case with a section name + default fallback styled to fit
 * the dashboard's hacker aesthetic.
 *
 * REJECTED ALTERNATIVE: Next.js error.tsx route convention. Rejected
 * — error.tsx is route-level (catches everything in the route);
 * R-UI-10 wants SECTION-level granularity within HomePageClient.
 */

import React, { type ReactNode } from 'react'

interface SectionErrorBoundaryProps {
  section: string
  children: ReactNode
  fallback?: ReactNode
}

interface SectionErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Console-log with section context — production observability hook.
    // SENIOR ARCHITECT NOTE: replace with telemetry call when SOC has
    // a frontend-error sink (Phase 6 candidate). Until then, console.
    console.error(`[SectionErrorBoundary] section="${this.props.section}":`, error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      // Default fallback styled to fit dashboard aesthetic (hacker palette).
      // Compact + localized message preserves page utility — surrounding
      // sections still render normally.
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-2 rounded border border-rose-500/40 bg-rose-950/30 p-4 text-center"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-300">
            {this.props.section} unavailable
          </span>
          <span className="font-mono text-[10px] text-rose-200/70">
            Section crashed. Other panels remain operational.
          </span>
        </div>
      )
    }
    return this.props.children
  }
}
