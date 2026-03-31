import { createAlert, listAlerts } from '@/lib/soc-store-memory'

const STORE_KEY = '__SOC_MEMORY_STORE__'

describe('soc-store-memory listAlerts totals', () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>)[STORE_KEY]
  })

  test('returns total, activeTotal and resolvedTotal for dashboard counters', async () => {
    await createAlert({
      title: 'Critical SSH brute force',
      description: 'Repeated failed login attempts',
      priority: 'P1',
      status: 'new',
    })
    await createAlert({
      title: 'Suspicious outbound traffic',
      description: 'Possible C2 beacon',
      priority: 'P2',
      status: 'in_progress',
    })
    await createAlert({
      title: 'Old incident closed',
      description: 'Resolved and archived',
      priority: 'P3',
      status: 'resolved',
    })

    const result = await listAlerts({ limit: 20 })

    expect(result.total).toBe(3)
    expect(result.activeTotal).toBe(2)
    expect(result.resolvedTotal).toBe(1)
    expect(result.alerts.length).toBeGreaterThan(0)
  })
})
