export const REPORTS_UPDATED_EVENT = 'soc_reports_updated'

export function dispatchReportsUpdatedEvent() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT))
}

