'use client'

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import {
  fetchAlertSummary,
  fetchCriticalCveCount,
  fetchLiveAttack,
  fetchLiveMetrics,
} from '@/lib/soc-runtime/adapter'
import {
  createSocRuntimeInitialState,
  reduceSocRuntime,
  toSocRuntimeSnapshot,
} from '@/lib/soc-runtime/machine'
import { CRITICAL_EFFECT_TOKENS } from '@/lib/soc-runtime/critical-effects'

interface UseSocRuntimeOptions {
  initialDemoMode?: boolean
  overlayDurationMs?: number
}

export function useSocRuntime(options: UseSocRuntimeOptions = {}) {
  const {
    initialDemoMode = false,
    overlayDurationMs = CRITICAL_EFFECT_TOKENS.overlayDurationMs,
  } = options
  const [mounted, setMounted] = useState(false)
  const [state, dispatch] = useReducer(
    reduceSocRuntime,
    createSocRuntimeInitialState(initialDemoMode),
  )

  const snapshot = useMemo(() => toSocRuntimeSnapshot(state), [state])

  useEffect(() => {
    setMounted(true)
  }, [])

  const refreshMetrics = useCallback(async () => {
    const metrics = await fetchLiveMetrics()
    if (metrics) {
      dispatch({ type: 'set_metrics', payload: metrics })
    }
  }, [])

  const refreshSummary = useCallback(async () => {
    const [alerts, cves] = await Promise.all([fetchAlertSummary(), fetchCriticalCveCount()])

    if (alerts) {
      dispatch({ type: 'set_alert_count', payload: alerts.activeTotal })
    }
    if (typeof cves === 'number') {
      dispatch({ type: 'set_cve_count', payload: cves })
    }
  }, [])

  const ingestLiveAttack = useCallback(async () => {
    const attack = await fetchLiveAttack()
    if (!attack) return
    dispatch({
      type: 'ingest_attack',
      payload: attack,
      now: new Date().toISOString(),
    })
  }, [])

  useEffect(() => {
    void refreshMetrics()
    const timer = setInterval(() => void refreshMetrics(), 15_000)
    return () => clearInterval(timer)
  }, [refreshMetrics])

  useEffect(() => {
    void refreshSummary()
    const timer = setInterval(() => void refreshSummary(), 60_000)
    return () => clearInterval(timer)
  }, [refreshSummary])

  useEffect(() => {
    void ingestLiveAttack()
    const intervalMs = snapshot.demoMode ? 4_000 : 90_000
    const timer = setInterval(() => void ingestLiveAttack(), intervalMs)
    return () => clearInterval(timer)
  }, [ingestLiveAttack, snapshot.demoMode])

  useEffect(() => {
    if (snapshot.alarmState !== 'alarm_active' || !snapshot.overlayActive) return
    const timeout = setTimeout(() => {
      dispatch({ type: 'overlay_timeout', now: new Date().toISOString() })
    }, overlayDurationMs)
    return () => clearTimeout(timeout)
  }, [
    overlayDurationMs,
    snapshot.alarmState,
    snapshot.overlayActive,
    snapshot.overlayCycle,
  ])

  const toggleDemoMode = useCallback(() => {
    dispatch({ type: 'set_demo_mode', payload: !snapshot.demoMode })
  }, [snapshot.demoMode])

  const dismissIncident = useCallback((id: number) => {
    dispatch({ type: 'dismiss_incident', payload: id, now: new Date().toISOString() })
  }, [])

  const closePanel = useCallback(() => {
    dispatch({ type: 'close_panel', now: new Date().toISOString() })
  }, [])

  const openReport = useCallback((id: number) => {
    dispatch({ type: 'open_report', payload: id })
  }, [])

  const closeReport = useCallback(() => {
    dispatch({ type: 'close_report' })
  }, [])

  const manualReset = useCallback(() => {
    dispatch({ type: 'manual_reset', now: new Date().toISOString() })
  }, [])

  return {
    mounted,
    snapshot,
    actions: {
      refreshMetrics,
      refreshSummary,
      ingestLiveAttack,
      toggleDemoMode,
      dismissIncident,
      closePanel,
      openReport,
      closeReport,
      manualReset,
    },
  }
}
