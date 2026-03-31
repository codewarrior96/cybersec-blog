import { fetchAlertSummary, fetchCriticalCveCount } from '@/lib/soc-runtime/adapter'

function mockResponse(payload: unknown, ok = true) {
  return {
    ok,
    json: async () => payload,
  } as Response
}

describe('soc runtime adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('fetchCriticalCveCount counts by score field first, with severity fallback', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        cves: [
          { score: 9.8, severity: 'HIGH' },
          { score: 8.7, severity: 'CRITICAL' },
          { score: null, severity: 'CRITICAL' },
          { score: null, severity: 'LOW' },
        ],
      }),
    )

    const count = await fetchCriticalCveCount()
    expect(count).toBe(2)
  })

  test('fetchAlertSummary prefers totals from API and keeps fallback behavior', async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          alerts: [{ id: 1 }],
          total: 12,
          activeTotal: 5,
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          alerts: [{ id: 1 }, { id: 2 }],
        }),
      )

    const first = await fetchAlertSummary()
    const second = await fetchAlertSummary()

    expect(first).toEqual({ total: 12, activeTotal: 5 })
    expect(second).toEqual({ total: 2, activeTotal: 2 })
  })
})
