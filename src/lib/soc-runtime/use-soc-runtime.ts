'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  fetchAlertSummary,
  fetchCriticalCveCount,
  fetchRecentAlertAttacks,
  fetchLiveMetrics,
} from '@/lib/soc-runtime/adapter'
import {
  createSocRuntimeInitialState,
  reduceSocRuntime,
  toSocRuntimeSnapshot,
} from '@/lib/soc-runtime/machine'
import { CRITICAL_EFFECT_TOKENS } from '@/lib/soc-runtime/critical-effects'

interface UseSocRuntimeOptions {
  overlayDurationMs?: number
}

export function useSocRuntime(options: UseSocRuntimeOptions = {}) {
  const { overlayDurationMs = CRITICAL_EFFECT_TOKENS.overlayDurationMs } = options
  const [mounted, setMounted] = useState(false)
  const [state, dispatch] = useReducer(reduceSocRuntime, createSocRuntimeInitialState())

  const snapshot = useMemo(() => toSocRuntimeSnapshot(state), [state])
  const seenAttackIdsRef = useRef<Set<number>>(new Set<number>())
  const hasPrimedLiveFeedRef = useRef(false)

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
    const attacks = await fetchRecentAlertAttacks(25)
    if (attacks.length === 0) return

    if (!hasPrimedLiveFeedRef.current) {
      for (const attack of attacks) {
        seenAttackIdsRef.current.add(attack.id)
      }
      hasPrimedLiveFeedRef.current = true
      return
    }

    const sorted = [...attacks].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    )

    for (const attack of sorted) {
      if (seenAttackIdsRef.current.has(attack.id)) continue
      seenAttackIdsRef.current.add(attack.id)
      dispatch({
        type: 'ingest_attack',
        payload: attack,
        now: new Date().toISOString(),
      })
    }
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
    const timer = setInterval(() => void ingestLiveAttack(), 15_000)
    return () => clearInterval(timer)
  }, [ingestLiveAttack])

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
      dismissIncident,
      closePanel,
      openReport,
      closeReport,
      manualReset,
    },
  }
}
