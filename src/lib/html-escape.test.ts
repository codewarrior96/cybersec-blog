import { describe, it, expect } from 'vitest'
import { escapeHtml } from './html-escape'

describe('html-escape', () => {
  describe('escapeHtml', () => {
    it('T-HE01: escapes < > & " \' (R-13 charset)', () => {
      // Each character must be replaced with its HTML entity. The 5-char
      // set covers HTML-text and HTML-attribute injection vectors.
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
      expect(escapeHtml("O'Brien")).toBe('O&#39;Brien')
    })

    it('T-HE02: ampersand escaped first (no double-escape)', () => {
      // Critical ordering invariant: & must be replaced before < > etc.
      // Otherwise &lt; would become &amp;lt; (double-escaped corruption).
      expect(escapeHtml('&lt;')).toBe('&amp;lt;')
      expect(escapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;')
    })

    it('T-HE03: leaves safe characters untouched', () => {
      // Letters, digits, common punctuation, whitespace, Unicode letters
      // — none have HTML-syntactic meaning and pass through verbatim.
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123')
      expect(escapeHtml('Müller-Çelik')).toBe('Müller-Çelik')
      expect(escapeHtml('user.name+tag')).toBe('user.name+tag')
    })

    it('T-HE04: empty string passes through', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('T-HE05: idempotent against safe input (escaping safe text returns same text)', () => {
      const safe = 'Hello World 123 Müller'
      expect(escapeHtml(escapeHtml(safe))).toBe(safe)
    })

    it('T-HE06: full XSS payload neutralized', () => {
      // Smoke test of realistic XSS payloads that R-13 documented.
      expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
        '&lt;img src=x onerror=alert(1)&gt;',
      )
      expect(escapeHtml('<script>alert(1)</script>')).toBe(
        '&lt;script&gt;alert(1)&lt;/script&gt;',
      )
    })
  })
})
