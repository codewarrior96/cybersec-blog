// @vitest-environment jsdom
//
// Wave 2A — R-UI-04 closure regression tests for CriticalAlertPanel.
//
// The panel uses emoji as incident-type icons. Phase 4.A audit flagged
// this as WCAG 4.1.2 violation (Name, Role, Value): bare emoji are
// announced by screen readers as Unicode codepoint names (varies per
// UA, sometimes meaningless for non-literal-emoji incidents like
// 🛰 satellite-for-C2). Wave 2A fix: wrap each emoji in
// <span role="img" aria-label="..."> with Turkish descriptive labels.
//
// SENIOR ARCHITECT NOTE: tests assert the observable a11y contract —
// role + aria-label presence + axe-clean — NOT the specific emoji
// codepoint or the Turkish wording (those are content decisions the
// component owns). Refactor-safe: if mentor changes a label, tests
// stay green.
//
// REJECTED ALTERNATIVE: snapshot the rendered HTML. Rejected —
// snapshots create false-positive churn on every styling tweak. The
// contract is "role=img + aria-label present", verified directly.

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import CriticalAlertPanel, {
  type CriticalAlertQueueItem,
} from '@/components/dashboard/CriticalAlertPanel'

// ─── fixtures ────────────────────────────────────────────────────────────────

const QUEUE: CriticalAlertQueueItem[] = [
  {
    id: 'inc-001',
    sev: 'CRITICAL',
    label: 'Ransomware detected',
    source: '10.0.0.5',
    node: 'edge-01',
    region: 'eu-west-1',
    time: new Date('2026-05-15T10:00:00Z').toISOString(),
  },
  {
    id: 'inc-002',
    sev: 'HIGH',
    label: 'SQL injection burst',
    source: '203.0.113.7',
    node: 'api-02',
    region: 'us-east-1',
    time: new Date('2026-05-15T10:01:00Z').toISOString(),
  },
  {
    id: 'inc-003',
    sev: 'HIGH',
    label: 'C2 beaconing',
    source: '198.51.100.9',
    node: 'core-04',
    region: 'ap-south-1',
    time: new Date('2026-05-15T10:02:00Z').toISOString(),
  },
]

describe('CriticalAlertPanel — Wave 2A R-UI-04 closure (emoji-as-icon a11y)', () => {
  it('T-CAP01 — renders open panel with incident queue without crashing', () => {
    const onReport = vi.fn()
    const onDismiss = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      <CriticalAlertPanel
        queue={QUEUE}
        open={true}
        onReport={onReport}
        onDismiss={onDismiss}
        onClose={onClose}
      />,
    )
    // Confirm dialog mounts
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('T-CAP02 — every emoji icon has role="img" + aria-label (R-UI-04 contract)', () => {
    const onReport = vi.fn()
    const onDismiss = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      <CriticalAlertPanel
        queue={QUEUE}
        open={true}
        onReport={onReport}
        onDismiss={onDismiss}
        onClose={onClose}
      />,
    )

    // Every <span role="img"> must have non-empty aria-label.
    // SENIOR ARCHITECT NOTE: at least one per incident — but the panel
    // may have additional decorative icons (e.g., severity chip emoji)
    // so we assert ≥ QUEUE.length, not === QUEUE.length, leaving
    // headroom for future icon additions without test churn.
    const iconRoles = container.querySelectorAll('[role="img"]')
    expect(iconRoles.length).toBeGreaterThanOrEqual(QUEUE.length)
    iconRoles.forEach((el) => {
      const label = el.getAttribute('aria-label')
      expect(label).toBeTruthy()
      expect(label?.length).toBeGreaterThan(0)
    })
  })

  it('T-CAP-A11 — axe smoke: zero violations in R-UI-04 emoji-icon scope', async () => {
    // SENIOR ARCHITECT NOTE: axe is scoped to rules R-UI-04 owns —
    // image-alt + aria-allowed-attr + aria-valid-attr-value +
    // role-img-alt — verifying the emoji wrap closure works as
    // intended for AT consumers.
    //
    // Wave 6 update: `button-name` rule is now ENABLED — the
    // out-of-scope discovery from Wave 2A (X close button missing
    // aria-label) was closed in Wave 6 (see T-CAP-A11-DISMISS below
    // for the dedicated regression guard). Keeping `button-name`
    // enabled here serves as a secondary check: if any future
    // refactor reintroduces a button without an accessible name,
    // this scope-clean smoke fires.
    const onReport = vi.fn()
    const onDismiss = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      <CriticalAlertPanel
        queue={QUEUE}
        open={true}
        onReport={onReport}
        onDismiss={onDismiss}
        onClose={onClose}
      />,
    )
    const results = await axe(container, {
      rules: {
        // R-UI-04 emoji-wrap scope (rules that touch the closure):
        'image-alt': { enabled: true },
        'aria-allowed-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
        'aria-valid-attr': { enabled: true },
        'role-img-alt': { enabled: true },
        // Wave 6: re-enabled after T-CAP-A11-DISMISS closure.
        'button-name': { enabled: true },
        // Out of scope: every other rule disabled to keep this a
        // PRECISE R-UI-04 + button-name contract assertion.
        region: { enabled: false },
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false },
        'color-contrast': { enabled: false },
      },
    })
    expect(results).toHaveNoViolations()
  })

  it('T-CAP-A11-DISMISS — dismiss button-name violation RESOLVED (was gap-test T-CAP-A11-GAP, Wave 6 flip)', async () => {
    // Wave 6 closure: this test was T-CAP-A11-GAP in Wave 2A, where it
    // asserted that a `button-name` violation EXISTED today (R-21 gap-test
    // pattern — Phase 1 lineage). The violation was: the X close button in
    // the panel header had no accessible name (icon-only, no aria-label).
    //
    // Wave 6 added `aria-label="Kritik uyarı panelini kapat"` to that
    // button + `aria-hidden="true"` on the inner <X /> icon. This test
    // is FLIPPED: the assertion now verifies that NO button-name
    // violation exists.
    //
    // SENIOR ARCHITECT NOTE: 2nd gap-test → regression-guard lifecycle
    // transition in the project's pattern catalog (1st: Wave 2B
    // T-MO-CHMOD-EQ-GAP → T-MO-CHMOD-EQ01). Renamed from T-CAP-A11-GAP
    // to T-CAP-A11-DISMISS so the audit-trail lineage stays grep-able
    // (search for "T-CAP-A11" finds both the broad smoke + this
    // dedicated dismiss guard).
    //
    // REJECTED ALTERNATIVE: delete this test, rely on T-CAP-A11 (broad
    // smoke) alone. Rejected — a dedicated regression-guard test makes
    // the closure intent self-documenting + preserves the historical
    // pattern lineage. Both tests cost ~30ms in CI, negligible.
    const onReport = vi.fn()
    const onDismiss = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      <CriticalAlertPanel
        queue={QUEUE}
        open={true}
        onReport={onReport}
        onDismiss={onDismiss}
        onClose={onClose}
      />,
    )
    const results = await axe(container, {
      rules: {
        // Only check button-name; this is the dedicated regression guard
        'button-name': { enabled: true },
        // Disable all other rules to keep the assertion precise
        region: { enabled: false },
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false },
        'color-contrast': { enabled: false },
      },
    })
    // Wave 6: assertion FLIPPED — violation must be GONE now.
    expect(results).toHaveNoViolations()
    expect(results.violations.some((v) => v.id === 'button-name')).toBe(false)
  })
})
