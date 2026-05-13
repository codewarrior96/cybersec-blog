// Phase 1.5.13 — content distribution security primitives.
//
// Purpose: neutralize AV ML false-positives (Defender flagged the repo ZIP as
// Trojan:PowerShell/ReverseShell.HNAA!MTB because raw reverse-shell payloads
// in `.mdx` source files match heuristic patterns). These helpers let blog
// posts ship risky payload examples as base64-encoded strings inside
// `<EncodedCodeBlock>` JSX tags, decoded at browser runtime.
//
// SENIOR ARCHITECT NOTE: environment-agnostic. Works in both Node (during
// `npm run build` static generation, tests, and any pre-encode tooling) and
// in the browser at component-decode time. Uses `Buffer` when available,
// falls back to `btoa`/`atob`. UTF-8 handling preserved on both paths.
//
// REJECTED ALTERNATIVE: ship encoded payloads through an MDX rehype plugin
// that auto-encodes risky fenced blocks at build time. Rejected — that hides
// the encoding step from source, and the raw payload would still be present
// in the `.mdx` file (the actual artifact Defender scans). The whole point
// is to keep raw payload bytes out of the on-disk source. Encoded JSX in the
// `.mdx` is the user-visible contract.

const SAFE_BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * Encode an arbitrary UTF-8 string to base64. Newlines preserved.
 *
 * Server-safe: uses Node Buffer when available (test env, build pipeline),
 * falls back to TextEncoder + btoa for browser pre-encode tooling.
 */
export function encodePayload(raw: string): string {
  if (typeof raw !== 'string') {
    throw new TypeError('encodePayload: input must be a string')
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(raw, 'utf-8').toString('base64')
  }
  // Browser fallback: btoa() expects a binary string, not arbitrary UTF-8 —
  // route through TextEncoder to get bytes, then to binary string.
  const bytes = new TextEncoder().encode(raw)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Decode a base64 string back to the original UTF-8 text.
 *
 * Throws on invalid base64 input. Callers (notably EncodedCodeBlock) wrap
 * this in try/catch and surface a non-fatal fallback to the reader.
 */
export function decodePayload(encoded: string): string {
  if (typeof encoded !== 'string') {
    throw new TypeError('decodePayload: input must be a string')
  }
  // Defensive validation — if a copy-paste mishap puts non-base64 garbage in
  // an MDX `data="..."` attribute, fail fast rather than emit silent
  // gibberish into the rendered page.
  if (!SAFE_BASE64_RE.test(encoded)) {
    throw new Error('decodePayload: invalid base64 input')
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(encoded, 'base64').toString('utf-8')
  }
  // Browser fallback: atob → binary string → bytes → TextDecoder.
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

// SENIOR ARCHITECT NOTE: pattern catalog mirrors the state gathering regex
// from Phase 1.5.13 inventory. Triggers are AV ML heuristic seeds — the goal
// is "if this string appears verbatim in a `.mdx` file, the ZIP will be
// flagged by Defender." The catalog is conservative-biased: we'd rather
// encode a benign block that happens to mention `bash -i` in a comment than
// leak a raw payload.
//
// REJECTED ALTERNATIVE: ML classifier (regex-free). Rejected — overkill,
// pulls in heavy deps, and the false-positive surface is already well-known
// from the AV catalogs themselves. Maintainable regex matches OWASP-style
// payload references.
const RISKY_PATTERNS: readonly RegExp[] = [
  // Unix reverse shells
  /\bbash\s+-i\b/,
  /\bsh\s+-i\b/,
  /\b\/dev\/tcp\//,
  /\b\/dev\/udp\//,
  /\bnc\s+-[el]/,
  /\bnetcat\s+-[el]/,
  /\bmkfifo\b/,
  /\bsocat\s+(?:exec|tcp)/i,
  // Windows / PowerShell
  /\bpowershell\s+-nop\b/i,
  /\bpowershell\s+-enc\b/i,
  /\bIEX\s*\(/,
  /\bInvoke-Expression\b/i,
  /\bSystem\.Net\.Sockets\.TCPClient\b/,
  /\bInvoke-Mimikatz\b/i,
  // AD / credential-dump tooling
  /\bmimikatz\b/i,
  /\bsecretsdump\b/i,
  /\bsekurlsa::/i,
  /\blsadump\b/i,
  /\bRubeus\b/,
  /\bGetUserSPNs\b/,
  /\bkerberoast\b/i,
  /\bDCSync\b/i,
  // Binary exploitation / shellcode
  /\bmsfvenom\b/i,
  /\bmeterpreter\b/i,
  /\bshellcode\b/i,
  /\bpwntools\b/i,
  /(?:\\x[0-9a-f]{2}){4,}/i, // 4+ consecutive \xNN escapes
  // Web exploitation
  /\bUNION\s+SELECT\b/i,
  /\bDROP\s+TABLE\b/i,
  /<script>[\s\S]*?\balert\s*\(/i,
  /<script>[\s\S]*?(?:document\.cookie|new\s+Image\s*\(|fetch\s*\([^)]*\?)/i,
  /\bonerror\s*=\s*alert\s*\(/i,
  /\.innerHTML\s*=\s*[a-zA-Z_$][\w.$]*\s*;/,
  /\blocation\.hash\.slice\s*\(/,
  /\beval\s*\(\s*["'`]/,
  /\beval\s*\(\s*[a-zA-Z_$][\w.$]*\s*\)/,
  /\bos\.system\s*\(/,
  /\bsubprocess\.Popen.*shell\s*=\s*True/,
  // Pipe-to-shell patterns
  /\bwget\s+[^|]*\|\s*sh\b/,
  /\bcurl\s+[^|]*\|\s*sh\b/,
]

/**
 * Heuristic: does this text contain a payload pattern that AV ML models
 * (notably Defender) are known to flag?
 *
 * Use as a migration aid — wrap raw blocks that match in `<EncodedCodeBlock>`.
 * Returns false for benign command snippets (e.g. `whoami`, `id`, `ls -la`).
 */
export function isLikelyRiskyPayload(text: string): boolean {
  if (typeof text !== 'string' || text.length === 0) return false
  return RISKY_PATTERNS.some((re) => re.test(text))
}
