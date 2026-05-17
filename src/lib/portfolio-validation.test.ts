// A-25 closure (Wave 11): per-platform socialLinks validation contract.
// 6 platform fields, all opsiyonel; 5 platforms validate against
// SOCIAL_USERNAME_RE (alphanumeric + . _ - up to 39 chars); `personal`
// validates as http(s) URL up to 200 chars. Empty values skip.
//
// SENIOR ARCHITECT NOTE: tests target validateProfilePayload's behavior
// rather than the internal regex constants — refactor-safe (operator
// could tighten or relax the regex without breaking these tests as long
// as the documented contract holds).
//
// REJECTED ALTERNATIVE: parametrize via it.each. Rejected — explicit
// named cases (T-SL01..06) produce richer failure diagnostics and
// document each platform's contract individually for audit-trail
// grep-ability.

import {
  parseProfilePayload,
  validateProfilePayload,
} from './portfolio-validation'
import type { PortfolioProfileFields } from './portfolio-profile'

function makePayload(overrides?: Partial<PortfolioProfileFields>): PortfolioProfileFields {
  return {
    headline: 'Operator',
    bio: 'Bio text.',
    location: '',
    socialLinks: {},
    specialties: [],
    tools: [],
    ...overrides,
  }
}

describe('portfolio-validation socialLinks (A-25 / Wave 11)', () => {
  // ─── parseSocialLinks via parseProfilePayload ─────────────────────────────

  it('T-SL01 — parseProfilePayload extracts 6 socialLinks fields from JSON body', () => {
    const parsed = parseProfilePayload({
      headline: 'X',
      bio: 'Y',
      location: '',
      socialLinks: {
        github: 'codewarrior96',
        linkedin: 'salim-aybasti',
        tryhackme: 'zerox',
        hackthebox: 'username',
        twitter: 'handle',
        personal: 'https://example.com',
      },
      specialties: [],
      tools: [],
    })
    expect(parsed.socialLinks).toEqual({
      github: 'codewarrior96',
      linkedin: 'salim-aybasti',
      tryhackme: 'zerox',
      hackthebox: 'username',
      twitter: 'handle',
      personal: 'https://example.com',
    })
  })

  it('T-SL02 — parseSocialLinks drops empty strings + non-string values + unknown keys', () => {
    const parsed = parseProfilePayload({
      headline: 'X',
      bio: 'Y',
      socialLinks: {
        github: '  codewarrior96  ', // trimmed
        linkedin: '', // dropped
        tryhackme: '   ', // whitespace → dropped
        hackthebox: 42, // non-string → dropped
        twitter: null, // null → dropped
        personal: undefined, // undefined → dropped
        instagram: 'unknown-platform', // unknown key → ignored
      },
    })
    expect(parsed.socialLinks).toEqual({ github: 'codewarrior96' })
  })

  // ─── validateProfilePayload — happy paths + per-platform rejection ────────

  it('T-SL03 — valid GitHub-style usernames accepted (alphanumeric + . _ - up to 39 chars)', () => {
    const acceptable = ['codewarrior96', 'a', 'user.name', 'user_name', 'user-name', 'A1B2C3', 'x'.repeat(39)]
    for (const username of acceptable) {
      const payload = makePayload({ socialLinks: { github: username } })
      expect(validateProfilePayload(payload)).toBeNull()
    }
  })

  it('T-SL04 — invalid GitHub usernames rejected (special chars, whitespace, > 39 chars)', () => {
    const rejected = ['user@name', 'has space', 'with/slash', '<script>', 'x'.repeat(40)]
    for (const username of rejected) {
      const payload = makePayload({ socialLinks: { github: username } })
      const result = validateProfilePayload(payload)
      expect(result).not.toBeNull()
      expect(result).toMatch(/GitHub/i)
    }
  })

  it('T-SL05 — each of the other 4 username platforms validated identically (LinkedIn/TryHackMe/HackTheBox/Twitter)', () => {
    const platforms: Array<['linkedin' | 'tryhackme' | 'hackthebox' | 'twitter', RegExp]> = [
      ['linkedin', /LinkedIn/i],
      ['tryhackme', /TryHackMe/i],
      ['hackthebox', /HackTheBox/i],
      ['twitter', /X.Twitter/i], // matches "X/Twitter" or "X.Twitter"
    ]
    for (const [key, errorPattern] of platforms) {
      // Valid: accepted
      expect(validateProfilePayload(makePayload({ socialLinks: { [key]: 'valid_user' } }))).toBeNull()
      // Invalid: rejected with platform-specific error message
      const result = validateProfilePayload(makePayload({ socialLinks: { [key]: 'has@invalid' } }))
      expect(result).not.toBeNull()
      expect(result).toMatch(errorPattern)
    }
  })

  it('T-SL06 — personal URL validation: http(s) only, ≤200 chars; non-URL or javascript: scheme rejected', () => {
    // Valid http + https
    expect(validateProfilePayload(makePayload({ socialLinks: { personal: 'https://example.com' } }))).toBeNull()
    expect(validateProfilePayload(makePayload({ socialLinks: { personal: 'http://example.com/path' } }))).toBeNull()

    // Rejected: non-URL
    expect(validateProfilePayload(makePayload({ socialLinks: { personal: 'just-text' } }))).toMatch(/Kisisel/i)
    // Rejected: javascript: scheme (XSS vector)
    expect(validateProfilePayload(makePayload({ socialLinks: { personal: 'javascript:alert(1)' } }))).toMatch(/Kisisel/i)
    // Rejected: data: scheme
    expect(validateProfilePayload(makePayload({ socialLinks: { personal: 'data:text/html,<script>' } }))).toMatch(/Kisisel/i)
    // Rejected: > 200 chars
    expect(
      validateProfilePayload(makePayload({ socialLinks: { personal: `https://example.com/${'a'.repeat(200)}` } })),
    ).toMatch(/Kisisel/i)
  })

  // ─── boundary: empty socialLinks payload + empty individual fields ───────

  it('T-SL07 — empty socialLinks object passes validation (all fields opsiyonel)', () => {
    expect(validateProfilePayload(makePayload({ socialLinks: {} }))).toBeNull()
    expect(validateProfilePayload(makePayload({ socialLinks: undefined }))).toBeNull()
  })

  it('T-SL08 — first invalid platform short-circuits validation (returns its specific error)', () => {
    const payload = makePayload({
      socialLinks: {
        github: 'valid_user',
        linkedin: 'has@invalid', // first failure
        tryhackme: 'also@invalid', // would also fail, but never reached
      },
    })
    const result = validateProfilePayload(payload)
    expect(result).toMatch(/LinkedIn/i)
    expect(result).not.toMatch(/TryHackMe/i)
  })
})
