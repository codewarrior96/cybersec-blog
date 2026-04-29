import { resolvePath, getNode, basename, colorEntry } from './filesystem'
import { getCommand, listRegistryCommandNames } from './commands'
import type { EvidenceEvent, EvidenceLog, EvidencePrimitive } from './evidence'
import { applyMutation, getMutableNode } from './mutation'
import { getManPage } from './manpages'
import { detectRevealEvent, formatBanner } from './reveal'
import { challengeContracts } from './validation/contracts'
import type { CommandContext, FSNode } from './types'

export interface RevealHooks {
  evidenceLog: EvidenceLog
  unlockedLevels: ReadonlySet<number>
  alreadyRevealed: ReadonlySet<number>
}

let nextEvidenceEventId = 0

// ─── Valid CTF Flags ──────────────────────────────────────────────────────────

export const VALID_FLAGS: ReadonlySet<string> = new Set([
  'FLAG{r3con_master_l1nux}',
  'FLAG{ch4mod_p3rm1ss10ns}',
  'FLAG{h1dden_1n_pl41n_s1ght}',
  'FLAG{gr3p_1s_p0w3r}',
  'FLAG{pr1v3sc_r00t_0wn3d}',
  'FLAG{n3tw0rk_m4st3r_2024}',
])

// ─── Known Commands (single source of truth for tab completion) ──────────────
//
// Tokens dispatched by the runSingle switch-case. When you add a new `case`
// arm in runSingle, add the token here too — they MUST stay synchronized.
// The verifyRegistry helper validates the registry side; this array covers
// the remaining switch arms.
//
// Stage 3 (Block C): replaces the hand-maintained KNOWN_COMMANDS list that
// previously lived in components/lab/Terminal.tsx. Terminal now imports
// getKnownCommands() — adding a tool here automatically expands tab
// completion without a second-list update.
const SWITCH_COMMAND_TOKENS: readonly string[] = [
  'help', 'clear', 'history', 'pwd', 'whoami', 'id', 'hostname',
  'date', 'uptime', 'uname', 'env',
  'ls', 'cd', 'cat', 'grep', 'find', 'tree',
  'wc', 'head', 'tail', 'sort', 'uniq', 'awk', 'sed',
  'strings', 'xxd', 'base64', 'file', 'stat', 'echo',
  'chmod', 'mkdir', 'touch', 'rm', 'mv',
  'ps', 'top', 'htop', 'du', 'df', 'free', 'vmstat', 'iostat', 'lsof', 'mount',
  'who', 'w', 'last',
  'ifconfig', 'ip', 'netstat', 'ss', 'route', 'arp',
  'traceroute', 'tracepath', 'dig', 'nslookup', 'ping',
  'curl', 'wget', 'sudo', 'man', 'which', 'crontab',
  'bash', 'python', 'python3', 'submit', 'exit', 'logout',
  // Security tools (simulated)
  'nmap', 'wpscan', 'nikto', 'sqlmap',
  'gobuster', 'dirb', 'wfuzz', 'ffuf',
  'hydra', 'hashcat', 'john', 'ssh2john', 'unshadow',
  'msfconsole', 'msfvenom',
  'aircrack-ng', 'airodump-ng', 'aireplay-ng',
  'enum4linux', 'responder', 'nuclei',
  'amass', 'sublist3r', 'recon-ng',
  'wireshark', 'tcpdump', 'tshark',
  'shodan', 'theharvester', 'binwalk', 'gdb',
  'netcat', 'nc', 'ssh', 'ftp', 'telnet',
  'burpsuite', 'burp', 'ghidra', 'radare2', 'r2',
] as const

// Tokens recognized by the default-branch in runSingle (mimikatz `::` syntax,
// msfconsole/recon-ng REPL inner verbs). They produce friendly stub output
// rather than "command not found".
const DEFAULT_BRANCH_TOKENS: readonly string[] = [
  'search', 'use', 'marketplace', 'modules', 'options', 'sessions',
] as const

/**
 * Returns every command the engine recognizes — registry + switch-case +
 * default-branch verbs — deduplicated and sorted alphabetically. Consumed by
 * Terminal.tsx for tab completion.
 */
export function getKnownCommands(): readonly string[] {
  const seen = new Set<string>()
  for (const name of listRegistryCommandNames()) seen.add(name.toLowerCase())
  for (const name of SWITCH_COMMAND_TOKENS) seen.add(name)
  for (const name of DEFAULT_BRANCH_TOKENS) seen.add(name)
  return Array.from(seen).sort()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Flag verification helper — usable independently of CTFTab. */
export function isValidFlag(flag: string): boolean {
  return VALID_FLAGS.has(flag.trim())
}

/** Runs a raw command string (supports pipes). Returns output lines. */
export function runCommand(
  raw: string,
  ctx: CommandContext,
  onEvent?: (event: EvidenceEvent) => void,
  reveal?: RevealHooks,
): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const pipelineSegments = splitPipeline(trimmed)
  if (pipelineSegments) {
    return runPipeline(trimmed, pipelineSegments, ctx, onEvent, reveal)
  }

  return runSingle(trimmed, ctx, '', onEvent, true, reveal).output
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

function runPipeline(
  raw: string,
  segments: string[],
  ctx: CommandContext,
  onEvent?: (event: EvidenceEvent) => void,
  reveal?: RevealHooks,
): string[] {
  let stdin = ''
  const cwdBefore = ctx.cwd
  const segmentPrimitives: EvidencePrimitive[] = []
  let exitCode = 0

  for (const segment of segments) {
    const result = runSingle(segment, ctx, stdin, undefined, false)
    stdin = result.output.join('\n')
    exitCode = result.exitCode
    segmentPrimitives.push(...result.primitives)
  }

  const firstTokens = tokenize(segments[0] ?? '')
  const output = stdin.split('\n')

  const pipelineEvent: EvidenceEvent = {
    id: nextEvidenceEventId++,
    timestamp: Date.now(),
    raw,
    command: firstTokens[0]?.toLowerCase() ?? '',
    args: firstTokens.slice(1).map(stripQuotes),
    cwdBefore,
    cwdAfter: ctx.cwd,
    output,
    exitCode,
    primitives: [
      ...segmentPrimitives,
      { type: 'pipeline_used', commands: segments.map(segment => tokenize(segment)[0]?.toLowerCase() ?? '') },
    ],
    source: 'user',
  }

  emitEvidenceEvent(pipelineEvent, onEvent)

  const revealOutput = runRevealCheck(reveal, pipelineEvent, onEvent)
  return revealOutput.length > 0 ? [...output, ...revealOutput] : output
}

// ─── Single Command ───────────────────────────────────────────────────────────

interface SingleCommandResult {
  output: string[]
  primitives: EvidencePrimitive[]
  exitCode: number
}

function emitEvidenceEvent(event: EvidenceEvent, onEvent?: (event: EvidenceEvent) => void): void {
  if (!onEvent) return

  try {
    onEvent(event)
  } catch (err) {
    console.error('[BREACH LAB] Evidence event handler failed:', err)
  }
}

function runSingle(
  raw: string,
  ctx: CommandContext,
  stdin: string,
  onEvent?: (event: EvidenceEvent) => void,
  emitEvent = true,
  reveal?: RevealHooks,
): SingleCommandResult {
  const cwdBefore = ctx.cwd
  const tokens = tokenize(raw)
  const cmd    = tokens[0]?.toLowerCase() ?? ''
  const args   = tokens.slice(1).map(stripQuotes)

  const handler = getCommand(cmd)
  if (handler) {
    const result = handler.execute(args, ctx, stdin)
    const baseOutput = result.output
    const primitives = result.evidence ?? []

    let output = baseOutput
    if (emitEvent) {
      const event: EvidenceEvent = {
        id: nextEvidenceEventId++,
        timestamp: Date.now(),
        raw,
        command: cmd,
        args,
        cwdBefore,
        cwdAfter: ctx.cwd,
        output: baseOutput,
        exitCode: result.exitCode,
        primitives,
        source: 'user',
      }
      emitEvidenceEvent(event, onEvent)
      const revealOutput = runRevealCheck(reveal, event, onEvent)
      if (revealOutput.length > 0) {
        output = [...baseOutput, ...revealOutput]
      }
    }

    return { output, primitives, exitCode: result.exitCode }
  }

  const output = (() => {
  switch (cmd) {
    case 'help':         return cmdHelp()
    case 'clear':        return ['__CLEAR__']
    case 'history':      return ctx.history.map((h, i) => `  ${String(i + 1).padStart(4)}  ${h}`)
    case 'pwd':          return [ctx.cwd]
    case 'whoami':       return ['operator']
    case 'id':           return ['uid=1000(operator) gid=1000(operator) groups=1000(operator),27(sudo),4(adm)']
    case 'hostname':     return ['breach-lab']
    case 'date':         return cmdDate(args)
    case 'uptime':       return cmdUptime(args)
    case 'uname':        return cmdUname(args)
    case 'env':          return cmdEnv(ctx)
    case 'ls':           return cmdLs(args, ctx)
    case 'cd':           return cmdCd(args, ctx)
    case 'cat':          return cmdCat(args, ctx)
    case 'grep':         return cmdGrep(args, ctx, stdin)
    case 'find':         return cmdFind(args, ctx)
    case 'tree':         return cmdTree(ctx)
    case 'wc':           return cmdWc(args, ctx, stdin)
    case 'head':         return cmdSlice(args, ctx, stdin, 'head')
    case 'tail':         return cmdSlice(args, ctx, stdin, 'tail')
    case 'sort':         return cmdSort(args, stdin)
    case 'uniq':         return stdin.split('\n').filter((l, i, a) => l !== a[i - 1])
    case 'awk':          return cmdAwk(args, ctx, stdin)
    case 'sed':          return cmdSed(args, stdin)
    case 'strings':      return cmdStrings(args, ctx)
    case 'xxd':          return cmdXxd(args, ctx)
    case 'base64':       return cmdBase64(args, stdin)
    case 'file':         return cmdFile(args, ctx)
    case 'stat':         return cmdStat(args, ctx)
    case 'echo':         return cmdEcho(args, ctx)
    case 'chmod':        return cmdChmod(args, ctx)
    case 'mkdir':        return cmdMkdir(args, ctx)
    case 'touch':        return cmdTouch(args, ctx)
    case 'rm':           return cmdRm(args, ctx)
    case 'mv':           return cmdMv(args, ctx)
    case 'ps':           return cmdPs(args)
    case 'top': case 'htop': return cmdTop()
    case 'du':           return cmdDu(args, ctx)
    case 'df':           return cmdDf(args)
    case 'free':         return cmdFree(args)
    case 'vmstat':       return cmdVmstat(args)
    case 'iostat':       return cmdIostat(args)
    case 'lsof':         return cmdLsof(args)
    case 'mount':        return cmdMount(args)
    case 'who':          return cmdWho(args)
    case 'w':            return cmdW(args)
    case 'last':         return cmdLast(args)
    case 'ifconfig':     return cmdIfconfig(args)
    case 'ip':           return cmdIp(args)
    case 'netstat': case 'ss': return cmdNetstat(cmd, args)
    case 'route':        return cmdRoute(args)
    case 'arp':          return cmdArp(args)
    case 'traceroute': case 'tracepath': return cmdTraceroute(args)
    case 'dig':          return cmdDig(args)
    case 'nslookup':     return cmdNslookup(args)
    case 'ping':         return cmdPing(args)
    case 'curl': case 'wget': return cmdCurl(args)
    case 'sudo':         return cmdSudo(args, ctx)
    case 'man':          return cmdMan(args)
    case 'which':        return cmdWhich(args)
    case 'crontab':      return args.includes('-l') ? ['*/5 * * * * root /usr/bin/backup.sh', '0 3 * * 0 root /usr/bin/cleanup.sh'] : ['usage: crontab -l']
    case 'bash':         return cmdBash(args, ctx)
    case 'python3': case 'python': return cmdPython(args, ctx)
    case 'submit':       return cmdSubmit(args)
    case 'exit': case 'logout': return ['\x1b[90mGoodbye, Operator.\x1b[0m']
    case '':             return []
    // ── Security Tools (Simulated) ─────────────────────────────────────────
    case 'nmap':         return cmdNmap(args)
    case 'wpscan':       return cmdWpscan(args)
    case 'nikto':        return cmdNikto(args)
    case 'sqlmap':       return cmdSqlmap(args)
    case 'gobuster': case 'dirb': case 'wfuzz': return cmdGobuster(cmd, args)
    case 'ffuf':         return cmdFfuf(args)
    case 'hydra':        return cmdHydra(args)
    case 'hashcat': case 'john': return cmdHashcat(cmd, args)
    case 'ssh2john':     return cmdSsh2john(args)
    case 'unshadow':     return cmdUnshadow(args)
    case 'msfconsole': case 'msfvenom': return cmdMsf(cmd, args)
    case 'aircrack-ng': case 'airodump-ng': case 'aireplay-ng': return cmdAircrack(cmd, args)
    case 'enum4linux':   return cmdEnum4linux(args)
    case 'responder':    return cmdResponder(args)
    case 'nuclei':       return cmdNucleI(args)
    case 'amass': case 'sublist3r': case 'recon-ng': return cmdAmass(cmd, args)
    case 'wireshark': case 'tcpdump': return cmdTcpdump(cmd, args)
    case 'tshark':       return cmdTshark(args)
    case 'shodan':       return cmdShodan(args)
    case 'theharvester': return cmdTheHarvester(args)
    case 'binwalk':      return cmdBinwalk(args)
    case 'gdb':          return cmdGdb(args)
    case 'netcat': case 'nc':   return cmdNetcat(args)
    case 'ssh': case 'ftp': case 'telnet': return cmdSsh(cmd, args)
    case 'burpsuite': case 'burp': return [`\x1b[33m[*] Burp Suite is a GUI application; it cannot be launched from the terminal.\x1b[0m`, `\x1b[90m    Real-world: java -jar burpsuite.jar\x1b[0m`]
    case 'ghidra': case 'radare2': case 'r2': return [`\x1b[33m[*] ${cmd} is a GUI/TUI application.\x1b[0m`, `\x1b[90m    Real-world: ${cmd === 'ghidra' ? 'ghidraRun' : 'r2 <binary>'}\x1b[0m`]
    default: {
      const maybePath = stripQuotes(cmd)
      if (maybePath.startsWith('/') || maybePath.startsWith('~') || maybePath.startsWith('.')) {
        const candidate = resolvePath(ctx.cwd, maybePath)
        const node = getCtxNode(ctx, candidate)

        if (node?.type === 'dir') {
          return [`\x1b[33m[?] ${maybePath} is a directory. Use cd ${maybePath} to enter it.\x1b[0m`]
        }

        if (node?.type === 'file') {
          return [`\x1b[33m[?] ${maybePath} is a file. Use cat ${maybePath} to view it.\x1b[0m`]
        }

        // Path-style invocation of a script not present in the lab FS
        // (e.g. ./linpeas.sh, ./support/analyzeHeadless) — friendly stub.
        if (maybePath.endsWith('.sh') || maybePath.includes('linpeas')) {
          return [
            `\x1b[90m[${maybePath} ${args.join(' ')}]\x1b[0m`,
            `\x1b[90m(simulated execution — script not staged in lab FS)\x1b[0m`,
            `\x1b[90mIn the real workflow you would download it first:\x1b[0m`,
            `\x1b[90m  curl -L https://github.com/.../linpeas.sh -o linpeas.sh && chmod +x linpeas.sh\x1b[0m`,
          ]
        }
        return [
          `\x1b[90m[${maybePath} ${args.join(' ')}]\x1b[0m`,
          `\x1b[90m(simulated execution — file not in lab FS)\x1b[0m`,
        ]
      }

      // Mimikatz module-style syntax: lsadump::dcsync, privilege::debug …
      if (cmd.includes('::')) {
        return [
          `\x1b[33m[mimikatz]\x1b[0m ${cmd} ${args.join(' ')}`,
          '\x1b[90m(Windows-only — run inside the mimikatz.exe REPL)\x1b[0m',
          `\x1b[90mExample real flow: privilege::debug → ${cmd}\x1b[0m`,
        ]
      }

      // Framework REPL verbs (msfconsole / recon-ng inner commands)
      if (cmd === 'search' || cmd === 'use' || cmd === 'marketplace'
          || cmd === 'modules' || cmd === 'options' || cmd === 'sessions') {
        return [
          `\x1b[33m[REPL verb]\x1b[0m ${cmd} ${args.join(' ')}`,
          '\x1b[90m(this is an msfconsole/recon-ng inner verb — start the framework first)\x1b[0m',
          `\x1b[90mUsage:\x1b[0m`,
          `\x1b[90m  msfconsole -q\x1b[0m`,
          `\x1b[90m  msf6> ${cmd} ${args.join(' ')}\x1b[0m`,
        ]
      }

      return [`\x1b[31mbash: ${cmd}: command not found\x1b[0m`]
    }
  }
  })()

  // Universal switch-case evidence: command_executed, command_executed_with_args,
  // flag_submitted, file_read (cat/wc/grep/awk), file_modified_perms, security_tool_used.
  // CTF-specific inferences (passwd_line_count, privesc_via_sudo_find, suspicious_port_4444,
  // backdoor_investigated) used to live here as a transitional shim — they are now
  // captured declaratively in validation/contracts.ts via the underlying primitives.
  const primitives = emitSwitchBaseEvidence(cmd, args, ctx)

  let finalOutput = output
  if (emitEvent) {
    const event: EvidenceEvent = {
      id: nextEvidenceEventId++,
      timestamp: Date.now(),
      raw,
      command: cmd,
      args,
      cwdBefore,
      cwdAfter: ctx.cwd,
      output,
      exitCode: 0,
      primitives,
      source: 'user',
    }
    emitEvidenceEvent(event, onEvent)
    const revealOutput = runRevealCheck(reveal, event, onEvent)
    if (revealOutput.length > 0) {
      finalOutput = [...output, ...revealOutput]
    }
  }

  return { output: finalOutput, primitives, exitCode: 0 }
}

/**
 * Run reveal-event detection across every unlocked-but-not-yet-revealed level.
 * For each match, append a CRT banner to terminal output and emit a
 * `flag_revealed` evidence event so downstream listeners (page state) can
 * unlock the next level and persist the flag silently.
 *
 * Returns the extra output lines to append to the visible terminal stream.
 */
function runRevealCheck(
  reveal: RevealHooks | undefined,
  event: EvidenceEvent,
  onEvent?: (event: EvidenceEvent) => void,
): string[] {
  if (!reveal) return []

  let augmentedLog = reveal.evidenceLog.append(event)
  const localRevealed = new Set(reveal.alreadyRevealed)
  const extraOutput: string[] = []

  const sortedLevels = Array.from(reveal.unlockedLevels).sort((a, b) => a - b)
  for (const level of sortedLevels) {
    if (localRevealed.has(level)) continue

    const contract = challengeContracts[level]
    if (!contract || !contract.expectedFlag || !contract.levelTitle) continue

    const nextContract = challengeContracts[level + 1]
    const revealEvent = detectRevealEvent({
      level,
      log: augmentedLog,
      contract,
      expectedFlag: contract.expectedFlag,
      levelTitle: contract.levelTitle,
      nextLevelTitle: nextContract?.levelTitle ?? null,
      alreadyRevealed: localRevealed,
    })

    if (!revealEvent) continue

    const banner = formatBanner(revealEvent)
    const bannerLines = banner.split('\n')
    extraOutput.push('', ...bannerLines, '')

    const flagEvent: EvidenceEvent = {
      id: nextEvidenceEventId++,
      timestamp: Date.now(),
      raw: '__reveal__',
      command: '__reveal__',
      args: [String(level)],
      cwdBefore: '/',
      cwdAfter: '/',
      output: bannerLines,
      exitCode: 0,
      primitives: [{ type: 'flag_revealed', level, flag: revealEvent.flag }],
      source: 'replay',
    }
    emitEvidenceEvent(flagEvent, onEvent)
    augmentedLog = augmentedLog.append(flagEvent)
    localRevealed.add(level)
  }

  return extraOutput
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tokenize(raw: string): string[] {
  return raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
}

function splitPipeline(raw: string): string[] | null {
  const segments: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (const char of raw) {
    if ((char === '"' || char === "'")) {
      quote = quote === char ? null : quote ?? char
      current += char
      continue
    }

    if (char === '|' && quote === null) {
      segments.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  segments.push(current.trim())

  const cleanedSegments = segments.filter(Boolean)
  if (cleanedSegments.length <= 1) return null
  return cleanedSegments
}

function stripQuotes(t: string): string {
  return t.replace(/^['"]|['"]$/g, '')
}

function flags(args: string[]): string {
  return args.filter(a => a.startsWith('-')).join('')
}

function nonFlags(args: string[]): string[] {
  return args.filter(a => !a.startsWith('-'))
}

function getCtxNode(ctx: CommandContext, path: string): FSNode | null {
  if (ctx.mutableFs) {
    return getMutableNode(ctx.mutableFs, path)
  }
  return getNode(path)
}

function resolve(ctx: CommandContext, target = '.'): FSNode | null {
  return getCtxNode(ctx, resolvePath(ctx.cwd, target))
}

function existingFilePath(ctx: CommandContext, target: string | undefined): string | null {
  if (!target) return null
  const path = resolvePath(ctx.cwd, target)
  const node = getCtxNode(ctx, path)
  return node?.type === 'file' ? path : null
}

function isSudoFindExecCat(args: string[]): boolean {
  if (args[0] !== 'find') return false
  return args.includes('-exec') && args.includes('cat')
}

/**
 * Emit universal evidence for any switch-case command. Returns base primitives
 * (command_executed, command_executed_with_args, flag_submitted) plus any
 * universally-applicable side-effect primitives (file_read for read tools,
 * file_modified_perms for chmod, security_tool_used for sudo).
 *
 * This function is intentionally CTF-agnostic: validation contracts in
 * validation/contracts.ts express challenge-specific patterns declaratively
 * over these primitives. Adding new CTF rules here is a smell — extend the
 * contract instead.
 */
function emitSwitchBaseEvidence(cmd: string, args: string[], ctx: CommandContext): EvidencePrimitive[] {
  const primitives: EvidencePrimitive[] = [{ type: 'command_executed', command: cmd }]

  if (args.length > 0) {
    primitives.push({ type: 'command_executed_with_args', command: cmd, args })
  }

  if (cmd === 'submit' && args[0]) {
    primitives.push({ type: 'flag_submitted', flag: args[0] })
  }

  if (cmd === 'cat') {
    for (const target of nonFlags(args)) {
      const path = existingFilePath(ctx, target)
      if (path) {
        primitives.push({ type: 'file_read', path, via: 'cat' })
      }
    }
  }

  if (cmd === 'chmod') {
    const [perms, target] = args
    const path = existingFilePath(ctx, target)
    if (perms && path) {
      primitives.push({ type: 'file_modified_perms', path, perms })
    }
  }

  if (cmd === 'sudo') {
    primitives.push({ type: 'security_tool_used', tool: 'sudo' })
    if (isSudoFindExecCat(args)) {
      primitives.push({ type: 'security_tool_used', tool: 'find' })
    }
  }

  if (cmd === 'wc') {
    const target = nonFlags(args)[0]
    const path = existingFilePath(ctx, target)
    if (path) primitives.push({ type: 'file_read', path, via: 'wc' })
  }

  if (cmd === 'grep') {
    const target = nonFlags(args)[1]
    const path = existingFilePath(ctx, target)
    if (path) primitives.push({ type: 'file_read', path, via: 'grep' })
  }

  if (cmd === 'awk') {
    const target = nonFlags(args)[1]
    const path = existingFilePath(ctx, target)
    if (path) primitives.push({ type: 'file_read', path, via: 'awk' })
  }

  return primitives
}

// ─── Mutation Command Implementations ────────────────────────────────────────

function cmdTouch(args: string[], ctx: CommandContext): string[] {
  if (!args.length) return ['\x1b[31mtouch: missing operand\x1b[0m']
  if (!ctx.mutableFs) {
    return [`\x1b[90m(simulated: touch ${args.join(' ')})\x1b[0m`]
  }

  const lines: string[] = []
  for (const target of nonFlags(args)) {
    const path = resolvePath(ctx.cwd, target)
    const result = applyMutation(ctx.mutableFs, { kind: 'touch', path })
    if (!result.success && result.error) {
      lines.push(`\x1b[31m${result.error}\x1b[0m`)
    }
  }
  return lines
}

function cmdMkdir(args: string[], ctx: CommandContext): string[] {
  if (!args.length) return ['\x1b[31mmkdir: missing operand\x1b[0m']
  if (!ctx.mutableFs) {
    return [`\x1b[90m(simulated: mkdir ${args.join(' ')})\x1b[0m`]
  }

  const recursive = flags(args).includes('p')
  const lines: string[] = []
  for (const target of nonFlags(args)) {
    const path = resolvePath(ctx.cwd, target)
    const result = applyMutation(ctx.mutableFs, { kind: 'mkdir', path, recursive })
    if (!result.success && result.error) {
      lines.push(`\x1b[31m${result.error}\x1b[0m`)
    }
  }
  return lines
}

function cmdRm(args: string[], ctx: CommandContext): string[] {
  if (!args.length) return ['\x1b[31mrm: missing operand\x1b[0m']
  if (!ctx.mutableFs) {
    return [`\x1b[90m(simulated: rm ${args.join(' ')})\x1b[0m`]
  }

  const fl = flags(args)
  const recursive = fl.includes('r') || fl.includes('R')
  const lines: string[] = []
  for (const target of nonFlags(args)) {
    const path = resolvePath(ctx.cwd, target)
    const result = applyMutation(ctx.mutableFs, { kind: 'rm', path, recursive })
    if (!result.success && result.error) {
      lines.push(`\x1b[31m${result.error}\x1b[0m`)
    }
  }
  return lines
}

function cmdMv(args: string[], ctx: CommandContext): string[] {
  const positional = nonFlags(args)
  if (positional.length < 2) return ['\x1b[31mmv: missing source or destination\x1b[0m']
  if (!ctx.mutableFs) {
    return [`\x1b[90m(simulated: mv ${args.join(' ')})\x1b[0m`]
  }

  const from = resolvePath(ctx.cwd, positional[0])
  const to = resolvePath(ctx.cwd, positional[1])
  const result = applyMutation(ctx.mutableFs, { kind: 'mv', from, to })
  if (!result.success && result.error) {
    return [`\x1b[31m${result.error}\x1b[0m`]
  }
  return []
}

function cmdChmod(args: string[], ctx: CommandContext): string[] {
  if (args.length < 2) return ['\x1b[31mchmod: missing operand\x1b[0m']

  const [mode, target] = args
  if (!ctx.mutableFs) {
    return [`\x1b[32m✓ chmod ${args.join(' ')} \x1b[90m(simulated)\x1b[0m`]
  }

  const path = resolvePath(ctx.cwd, target)
  const result = applyMutation(ctx.mutableFs, { kind: 'chmod', path, perms: mode })
  if (!result.success && result.error) {
    return [`\x1b[31m${result.error}\x1b[0m`]
  }
  return [`\x1b[32m✓ chmod ${mode} ${target}\x1b[0m`]
}

function cmdEcho(args: string[], ctx: CommandContext): string[] {
  const redirIdx = args.findIndex(a => a === '>' || a === '>>')

  if (redirIdx < 0) {
    return [args.join(' ')]
  }

  if (!ctx.mutableFs) {
    return [`\x1b[90m(simulated: echo ${args.slice(0, redirIdx).join(' ')} ${args[redirIdx]} ${args[redirIdx + 1] ?? ''})\x1b[0m`]
  }

  const text = args.slice(0, redirIdx).map(stripQuotes).join(' ')
  const append = args[redirIdx] === '>>'
  const target = args[redirIdx + 1]
  if (!target) return ['\x1b[31mecho: missing redirect target\x1b[0m']

  const path = resolvePath(ctx.cwd, target)
  const result = applyMutation(ctx.mutableFs, { kind: 'write', path, content: text + '\n', append })
  if (!result.success && result.error) {
    return [`\x1b[31m${result.error}\x1b[0m`]
  }
  return []
}

// ─── Command Implementations ──────────────────────────────────────────────────

function cmdHelp(): string[] {
  return [
    '\x1b[1;32m┌── BREACH LAB — COMMANDS ─────────────────────────────────────┐\x1b[0m',
    '\x1b[32m│\x1b[0m \x1b[1mFILE\x1b[0m    ls [-la]  cd  pwd  cat  find  stat  file  tree',
    '\x1b[32m│\x1b[0m \x1b[1mTEXT\x1b[0m    grep  awk  sed  wc  head  tail  sort  uniq  strings',
    '\x1b[32m│\x1b[0m \x1b[1mSYSTEM\x1b[0m  whoami  id  uname  ps  top  env  history  crontab',
    '\x1b[32m│\x1b[0m \x1b[1mPERMS\x1b[0m   chmod  sudo -l  find -perm -4000',
    '\x1b[32m│\x1b[0m \x1b[1mMUTATE\x1b[0m  touch  mkdir  rm  mv  echo "text" > file',
    '\x1b[32m│\x1b[0m \x1b[1mNET\x1b[0m     ifconfig  netstat  ss  ping  curl',
    '\x1b[32m│\x1b[0m \x1b[1mDECODE\x1b[0m  xxd  base64  file  strings',
    '\x1b[32m│\x1b[0m \x1b[1mOTHER\x1b[0m   man  which  bash  python3  submit <FLAG>  clear',
    '\x1b[32m│\x1b[0m',
    '\x1b[32m│\x1b[0m \x1b[1;33mSECURITY TOOLS (simulated)\x1b[0m',
    '\x1b[32m│\x1b[0m \x1b[33mSCAN\x1b[0m    nmap  nikto  nuclei  wpscan',
    '\x1b[32m│\x1b[0m \x1b[33mWEB\x1b[0m     sqlmap  gobuster  dirb  wfuzz',
    '\x1b[32m│\x1b[0m \x1b[33mRECON\x1b[0m   amass  sublist3r  recon-ng  enum4linux',
    '\x1b[32m│\x1b[0m \x1b[33mATTACK\x1b[0m  hydra  responder  nc  tcpdump',
    '\x1b[32m│\x1b[0m \x1b[33mPASS\x1b[0m    hashcat  john  aircrack-ng',
    '\x1b[32m│\x1b[0m \x1b[33mOTHER\x1b[0m   msfconsole  msfvenom  ssh  ftp',
    '\x1b[1;32m└──────────────────────────────────────────────────────────────┘\x1b[0m',
    '\x1b[90mPipe support: cat log.txt | grep "ERROR" | wc -l\x1b[0m',
  ]
}

function cmdUname(args: string[]): string[] {
  if (args.includes('-a')) return ['Linux breach-lab 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux']
  if (args.includes('-r')) return ['5.15.0-91-generic']
  if (args.includes('-s')) return ['Linux']
  return ['Linux']
}

function cmdEnv(ctx: CommandContext): string[] {
  return [
    'HOME=/home/operator',
    'USER=operator',
    'SHELL=/bin/bash',
    `PWD=${ctx.cwd}`,
    'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    'TERM=xterm-256color',
    'LANG=en_US.UTF-8',
  ]
}

function cmdLs(args: string[], ctx: CommandContext): string[] {
  const fl     = flags(args)
  const target = nonFlags(args)[0] ?? '.'
  const path   = resolvePath(ctx.cwd, target)
  const node   = getCtxNode(ctx, path)

  if (!node) return [`\x1b[31mls: '${target}': No such file or directory\x1b[0m`]
  if (node.type === 'file') return [colorEntry(basename(path), node)]

  const showHidden = fl.includes('a') || fl.includes('A')
  const entries = Object.entries(node.children)
    .filter(([name]) => showHidden || !name.startsWith('.'))
    .sort(([a], [b]) => a.localeCompare(b))

  if (!fl.includes('l')) {
    return [entries.map(([name, child]) => colorEntry(name, child)).join('  ') || '(empty)']
  }

  const lines: string[] = [`total ${entries.length + (showHidden ? 2 : 0)}`]
  if (showHidden) {
    lines.push(`drwxr-xr-x 2 operator operator   4096 Jan 15 \x1b[1;34m.\x1b[0m`)
    lines.push(`drwxr-xr-x 5 operator operator   4096 Jan 15 \x1b[1;34m..\x1b[0m`)
  }
  for (const [name, child] of entries) {
    const size = child.type === 'file' ? String(child.content.length).padStart(6) : '  4096'
    lines.push(`${child.perms} 1 operator operator ${size} Jan 15 ${colorEntry(name, child)}`)
  }
  return lines
}

function cmdCd(args: string[], ctx: CommandContext): string[] {
  const target = args[0] ?? '/home/operator'
  const path   = resolvePath(ctx.cwd, target)
  const node   = getCtxNode(ctx, path)

  if (!node)              return [`\x1b[31mcd: '${target}': No such file or directory\x1b[0m`]
  if (node.type !== 'dir') return [`\x1b[31mcd: '${target}': Not a directory\x1b[0m`]

  ctx.setCwd(path)
  return []
}

function cmdCat(args: string[], ctx: CommandContext): string[] {
  const targets = nonFlags(args)
  if (!targets.length) return ['\x1b[90m(awaiting stdin — Ctrl+C)\x1b[0m']

  return targets.flatMap(target => {
    const node = resolve(ctx, target)
    if (!node)              return [`\x1b[31mcat: ${target}: No such file or directory\x1b[0m`]
    if (node.type === 'dir') return [`\x1b[31mcat: ${target}: Is a directory\x1b[0m`]
    return node.content.split('\n')
  })
}

function cmdGrep(args: string[], ctx: CommandContext, stdin: string): string[] {
  const fl   = flags(args)
  const nf   = nonFlags(args)
  if (!nf.length) return ['\x1b[31mgrep: missing pattern\x1b[0m']

  const [pattern, file] = nf
  const re = new RegExp(pattern, fl.includes('i') ? 'i' : '')

  let lines: string[]
  if (file) {
    const node = resolve(ctx, file)
    if (!node || node.type !== 'file') return [`\x1b[31mgrep: ${file}: No such file or directory\x1b[0m`]
    lines = node.content.split('\n')
  } else {
    lines = stdin.split('\n')
  }

  const matches = lines
    .map((line, idx) => ({ line, idx: idx + 1 }))
    .filter(({ line }) => fl.includes('v') ? !re.test(line) : re.test(line))

  if (fl.includes('c')) return [String(matches.length)]

  return matches.map(({ line, idx }) => {
      const highlighted = line.replace(re, m => `\x1b[1;31m${m}\x1b[0m`)
      return fl.includes('n') ? `\x1b[32m${idx}\x1b[0m:${highlighted}` : highlighted
    })
}

function cmdFind(args: string[], ctx: CommandContext): string[] {
  const nameIdx = args.indexOf('-name')
  const typeIdx = args.indexOf('-type')
  const permIdx = args.indexOf('-perm')
  const namePat = nameIdx >= 0 ? args[nameIdx + 1] : null
  const typePat = typeIdx >= 0 ? args[typeIdx + 1] : null
  const permPat = permIdx >= 0 ? args[permIdx + 1] : null
  const knownValues = new Set([namePat, typePat, permPat].filter(Boolean))

  const rootTarget = args.find(a => !a.startsWith('-') && !knownValues.has(a)) ?? '.'
  const startPath  = resolvePath(ctx.cwd, rootTarget)
  const startNode  = getCtxNode(ctx, startPath)

  if (!startNode) return [`\x1b[31mfind: '${rootTarget}': No such file or directory\x1b[0m`]

  const results: string[] = []

  function walk(node: FSNode, path: string): void {
    const name = basename(path)
    let matches = true

    if (namePat) {
      const re = new RegExp('^' + namePat.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
      if (!re.test(name)) matches = false
    }
    if (typePat === 'f' && node.type !== 'file') matches = false
    if (typePat === 'd' && node.type !== 'dir')  matches = false
    if (permPat === '-4000' && !node.perms.includes('s')) matches = false

    if (matches) results.push(path)

    if (node.type === 'dir') {
      for (const [childName, childNode] of Object.entries(node.children)) {
        walk(childNode, `${path === '/' ? '' : path}/${childName}`)
      }
    }
  }

  walk(startNode, startPath)
  return results
}

function cmdTree(ctx: CommandContext): string[] {
  const lines = [ctx.cwd]

  function walk(node: FSNode, prefix: string): void {
    if (node.type !== 'dir') return
    const entries = Object.entries(node.children)
    entries.forEach(([name, child], i) => {
      const isLast    = i === entries.length - 1
      const connector = isLast ? '└── ' : '├── '
      const extension = isLast ? '    ' : '│   '
      lines.push(`${prefix}${connector}${colorEntry(name, child)}`)
      walk(child, prefix + extension)
    })
  }

  const node = getCtxNode(ctx, ctx.cwd)
  if (node?.type === 'dir') walk(node, '')
  return lines
}

function cmdWc(args: string[], ctx: CommandContext, stdin: string): string[] {
  const fl   = flags(args)
  const file = nonFlags(args)[0]
  let content = stdin

  if (file) {
    const node = resolve(ctx, file)
    if (!node || node.type !== 'file') return [`\x1b[31mwc: ${file}: No such file or directory\x1b[0m`]
    content = node.content
  }

  const lineCount = content.split('\n').length
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  const charCount = content.length

  if (fl.includes('l')) return [String(lineCount)]
  if (fl.includes('w')) return [String(wordCount)]
  if (fl.includes('c')) return [String(charCount)]
  return [`${String(lineCount).padStart(4)} ${String(wordCount).padStart(6)} ${String(charCount).padStart(7)} ${file ?? ''}`]
}

function cmdSlice(args: string[], ctx: CommandContext, stdin: string, mode: 'head' | 'tail'): string[] {
  const nIdx  = args.indexOf('-n')
  const count = nIdx >= 0 ? parseInt(args[nIdx + 1] ?? '10') : 10
  const file  = nonFlags(args)[0]

  let lines: string[]
  if (file) {
    const node = resolve(ctx, file)
    if (!node || node.type !== 'file') return [`\x1b[31m${mode}: ${file}: No such file or directory\x1b[0m`]
    lines = node.content.split('\n')
  } else {
    lines = stdin.split('\n')
  }

  return mode === 'head' ? lines.slice(0, count) : lines.slice(-count)
}

function cmdSort(args: string[], stdin: string): string[] {
  const numeric = flags(args).includes('n')
  return [...stdin.split('\n').filter(Boolean)].sort((a, b) =>
    numeric ? parseFloat(a) - parseFloat(b) : a.localeCompare(b)
  )
}

function cmdAwk(args: string[], ctx: CommandContext, stdin: string): string[] {
  const nf = nonFlags(args)
  const program = nf[0] ?? ''
  const file = nf[1]
  let input = stdin

  if (file) {
    const node = resolve(ctx, file)
    if (!node || node.type !== 'file') return [`\x1b[31mawk: ${file}: No such file or directory\x1b[0m`]
    input = node.content
  }

  const lines = input.split('\n').filter(Boolean)

  if (program.includes('END') && program.includes('NR')) {
    return [String(lines.length)]
  }

  if (program.includes('sum') && program.includes('END')) {
    const sum = lines.reduce((acc, l) => acc + (parseFloat(l.trim().split(/\s+/)[0]) || 0), 0)
    return [String(sum)]
  }

  const printMatch = program.match(/\{print\s+\$(\d+)\}/)
  if (printMatch) {
    const col = parseInt(printMatch[1]) - 1
    return lines.map(l => l.trim().split(/\s+/)[col] ?? '')
  }

  return lines
}

function cmdSed(args: string[], stdin: string): string[] {
  const expr  = nonFlags(args)[0] ?? ''
  const match = expr.match(/^s\/(.+?)\/(.+?)\/([gi]*)$/)
  if (!match) return ['\x1b[31msed: invalid expression. Example: s/old/new/g\x1b[0m']
  const re = new RegExp(match[1], match[3])
  return stdin.split('\n').map(l => l.replace(re, match[2]))
}

function cmdStrings(args: string[], ctx: CommandContext): string[] {
  const file = args[0]
  if (!file) return ['\x1b[31mstrings: missing file argument\x1b[0m']
  const node = resolve(ctx, file)
  if (!node || node.type !== 'file') return [`\x1b[31mstrings: ${file}: No such file or directory\x1b[0m`]
  return node.content.split('\n').filter(l => l.trim().length >= 4)
}

function cmdXxd(args: string[], ctx: CommandContext): string[] {
  const file = args[0]
  if (!file) return ['\x1b[31mxxd: missing file argument\x1b[0m']
  const node = resolve(ctx, file)
  if (!node || node.type !== 'file') return [`\x1b[31mxxd: ${file}: No such file or directory\x1b[0m`]

  const bytes = node.content.slice(0, 128)
  const lines: string[] = []
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk  = bytes.slice(i, i + 16)
    const hex    = Array.from(chunk).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')
    const ascii  = Array.from(chunk).map(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127 ? c : '.').join('')
    lines.push(`${i.toString(16).padStart(8, '0')}: ${hex.padEnd(47)}  ${ascii}`)
  }
  return lines
}

function cmdBase64(args: string[], stdin: string): string[] {
  try {
    if (args.includes('-d') || args.includes('--decode')) {
      return [atob(stdin.trim().replace(/\s/g, ''))]
    }
    return [btoa(stdin.trim())]
  } catch {
    return ['\x1b[31mbase64: invalid input\x1b[0m']
  }
}

function cmdFile(args: string[], ctx: CommandContext): string[] {
  return args.map(target => {
    const node = resolve(ctx, target)
    if (!node) return `${target}: No such file or directory`
    if (node.type === 'dir') return `${target}: directory`
    if (target.endsWith('.sh'))  return `${target}: Bourne-Again shell script, ASCII text executable`
    if (target.endsWith('.py'))  return `${target}: Python script, ASCII text executable`
    if (target.endsWith('.txt')) return `${target}: ASCII text`
    return `${target}: regular file`
  })
}

function cmdStat(args: string[], ctx: CommandContext): string[] {
  const target = args[0]
  if (!target) return ['\x1b[31mstat: missing file argument\x1b[0m']
  const node = resolve(ctx, target)
  if (!node) return [`\x1b[31mstat: '${target}': No such file or directory\x1b[0m`]
  return [
    `  File: ${target}`,
    `  Size: ${node.type === 'file' ? node.content.length : 4096}`,
    `  Type: ${node.type === 'dir' ? 'directory' : 'regular file'}`,
    `Access: ${node.perms}`,
    `Modify: 2024-01-15 08:00:00.000000000 +0300`,
  ]
}

// Session-stable seed + boot timestamp. Varies per page load, stable
// within session. Used to give deeper-simulation handlers plausibly
// varying output without breaking determinism within a single command.
const SESSION_SEED = Date.now() & 0xffff
const SESSION_BOOT = Date.now()
let dynamicCallCounter = 0
function nextDyn(): number {
  dynamicCallCounter = (dynamicCallCounter + 1) & 0xffff
  return (SESSION_SEED ^ dynamicCallCounter) & 0xffff
}
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function cmdPs(args: string[]): string[] {
  const all = args.some(a => a.includes('a'))
  // Stable session bash PID, varying ps PID per call
  const bashPid = 1024 + (SESSION_SEED % 4000)
  const psPid = bashPid + 200 + (nextDyn() % 800)
  if (!all) return [
    '  PID TTY      STAT   TIME CMD',
    ` ${String(bashPid).padStart(4)} pts/0    Ss     0:00 bash`,
    ` ${String(psPid).padStart(4)} pts/0    R+     0:00 ps`,
  ]
  const initPid = 1
  const sshdPid = 200 + (SESSION_SEED % 80)
  const nginxPid = sshdPid + 220 + (SESSION_SEED % 90)
  const mysqlPid = nginxPid + 320 + (SESSION_SEED % 70)
  return [
    'USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
    `root      ${String(initPid).padStart(4)}  0.0  0.1 169032  9456 ?        Ss   Jan15  0:12 /sbin/init`,
    `root      ${String(sshdPid).padStart(4)}  0.0  0.0  72128  3204 ?        Ss   Jan15  0:00 sshd: [listener]`,
    `www-data  ${String(nginxPid).padStart(4)}  0.1  0.2  62492 12108 ?        S    Jan15  0:14 nginx: worker process`,
    `mysql     ${String(mysqlPid).padStart(4)}  0.3  1.5 1432836 124016 ?     Sl   Jan15  3:42 /usr/sbin/mysqld`,
    `operator  ${String(bashPid).padStart(4)}  0.0  0.1  21192  4708 pts/0    Ss   Jan15  0:00 bash`,
    `operator  ${String(psPid).padStart(4)}  0.0  0.0  10632  3320 pts/0    R+   12:04  0:00 ps aux`,
  ]
}

function cmdDate(args: string[]): string[] {
  const now = new Date()
  if (args.includes('-u') || args.includes('--utc')) {
    return [now.toUTCString()]
  }
  if (args.includes('+%s')) {
    return [String(Math.floor(now.getTime() / 1000))]
  }
  if (args.includes('-I') || args.includes('--iso-8601')) {
    return [now.toISOString().slice(0, 10)]
  }
  return [now.toString()]
}

function cmdUptime(args: string[]): string[] {
  const minutesSinceLoad = Math.floor((Date.now() - SESSION_BOOT) / 60000)
  const days = 3 + Math.floor(minutesSinceLoad / 1440)
  const hours = (4 + Math.floor(minutesSinceLoad / 60)) % 24
  const mins = (22 + minutesSinceLoad) % 60
  const now = new Date()
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
  if (args.includes('-p')) return [`up ${days} days, ${hours} hours, ${mins} minutes`]
  return [` ${time} up ${days} days, ${pad2(hours)}:${pad2(mins)},  1 user,  load average: 0.08, 0.05, 0.01`]
}

function cmdDu(args: string[], ctx: CommandContext): string[] {
  const fl = flags(args)
  const summary = fl.includes('s')
  const target = nonFlags(args)[0] ?? '.'
  const path = resolvePath(ctx.cwd, target)
  const node = getCtxNode(ctx, path)
  if (!node) return [`\x1b[31mdu: cannot access '${target}': No such file or directory\x1b[0m`]
  // Deterministic but varying size per path
  const sizeForNode = (n: FSNode, depth: number): number => {
    if (n.type === 'file') return Math.max(1, n.content.length / 1024)
    let total = 4
    for (const c of Object.values(n.children)) total += sizeForNode(c, depth + 1)
    return total
  }
  const formatK = (k: number) => {
    const m = k / 1024
    return m >= 1 ? `${m.toFixed(1)}M` : `${Math.ceil(k)}K`
  }
  if (summary) return [`${formatK(sizeForNode(node, 0)).padEnd(8)}${target}`]
  // Non-summary: list direct children
  if (node.type !== 'dir') return [`${formatK(sizeForNode(node, 0)).padEnd(8)}${target}`]
  const lines: string[] = []
  for (const [name, child] of Object.entries(node.children)) {
    lines.push(`${formatK(sizeForNode(child, 1)).padEnd(8)}${target.replace(/\/$/, '')}/${name}`)
  }
  lines.push(`${formatK(sizeForNode(node, 0)).padEnd(8)}${target}`)
  return lines
}

function cmdDf(args: string[]): string[] {
  const human = args.includes('-h') || args.includes('--human-readable')
  const inodes = args.includes('-i')
  // Slight variation per call to feel alive
  const rootUsed = 14 + (nextDyn() % 4) / 10
  const homeUsed = 28 + (nextDyn() % 6) / 10
  const tmpUsed = 1 + (nextDyn() % 3) / 10
  const fmt = (totalG: number, usedG: number) => {
    const total = `${totalG}G`
    const used = `${usedG.toFixed(1)}G`
    const avail = `${(totalG - usedG).toFixed(1)}G`
    const pct = `${Math.round((usedG / totalG) * 100)}%`
    return human ? { total, used, avail, pct } : {
      total: String(totalG * 1024 * 1024),
      used: String(Math.round(usedG * 1024 * 1024)),
      avail: String(Math.round((totalG - usedG) * 1024 * 1024)),
      pct,
    }
  }
  if (inodes) {
    return [
      'Filesystem     Inodes  IUsed  IFree IUse% Mounted on',
      '/dev/sda1      655360  82391 572969   13% /',
      '/dev/sda2     1310720  98214 1212506   8% /home',
      'tmpfs          512000   1024  510976    1% /tmp',
    ]
  }
  const root = fmt(40, rootUsed)
  const home = fmt(80, homeUsed)
  const tmp = fmt(4, tmpUsed)
  return [
    `Filesystem      ${human ? 'Size' : '1K-blocks'}      Used Available Use% Mounted on`,
    `/dev/sda1       ${root.total.padStart(8)} ${root.used.padStart(8)} ${root.avail.padStart(9)} ${root.pct.padStart(4)} /`,
    `/dev/sda2       ${home.total.padStart(8)} ${home.used.padStart(8)} ${home.avail.padStart(9)} ${home.pct.padStart(4)} /home`,
    `tmpfs           ${tmp.total.padStart(8)} ${tmp.used.padStart(8)} ${tmp.avail.padStart(9)} ${tmp.pct.padStart(4)} /tmp`,
  ]
}

function cmdFree(args: string[]): string[] {
  const human = args.includes('-h')
  const mb = args.includes('-m')
  const totalKb = 4 * 1024 * 1024 // 4 GB
  const usedKb = Math.floor(totalKb * (0.55 + (nextDyn() % 100) / 1000))
  const freeKb = totalKb - usedKb
  const cacheKb = Math.floor(totalKb * 0.18)
  const swapTotalKb = 2 * 1024 * 1024
  const swapUsedKb = Math.floor(swapTotalKb * (0.05 + (nextDyn() % 30) / 1000))
  const fmt = (kb: number) => {
    if (human) {
      const mb = kb / 1024
      return mb >= 1024 ? `${(mb / 1024).toFixed(1)}Gi` : `${Math.round(mb)}Mi`
    }
    if (mb) return String(Math.round(kb / 1024))
    return String(kb)
  }
  return [
    '              total        used        free      shared  buff/cache   available',
    `Mem:    ${fmt(totalKb).padStart(11)} ${fmt(usedKb).padStart(11)} ${fmt(freeKb).padStart(11)} ${fmt(0).padStart(11)} ${fmt(cacheKb).padStart(11)} ${fmt(freeKb + cacheKb).padStart(11)}`,
    `Swap:   ${fmt(swapTotalKb).padStart(11)} ${fmt(swapUsedKb).padStart(11)} ${fmt(swapTotalKb - swapUsedKb).padStart(11)}`,
  ]
}

function cmdVmstat(_args: string[]): string[] {
  return [
    'procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----',
    ' r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st',
    ` 1  0  124k 1.4G  84M  720M    0    0     8    21  104  328  2  1 97  0  0`,
    ` 0  0  124k 1.4G  84M  720M    0    0     0    32   98  301  1  0 99  0  0`,
    ` 1  0  124k 1.4G  84M  720M    0    0     0    18  112  342  3  1 96  0  0`,
  ]
}

function cmdIostat(args: string[]): string[] {
  const extended = args.includes('-x')
  const out: string[] = [
    'Linux 5.15.0-91-generic (breach-lab) 	' + new Date().toLocaleDateString('en-CA') + ' 	_x86_64_	(4 CPU)',
    '',
    'avg-cpu:  %user   %nice %system %iowait  %steal   %idle',
    '           2.10    0.05    0.83    0.04    0.00   96.98',
    '',
  ]
  if (extended) {
    out.push(
      'Device            r/s     w/s     rkB/s     wkB/s   rrqm/s   wrqm/s  %rrqm  %wrqm r_await w_await aqu-sz rareq-sz wareq-sz  svctm  %util',
      'sda              2.41    8.92     48.20    142.80     0.10     0.42   3.99   4.50    0.42    1.21   0.01    20.0     16.0   0.18   0.21',
    )
  } else {
    out.push(
      'Device             tps    kB_read/s    kB_wrtn/s    kB_dscd/s    kB_read    kB_wrtn    kB_dscd',
      'sda              11.33        48.20       142.80         0.00     412345     921384          0',
    )
  }
  return out
}

function cmdLsof(args: string[]): string[] {
  const portArg = args.find(a => a.startsWith(':')) ?? args[args.indexOf('-i') + 1]
  if (portArg && portArg.startsWith(':')) {
    const port = portArg.slice(1)
    return [
      'COMMAND   PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
      `nginx     ${438 + (SESSION_SEED % 60)} www-data    6u  IPv4  18234      0t0  TCP *:${port} (LISTEN)`,
    ]
  }
  return [
    'COMMAND      PID     USER   FD   TYPE DEVICE SIZE/OFF      NODE NAME',
    'systemd       1     root  cwd    DIR    8,1     4096         2 /',
    'systemd       1     root  txt    REG    8,1  1620224      4203 /usr/lib/systemd/systemd',
    'sshd        287     root    3u  IPv4    18234      0t0     TCP *:22 (LISTEN)',
    'mysqld      829    mysql   16u  IPv4    19481      0t0     TCP 127.0.0.1:3306 (LISTEN)',
    'nginx       488 www-data    6u  IPv4    21002      0t0     TCP *:80 (LISTEN)',
    'bash       1024 operator  cwd    DIR    8,1     4096   1310912 /home/operator',
  ]
}

function cmdMount(_args: string[]): string[] {
  return [
    'sysfs on /sys type sysfs (rw,nosuid,nodev,noexec,relatime)',
    'proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)',
    'udev on /dev type devtmpfs (rw,nosuid,relatime,size=2018284k)',
    'devpts on /dev/pts type devpts (rw,nosuid,noexec,relatime,gid=5,mode=620)',
    '/dev/sda1 on / type ext4 (rw,relatime,errors=remount-ro)',
    '/dev/sda2 on /home type ext4 (rw,relatime)',
    'tmpfs on /tmp type tmpfs (rw,nosuid,nodev,relatime,size=512000k)',
    'tmpfs on /run type tmpfs (rw,nosuid,nodev,noexec,relatime,size=403656k,mode=755)',
  ]
}

function cmdWho(_args: string[]): string[] {
  const now = new Date()
  const t = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  return [
    `operator pts/0        ${now.toLocaleDateString('en-CA')} ${t} (10.0.2.2)`,
    `root     pts/1        ${now.toLocaleDateString('en-CA')} 08:00 (192.168.1.1)`,
  ]
}

function cmdW(_args: string[]): string[] {
  const now = new Date()
  const t = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
  return [
    ` ${t} up 3 days, 4:22,  2 users,  load average: 0.08, 0.05, 0.01`,
    'USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT',
    `operator pts/0    10.0.2.2         ${pad2(now.getHours())}:00    0.00s  0.21s  0.04s bash`,
    'root     pts/1    192.168.1.1      08:00    1:42m  0.32s  0.05s -bash',
  ]
}

function cmdLast(args: string[]): string[] {
  const nIdx = args.indexOf('-n')
  const limit = nIdx >= 0 ? Math.max(1, parseInt(args[nIdx + 1] ?? '10', 10) || 10) : 10
  const sessions = [
    'operator pts/0        10.0.2.2         Jan 15 08:00   still logged in',
    'operator pts/0        10.0.2.2         Jan 14 21:14 - 22:43  (01:29)',
    'root     pts/1        192.168.1.1      Jan 14 19:02 - 19:55  (00:53)',
    'operator pts/0        10.0.2.2         Jan 14 16:22 - 18:45  (02:23)',
    'reboot   system boot  5.15.0-91-generic Jan 14 16:00   still running',
    'operator pts/0        10.0.2.2         Jan 13 09:11 - 14:32  (05:21)',
    'root     pts/1        192.168.1.1      Jan 13 08:30 - 09:01  (00:31)',
    'operator pts/0        10.0.2.2         Jan 12 14:18 - 18:00  (03:42)',
    'reboot   system boot  5.15.0-91-generic Jan 12 14:00   still running',
    'operator pts/0        10.0.2.2         Jan 11 10:00 - 12:30  (02:30)',
  ]
  const out = sessions.slice(0, limit)
  out.push('', 'wtmp begins Jan 11 10:00:00 2024')
  return out
}

function cmdIp(args: string[]): string[] {
  const sub = args[0]
  if (sub === 'route' || sub === 'r') return cmdRoute(args.slice(1))
  if (sub === 'addr' || sub === 'a' || sub === 'link' || sub === 'l') return cmdIfconfig([])
  if (sub === '-h' || sub === '--help' || !sub) {
    return [
      'Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }',
      'where  OBJECT := { addr | route | link | rule | neigh }',
    ]
  }
  return cmdIfconfig(args)
}

function cmdRoute(args: string[]): string[] {
  const numeric = args.includes('-n') || args.includes('-rn')
  return [
    `Kernel IP routing table${numeric ? '' : ' (resolving names)'}`,
    'Destination     Gateway         Genmask         Flags Metric Ref    Use Iface',
    `0.0.0.0         10.0.2.2        0.0.0.0         UG    100    0        0 eth0`,
    `10.0.2.0        0.0.0.0         255.255.255.0   U     100    0        0 eth0`,
    `169.254.0.0     0.0.0.0         255.255.0.0     U     1000   0        0 eth0`,
  ]
}

function cmdArp(args: string[]): string[] {
  const numeric = args.includes('-n')
  const all = args.includes('-a')
  if (all) {
    return [
      `_gateway (10.0.2.2) at 52:54:00:12:35:02 [ether] on eth0`,
      `? (10.0.2.3) at 52:54:00:12:35:03 [ether] on eth0`,
      `breach-lab (10.0.2.15) at 08:00:27:ab:cd:ef [ether] on eth0`,
    ]
  }
  return [
    'Address                  HWtype  HWaddress           Flags Mask            Iface',
    `${numeric ? '10.0.2.2' : '_gateway'.padEnd(24)} ether   52:54:00:12:35:02   C                     eth0`,
    `${numeric ? '10.0.2.3' : '?'.padEnd(24)} ether   52:54:00:12:35:03   C                     eth0`,
  ]
}

function cmdTraceroute(args: string[]): string[] {
  const target = args.find(a => !a.startsWith('-')) ?? 'example.com'
  const targetIp = /^\d/.test(target) ? target : '93.184.216.34'
  return [
    `traceroute to ${target} (${targetIp}), 30 hops max, 60 byte packets`,
    ` 1  _gateway (10.0.2.2)  0.241 ms  0.214 ms  0.198 ms`,
    ` 2  192.168.1.1 (192.168.1.1)  1.812 ms  1.792 ms  1.770 ms`,
    ` 3  10.0.0.1 (10.0.0.1)  4.124 ms  4.103 ms  4.082 ms`,
    ` 4  isp-edge-rtr-01.net (203.0.113.1)  12.481 ms  12.412 ms  12.391 ms`,
    ` 5  100.64.0.1 (100.64.0.1)  18.224 ms  18.190 ms  18.179 ms`,
    ` 6  ${target} (${targetIp})  19.014 ms  18.992 ms  18.974 ms`,
  ]
}

function cmdDig(args: string[]): string[] {
  const domain = args.find(a => !a.startsWith('-') && a.includes('.')) ?? 'example.com'
  const types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA']
  const requestedType = args.find(a => types.includes(a.toUpperCase()))?.toUpperCase() ?? 'A'
  const now = new Date().toUTCString().slice(0, -4)

  const sectionFor = (type: string): string[] => {
    if (type === 'A') return [`${domain}.\t\t300\tIN\tA\t93.184.216.34`]
    if (type === 'AAAA') return [`${domain}.\t\t300\tIN\tAAAA\t2606:2800:220:1:248:1893:25c8:1946`]
    if (type === 'MX') return [
      `${domain}.\t\t3600\tIN\tMX\t10 mail.${domain}.`,
      `${domain}.\t\t3600\tIN\tMX\t20 backup-mail.${domain}.`,
    ]
    if (type === 'NS') return [
      `${domain}.\t\t86400\tIN\tNS\tns1.${domain}.`,
      `${domain}.\t\t86400\tIN\tNS\tns2.${domain}.`,
    ]
    if (type === 'TXT') return [`${domain}.\t\t300\tIN\tTXT\t"v=spf1 include:_spf.example.com ~all"`]
    if (type === 'CNAME') return [`www.${domain}.\t300\tIN\tCNAME\t${domain}.`]
    return [`${domain}.\t\t3600\tIN\tSOA\tns1.${domain}. admin.${domain}. 2024011501 7200 3600 1209600 300`]
  }

  return [
    '',
    '; <<>> DiG 9.18.24 <<>> ' + (requestedType !== 'A' ? `${domain} ${requestedType}` : domain),
    ';; global options: +cmd',
    ';; Got answer:',
    ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: ' + (10000 + (nextDyn() % 50000)),
    ';; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 0',
    '',
    ';; QUESTION SECTION:',
    `;${domain}.\t\t\tIN\t${requestedType}`,
    '',
    ';; ANSWER SECTION:',
    ...sectionFor(requestedType),
    '',
    ';; Query time: ' + (12 + (nextDyn() % 30)) + ' msec',
    ';; SERVER: 10.0.2.2#53(10.0.2.2)',
    `;; WHEN: ${now}+0000`,
    ';; MSG SIZE  rcvd: 56',
    '',
  ]
}

function cmdNslookup(args: string[]): string[] {
  const domain = args.find(a => !a.startsWith('-') && a.includes('.')) ?? 'example.com'
  return [
    `Server:		10.0.2.2`,
    `Address:	10.0.2.2#53`,
    '',
    'Non-authoritative answer:',
    `Name:	${domain}`,
    `Address: 93.184.216.34`,
    `Name:	${domain}`,
    `Address: 2606:2800:220:1:248:1893:25c8:1946`,
  ]
}

function cmdTop(): string[] {
  return [
    `\x1b[1mtop\x1b[0m - ${new Date().toTimeString().slice(0, 8)} up 3 days, load avg: 0.08, 0.05, 0.01`,
    'Tasks:  98 total,   1 running,  97 sleeping',
    '\x1b[32m%Cpu(s):\x1b[0m  2.1 us, 0.5 sy, 0.0 ni, 97.1 id',
    '\x1b[32mMiB Mem:\x1b[0m  4096 total, 2048 free, 1024 used',
    '',
    '  PID USER     %CPU %MEM COMMAND',
    '    1 root      0.0  0.1 systemd',
    '  234 root      0.0  0.0 sshd',
    '  789 mysql     0.3  1.5 mysqld',
    ' 1234 operator  0.1  0.1 bash',
    '\x1b[90m(press q to quit — simulated)\x1b[0m',
  ]
}

function cmdIfconfig(args: string[]): string[] {
  const iface = args.find(a => !a.startsWith('-')) ?? null
  const banner = iface
    ? `\x1b[90m[ifconfig ${iface}] interface detail\x1b[0m`
    : `\x1b[90m[ifconfig] all interfaces\x1b[0m`
  const blocks: string[] = [banner, '']
  if (!iface || iface === 'eth0') {
    blocks.push(
      '\x1b[1meth0\x1b[0m: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500',
      '        inet \x1b[32m10.0.2.15\x1b[0m  netmask 255.255.255.0  broadcast 10.0.2.255',
      '        ether 08:00:27:ab:cd:ef  txqueuelen 1000  (Ethernet)',
      '        RX packets 1842  bytes 1423019 (1.4 MB)',
      '        TX packets 1024  bytes  198432 (198 KB)',
    )
  }
  if (!iface) {
    blocks.push('')
  }
  if (!iface || iface === 'lo') {
    blocks.push(
      '\x1b[1mlo\x1b[0m: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536',
      '        inet \x1b[32m127.0.0.1\x1b[0m  netmask 255.0.0.0',
      '        loop  txqueuelen 1000  (Local Loopback)',
    )
  }
  return blocks
}

function cmdNetstat(cmd: string, args: string[]): string[] {
  const fl = flags(args)
  const tcp = fl.includes('t')
  const udp = fl.includes('u')
  const listen = fl.includes('l')
  const filter = [tcp && 'tcp', udp && 'udp', listen && 'listening'].filter(Boolean).join('+') || 'all'
  const lines: string[] = [
    `\x1b[90m[${cmd} ${args.join(' ')}] filter: ${filter}\x1b[0m`,
    '',
    'Proto  Local Address          State',
    'tcp    0.0.0.0:22             LISTEN',
    'tcp    0.0.0.0:80             LISTEN',
    'tcp    0.0.0.0:443            LISTEN',
    'tcp    0.0.0.0:4444           LISTEN   backdoor-agent',
    'tcp    127.0.0.1:3306         LISTEN',
    'tcp    10.0.2.15:22           ESTABLISHED',
  ]
  if (udp || !tcp) {
    lines.push('udp    0.0.0.0:68              -')
  }
  return lines
}

function cmdPing(args: string[]): string[] {
  const host = nonFlags(args)[0] ?? 'localhost'
  return [
    `PING ${host}: 56 data bytes`,
    `64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.432 ms`,
    `64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.318 ms`,
    `64 bytes from ${host}: icmp_seq=3 ttl=64 time=0.295 ms`,
    `3 packets transmitted, 3 received, 0% packet loss`,
  ]
}

function cmdCurl(args: string[]): string[] {
  const url = nonFlags(args)[0] ?? ''
  if (!url) return ['\x1b[31mcurl: missing URL\x1b[0m']
  return [
    `\x1b[90m> GET ${url}\x1b[0m`,
    'HTTP/1.1 200 OK',
    'Content-Type: application/json',
    '{"status":"ok","server":"nginx","message":"pong"}',
  ]
}

function cmdSudo(args: string[], _ctx: CommandContext): string[] {
  if (args[0] === '-l') {
    return [
      'User operator may run the following commands on breach-lab:',
      '    (root) NOPASSWD: /usr/bin/find',
    ]
  }

  if (isSudoFindExecCat(args)) {
    return [
      '\x1b[90m[sudo find]\x1b[0m root context acquired via /usr/bin/find',
      '\x1b[32m[root-read]\x1b[0m payload executed under uid=0',
    ]
  }

  return [
    `\x1b[33m[sudo] password for operator: ****\x1b[0m`,
    `\x1b[32m✓ Command executed: ${args.join(' ')}\x1b[0m`,
  ]
}

function cmdMan(args: string[]): string[] {
  // Optional section number: `man 5 fstab`, `man 1 ls`. Skip leading numeric.
  const filtered = args.filter(a => !/^\d+$/.test(a))
  const target = filtered[0] ?? ''
  if (!target) return ['What manual page do you want?', 'For example, try \'man man\'.']
  const page = getManPage(target)
  if (!page) return [`\x1b[31mNo manual entry for ${target}\x1b[0m`]
  return page
}

function cmdWhich(args: string[]): string[] {
  const bins: Record<string, string> = {
    bash: '/bin/bash', python3: '/usr/bin/python3', grep: '/bin/grep',
    find: '/usr/bin/find', chmod: '/bin/chmod', sudo: '/usr/bin/sudo',
    nmap: '/usr/bin/nmap', curl: '/usr/bin/curl', nc: '/usr/bin/nc',
    netcat: '/usr/bin/nc', xxd: '/usr/bin/xxd',
  }
  return args.map(a => bins[a] ?? `\x1b[31m${a}: not found\x1b[0m`)
}

function cmdBash(args: string[], ctx: CommandContext): string[] {
  if (args[0] === '-c') {
    const script = args.slice(1).join(' ')
    const normalized = script.replace(/^['"]|['"]$/g, '')

    if (normalized.includes('for') && normalized.includes('Port')) {
      const ports: string[] = []
      const portRegex = /\b(\d{2,5})\b/g
      let portMatch = portRegex.exec(normalized)

      while (portMatch) {
        ports.push(portMatch[1])
        portMatch = portRegex.exec(normalized)
      }

      const uniquePorts = Array.from(new Set(ports)).slice(0, 6)
      if (uniquePorts.length) {
        return uniquePorts.map(port => `Port ${port}`)
      }
    }

    return [`\x1b[90m[bash -c]\x1b[0m ${normalized || '(empty command)'}`]
  }

  const file = args[0]
  if (!file) return ['\x1b[31mbash: missing file argument\x1b[0m']
  const node = resolve(ctx, file)
  if (!node || node.type !== 'file') return [`\x1b[31mbash: ${file}: No such file or directory\x1b[0m`]

  return [
    `\x1b[90m[bash ${file}]\x1b[0m`,
    ...node.content
      .split('\n')
      .filter(l => l.startsWith('echo'))
      .map(l => l.replace(/^echo\s+"?/, '').replace(/"$/, '')),
  ]
}

function cmdPython(args: string[], ctx: CommandContext): string[] {
  const file = args[0]
  if (!file) {
    return ['\x1b[90mPython 3.10.12 (simulated REPL)\x1b[0m', '>>> (run python3 <file.py>)']
  }

  // python3 -c "<expr>" — inline expression simulator
  if (file === '-c') {
    const expr = args.slice(1).join(' ').replace(/^['"]|['"]$/g, '')
    const repeat = expr.match(/print\(\s*['"]([^'"]+)['"]\s*\*\s*(\d+)\s*\)/)
    if (repeat) return [repeat[1].repeat(Math.min(parseInt(repeat[2], 10), 200))]
    const literal = expr.match(/print\(\s*['"]([^'"]*)['"]\s*\)/)
    if (literal) return [literal[1]]
    return [`\x1b[90m[python3 -c]\x1b[0m ${expr || '(empty)'}`]
  }

  // Real FS lookup first — preserves blog-fundamentals lessons
  const node = resolve(ctx, file)
  if (node && node.type === 'file') {
    return [
      `\x1b[90m[python3 ${file}]\x1b[0m`,
      ...node.content
        .split('\n')
        .filter(l => l.includes('print('))
        .map(l => {
          const m = l.match(/print\((?:f?["'])(.+?)["']\)/)
          return m ? m[1].replace(/\{.*?\}/g, '[value]') : ''
        })
        .filter(Boolean),
    ]
  }

  // Script not in FS — route well-known security-tool scripts to canned simulators
  const lower = file.toLowerCase()
  const restArgs = args.slice(1)

  if (lower.includes('sublist3r')) return cmdAmass('sublist3r', restArgs)
  if (lower === 'sf.py' || lower.includes('spiderfoot')) {
    const ipPort = flagValue(restArgs, '-l')
    const target = flagValue(restArgs, '-s')
    const type = flagValue(restArgs, '-t')
    const fmt = flagValue(restArgs, '-o')
    if (ipPort) return [
      ...simHeader('SpiderFoot', '4.0'),
      `\x1b[90mWeb UI: http://${ipPort}\x1b[0m`,
      '\x1b[32m[*] Scan engine ready. Open the URL in your browser.\x1b[0m',
      '\x1b[90m200+ data sources available.\x1b[0m',
    ]
    if (target) return [
      ...simHeader('SpiderFoot', '4.0'),
      `\x1b[90mTarget: ${target}  Type: ${type ?? 'DOMAIN'}  Format: ${fmt ?? 'tab'}\x1b[0m`,
      '',
      `[+] mail.${target}        (DNS)`,
      `[+] api.${target}         (DNS)`,
      `[+] admin@${target}        (EMAILADDR)`,
      `[+] support@${target}      (EMAILADDR)`,
      `[+] 198.51.100.42         (IP_ADDRESS)`,
      '',
      '\x1b[90m5 entities discovered.\x1b[0m',
    ]
    return [...simHeader('SpiderFoot', '4.0'), '\x1b[90mUsage: python3 sf.py {-l <ip:port>|-s <target> -t <type>}\x1b[0m']
  }
  if (lower === 'vol.py' || lower.includes('volatility')) {
    const fIdx = restArgs.indexOf('-f')
    const dump = fIdx >= 0 ? restArgs[fIdx + 1] : 'memory.dmp'
    const plugin = restArgs.find(a => /^[a-z]+\.[a-z]+/i.test(a)) ?? 'windows.pslist'
    const lines = [
      ...simHeader('Volatility', '3.0.1'),
      `\x1b[90mDump   : ${dump}\x1b[0m`,
      `\x1b[90mPlugin : ${plugin}\x1b[0m`,
      '',
    ]
    if (plugin.includes('pslist')) {
      lines.push(
        'PID    PPID   ImageFileName       Offset(V)',
        '4      0      System              0xfffffa800a4b8b30',
        '292    4      smss.exe            0xfffffa800c1f7060',
        '376    368    csrss.exe           0xfffffa800c2c4060',
        '1024   376    explorer.exe        0xfffffa800d8a3060',
        '2104   1024   chrome.exe          0xfffffa800ec23060',
        '3148   1024   notepad.exe         0xfffffa800f021060',
      )
    } else if (plugin.includes('cmdline')) {
      lines.push(
        'PID    Process              Args',
        '1024   explorer.exe         C:\\Windows\\Explorer.EXE',
        '2104   chrome.exe           --type=renderer https://target.com',
        '3148   notepad.exe          C:\\Users\\admin\\flag.txt',
      )
    } else if (plugin.includes('netscan')) {
      lines.push(
        'Offset      Proto  LocalAddr      ForeignAddr     State        Pid',
        '0xfa800c1   TCP    0.0.0.0:445    0.0.0.0:0       LISTENING    4',
        '0xfa800c2   TCP    10.0.0.5:443   1.2.3.4:53124   ESTABLISHED  2104',
      )
    } else if (plugin.includes('hashdump')) {
      lines.push(
        'Administrator:500:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::',
        'Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::',
        'admin:1001:aad3b435b51404eeaad3b435b51404ee:8846f7eaee8fb117ad06bdd830b7586c:::',
      )
    } else if (plugin.includes('filescan')) {
      lines.push(
        '0xfa8001234  4  0  RW-rw-       \\Device\\HarddiskVolume2\\Users\\admin\\notes.txt',
        '0xfa8005678  3  0  RWD---r-d    \\Device\\HarddiskVolume2\\Windows\\Temp\\flag.txt',
        '0xfa8009abc  2  0  RW-rw-       \\Device\\HarddiskVolume2\\Users\\admin\\readme.txt',
      )
    } else if (plugin.includes('linux')) {
      lines.push(
        'ls -la',
        'cd challenges',
        'sudo -l',
        'find / -perm -4000 2>/dev/null',
      )
    } else {
      lines.push(`(plugin "${plugin}" — output omitted in simulation)`)
    }
    return lines
  }
  if (lower === 'psexec.py' || lower.includes('psexec')) {
    const target = restArgs.find(a => a.includes('@'))?.split('@')[1] ?? 'target'
    return [
      `\x1b[90m[psexec.py]\x1b[0m establishing SMB session → ${target}`,
      '\x1b[32m[*]\x1b[0m Found writable share: ADMIN$',
      '\x1b[32m[*]\x1b[0m Service RemoteSvc installed',
      '\x1b[32m[*]\x1b[0m Service started',
      '',
      'Microsoft Windows [Version 10.0.19045]',
      '(c) Microsoft Corporation. All rights reserved.',
      '',
      'C:\\Windows\\system32> whoami',
      'nt authority\\system',
    ]
  }
  if (lower.includes('secretsdump')) {
    const target = restArgs.find(a => a.includes('@'))?.split('@')[1] ?? 'DC_IP'
    return [
      `\x1b[90m[secretsdump.py]\x1b[0m dumping NTDS from ${target}`,
      '',
      '[*] Service RemoteRegistry is in stopped state',
      '[*] Starting service RemoteRegistry',
      '[*] Target system bootKey: 0x8b56b2cb5033d8e8a3e4e5e9b0d4e2c1',
      '[*] Dumping local SAM hashes (uid:rid:lmhash:nthash)',
      'Administrator:500:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::',
      'Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::',
      '[*] Dumping cached domain logon information',
      'DOMAIN\\admin:$DCC2$10240#admin#abc123def456...:::',
      '[*] Cleaning up...',
    ]
  }
  if (lower.includes('getuserspns')) {
    return [
      `\x1b[90m[GetUserSPNs.py]\x1b[0m requesting Kerberos tickets for SPN accounts`,
      '',
      'ServicePrincipalName     Name      MemberOf',
      '-----------------------  --------  ----------------------------',
      'MSSQLSvc/dc01:1433       sql_svc   CN=Domain Admins,...',
      'HTTP/web01.domain.local  web_svc   CN=Domain Users,...',
      '',
      '$krb5tgs$23$*sql_svc$DOMAIN.LOCAL$MSSQLSvc/dc01:1433*$<truncated-hash>',
      '$krb5tgs$23$*web_svc$DOMAIN.LOCAL$HTTP/web01*$<truncated-hash>',
      '',
      '\x1b[90mFeed to hashcat -m 13100 to crack offline.\x1b[0m',
    ]
  }
  if (lower.includes('getnpusers')) {
    return [
      `\x1b[90m[GetNPUsers.py]\x1b[0m AS-REP roasting (no Kerberos pre-auth)`,
      '$krb5asrep$23$nopreauth@DOMAIN.LOCAL:abc123...:def456...',
    ]
  }
  if (lower.includes('ntlmrelayx')) {
    return [
      `\x1b[90m[ntlmrelayx.py]\x1b[0m relay listener active on ports 80/445`,
      '[*] Servers started, waiting for connections',
      '[*] HTTPD: Received connection from 10.0.0.42',
      '[*] HTTPD: Authenticating against smb://10.0.0.5 as DOMAIN/john SUCCEED',
      '[*] HTTPD: Showing dumped SAM',
    ]
  }
  if (lower.includes('responder')) {
    return cmdResponder(restArgs)
  }

  // Generic fallback — accept the script invocation rather than emitting "not found"
  return [
    `\x1b[90m[python3 ${file}] ${restArgs.join(' ')}\x1b[0m`,
    `\x1b[90m(simulated execution — script not in lab FS)\x1b[0m`,
  ]
}

function cmdSubmit(args: string[]): string[] {
  const flag = args[0]
  if (!flag) return ['\x1b[31mUsage: submit FLAG{...}\x1b[0m']
  if (VALID_FLAGS.has(flag)) {
    return [
      '\x1b[1;32m╔═══════════════════════════════╗\x1b[0m',
      '\x1b[1;32m║  ✓  FLAG ACCEPTED!           ║\x1b[0m',
      `\x1b[32m║  ${flag.padEnd(29)}║\x1b[0m`,
      '\x1b[1;32m╚═══════════════════════════════╝\x1b[0m',
    ]
  }
  return ['\x1b[31m✗ Invalid flag. Try again.\x1b[0m']
}

// ─── Security Tools (Simulated) ──────────────────────────────────────────────

function simHeader(tool: string, version: string): string[] {
  return [`\x1b[1;32m[*]\x1b[0m \x1b[1m${tool}\x1b[0m v${version} \x1b[90m(simulated)\x1b[0m`, '']
}

function cmdNmap(args: string[]): string[] {
  const target = args.find(a => !a.startsWith('-')) ?? '10.10.10.1'
  const isSV = args.includes('-sV') || args.includes('-A')
  const isSC = args.includes('-sC') || args.includes('-A')
  const isSn = args.includes('-sn')
  const portFlag = args.find(a => a.startsWith('-p'))?.slice(2) ?? '1-1000'
  const isFullScan = portFlag === '-' || portFlag === ''
  const ports = isFullScan ? '1-65535' : portFlag
  const timing = args.find(a => /^-T[0-5]$/.test(a)) ?? '-T3'
  const duration = isFullScan ? '37.81' : timing === '-T4' ? '2.14' : '4.23'

  if (isSn) {
    return [
      ...simHeader('Nmap', '7.94'),
      `\x1b[90mStarting Nmap scan on ${target} (ping sweep)\x1b[0m`,
      '',
      `Nmap scan report for ${target.replace(/\.\d+$/, '.1')}  Host is up (0.0042s latency).`,
      `Nmap scan report for ${target.replace(/\.\d+$/, '.42')} Host is up (0.0089s latency).`,
      `Nmap scan report for ${target.replace(/\.\d+$/, '.50')} Host is up (0.0024s latency).`,
      '',
      `\x1b[90mNmap done: 256 IP addresses (3 hosts up) scanned in 1.84 seconds\x1b[0m`,
    ]
  }

  return [
    ...simHeader('Nmap', '7.94'),
    `\x1b[90mStarting Nmap scan on ${target} (ports: ${ports}, timing: ${timing})\x1b[0m`,
    '',
    `Host: \x1b[1;32m${target}\x1b[0m  Status: \x1b[32mUp\x1b[0m  Latency: 0.42ms`,
    '',
    '\x1b[1mPORT      STATE  SERVICE' + (isSV ? '    VERSION' : '') + '\x1b[0m',
    `22/tcp    \x1b[32mopen\x1b[0m   ssh      ${isSV ? 'OpenSSH 8.2p1 Ubuntu' : ''}`,
    `80/tcp    \x1b[32mopen\x1b[0m   http     ${isSV ? 'Apache httpd 2.4.41' : ''}`,
    `443/tcp   \x1b[32mopen\x1b[0m   https    ${isSV ? 'Apache httpd 2.4.41' : ''}`,
    `3306/tcp  \x1b[33mopen\x1b[0m   mysql    ${isSV ? 'MySQL 8.0.28' : ''}`,
    ...(isFullScan ? [
      `8080/tcp  \x1b[32mopen\x1b[0m   http-alt ${isSV ? 'Node.js Express 4.x' : ''}`,
      `4444/tcp  \x1b[31mopen\x1b[0m   krb524   ${isSV ? '?' : ''}  ← unusual`,
    ] : []),
    ...(isSC ? [
      '',
      `\x1b[90m| http-title: Welcome to ${target}\x1b[0m`,
      '\x1b[90m| ssh-hostkey: 3072 RSA (2048-bit)\x1b[0m',
      '\x1b[90m|_http-server-header: Apache/2.4.41\x1b[0m',
    ] : []),
    '',
    `\x1b[90mNmap done: 1 IP (1 host up) scanned in ${duration} seconds\x1b[0m`,
  ]
}

function cmdWpscan(args: string[]): string[] {
  const url = flagValue(args, '--url') ?? args.find(a => a.startsWith('http')) ?? 'https://target.com'
  const enumArg = args.find(a => a.startsWith('--enumerate'))?.split(' ').slice(-1)[0]
    ?? flagValue(args, '--enumerate')
  const passwd = args.includes('--passwords') || !!flagValue(args, '--passwords')
  const username = flagValue(args, '--usernames') ?? 'admin'

  const enumPlugins = enumArg?.includes('p')
  const enumUsers = enumArg?.includes('u')
  const enumThemes = enumArg?.includes('t')

  return [
    ...simHeader('WPScan', '3.8.25'),
    `\x1b[90mScanning : ${url}\x1b[0m`,
    ...(enumArg ? [`\x1b[90mEnumerate: ${enumArg}\x1b[0m`] : []),
    '',
    '\x1b[32m[+]\x1b[0m WordPress \x1b[1m6.4.2\x1b[0m detected',
    '\x1b[33m[!]\x1b[0m XML-RPC enabled → /xmlrpc.php',
    '\x1b[33m[!]\x1b[0m readme.html exposed',
    ...(enumUsers ? [
      '',
      '\x1b[32m[+]\x1b[0m Users: admin (id:1), editor (id:2)',
    ] : []),
    ...(enumPlugins ? [
      '\x1b[31m[!]\x1b[0m contact-form-7 4.9 — SQLi (CVE-2023-1234)',
      '\x1b[31m[!]\x1b[0m woocommerce 7.1 — XSS (CVE-2023-5678)',
    ] : []),
    ...(enumThemes ? [
      '\x1b[33m[!]\x1b[0m theme: twentytwentyone 1.7 — outdated',
    ] : []),
    ...(passwd ? [
      '',
      `\x1b[32m[FOUND]\x1b[0m  ${username} : \x1b[1mpassword123\x1b[0m`,
    ] : []),
    '',
    '\x1b[90mScan complete.\x1b[0m',
  ]
}

function cmdNikto(args: string[]): string[] {
  const host = flagValue(args, '-h') ?? args.find(a => !a.startsWith('-')) ?? 'http://target.com'
  const port = flagValue(args, '-p')
  const ssl = args.includes('-ssl')
  const output = flagValue(args, '-o')
  return [
    ...simHeader('Nikto', '2.1.6'),
    `\x1b[90mTarget : ${host}${port ? ':' + port : ''}${ssl ? ' (SSL)' : ''}\x1b[0m`,
    ...(output ? [`\x1b[90mOutput : ${output}\x1b[0m`] : []),
    '',
    '\x1b[32m+\x1b[0m Server: Apache/2.4.41 (Ubuntu)',
    '\x1b[33m+\x1b[0m /admin/ directory accessible',
    '\x1b[33m+\x1b[0m /backup.zip found — backup exposed',
    '\x1b[31m+\x1b[0m X-Frame-Options missing → Clickjacking risk',
    '\x1b[33m+\x1b[0m /phpinfo.php → information disclosure',
    '\x1b[33m+\x1b[0m HTTP TRACE enabled → XST possible',
    ...(ssl ? ['\x1b[33m+\x1b[0m TLSv1.0 supported — deprecated protocol'] : []),
    '',
    `\x1b[90m${ssl ? 7 : 6} findings. Duration: 00:01:23\x1b[0m`,
  ]
}

function cmdSqlmap(args: string[]): string[] {
  const url = args.find(a => a.startsWith('http')) ?? null
  const requestFile = flagValue(args, '-r')
  const dbArg = flagValue(args, '-D')
  const cookie = flagValue(args, '--cookie')
  const level = flagValue(args, '--level') ?? args.find(a => a.startsWith('--level='))?.split('=')[1] ?? '1'
  const risk = flagValue(args, '--risk') ?? args.find(a => a.startsWith('--risk='))?.split('=')[1] ?? '1'
  const target = url ?? (requestFile ? `(request file: ${requestFile})` : 'http://target.com/?id=1')

  return [
    ...simHeader('sqlmap', '1.7.8'),
    `\x1b[90mTarget : ${target}\x1b[0m`,
    `\x1b[90mLevel  : ${level}  Risk: ${risk}\x1b[0m`,
    ...(cookie ? [`\x1b[90mCookie : ${cookie}\x1b[0m`] : []),
    '',
    '\x1b[32m[+]\x1b[0m \x1b[1mid\x1b[0m parameter is vulnerable — Boolean-based blind SQLi',
    '    Payload: id=1 AND 1=1-- -',
    '',
    '\x1b[32m[+]\x1b[0m DBMS: MySQL >= 5.0',
    `\x1b[32m[+]\x1b[0m Databases: information_schema, \x1b[1m${dbArg ?? 'webapp'}\x1b[0m, mysql`,
    ...(args.includes('--tables') && dbArg ? [
      '',
      `\x1b[32m[+]\x1b[0m ${dbArg}.tables:`,
      `    users    (12 entries)`,
      `    sessions (3,418 entries)`,
      `    audit    (89,217 entries)`,
    ] : []),
    ...(args.includes('--dump') ? [
      '',
      `\x1b[32m[+]\x1b[0m ${dbArg ?? 'webapp'}.users:`,
      '    admin  |  5f4dcc3b5aa765d61d8327deb882cf99  (MD5: "password")',
      '    user1  |  482c811da5d5b4bc6d497ffa98491e38',
    ] : []),
    ...(args.includes('--os-shell') ? [
      '',
      '\x1b[33m[*]\x1b[0m Spawning OS shell via UNION-based payload...',
      '\x1b[32mos-shell>\x1b[0m  (simulated, no real execution)',
    ] : []),
    '',
    '\x1b[90mScan complete.\x1b[0m',
  ]
}

function cmdGobuster(cmd: string, args: string[]): string[] {
  const mode = args[0] === 'dir' || args[0] === 'dns' ? args[0] : 'dir'
  const url = flagValue(args, '-u') ?? args.find(a => a.startsWith('http')) ?? 'http://target.com'
  const domain = flagValue(args, '-d')
  const wordlist = flagValue(args, '-w') ?? '/usr/share/wordlists/dirb/common.txt'
  const ext = flagValue(args, '-x')
  const threads = flagValue(args, '-t') ?? '10'

  if (mode === 'dns' && domain) {
    return [
      ...simHeader(cmd, '3.6.0'),
      `\x1b[90mDomain   : ${domain}\x1b[0m`,
      `\x1b[90mWordlist : ${wordlist}\x1b[0m`,
      '',
      `\x1b[32mFound: www.${domain}\x1b[0m`,
      `\x1b[32mFound: api.${domain}\x1b[0m`,
      `\x1b[32mFound: mail.${domain}\x1b[0m`,
      `\x1b[33mFound: dev.${domain}\x1b[0m`,
      `\x1b[33mFound: vpn.${domain}\x1b[0m`,
      '',
      '\x1b[90m5 subdomains discovered.\x1b[0m',
    ]
  }

  return [
    ...simHeader(cmd, '3.6.0'),
    `\x1b[90mTarget   : ${url}\x1b[0m`,
    `\x1b[90mWordlist : ${wordlist}\x1b[0m`,
    `\x1b[90mThreads  : ${threads}\x1b[0m`,
    ...(ext ? [`\x1b[90mExts     : ${ext}\x1b[0m`] : []),
    '',
    `\x1b[32m/admin\x1b[0m         (Status: 200) [Size: 4821]`,
    `\x1b[32m/login\x1b[0m         (Status: 200) [Size: 1203]`,
    `\x1b[33m/backup\x1b[0m        (Status: 301) [→ /backup/]`,
    `\x1b[32m/uploads\x1b[0m       (Status: 200) [Size: 892]`,
    `\x1b[31m/.env\x1b[0m          (Status: 200) [Size: 118]  ← ATTENTION`,
    `\x1b[32m/api\x1b[0m           (Status: 200) [Size: 44]`,
    ...(ext?.includes('php') ? [`\x1b[32m/admin.php\x1b[0m     (Status: 200) [Size: 2841]`] : []),
    '',
    `\x1b[90m${ext?.includes('php') ? 7 : 6} paths discovered.\x1b[0m`,
  ]
}

function cmdHydra(args: string[]): string[] {
  const userList = flagValue(args, '-L')
  const username = userList ?? flagValue(args, '-l') ?? 'admin'
  const passList = flagValue(args, '-P') ?? flagValue(args, '-p') ?? '/usr/share/wordlists/rockyou.txt'
  const tasks = flagValue(args, '-t') ?? '16'
  const port = flagValue(args, '-s')

  // First scan: look for proto://host descriptor anywhere in args
  let svc = 'ssh'
  let target = 'target'
  for (const a of args) {
    const m = a.match(/^([a-z][a-z0-9-]*):\/\/(.+)$/i)
    if (m) { svc = m[1]; target = m[2]; break }
  }
  // Second scan: explicit "host <service-form>" pattern
  if (target === 'target') {
    const knownSvc = ['ssh', 'ftp', 'http-get', 'http-post', 'http-post-form',
      'http-get-form', 'rdp', 'smb', 'telnet', 'vnc', 'smtp', 'pop3', 'imap',
      'mysql', 'postgres', 'snmp']
    const svcIdx = args.findIndex(a => knownSvc.includes(a))
    if (svcIdx > 0) {
      svc = args[svcIdx]
      target = args[svcIdx - 1] ?? 'target'
    }
  }

  const password = svc === 'ftp' ? 'qwerty'
    : svc === 'http-post-form' ? 'admin123'
    : svc === 'rdp' ? 'P@ssw0rd!'
    : 'winter2023'

  const userLabel = userList ? `<list: ${userList}>` : username
  const foundUser = userList ? 'admin' : username

  return [
    ...simHeader('Hydra', '9.5'),
    `\x1b[90mTarget   : ${target}${port ? ':' + port : ''}\x1b[0m`,
    `\x1b[90mService  : ${svc}\x1b[0m`,
    `\x1b[90mUser     : ${userLabel}\x1b[0m`,
    `\x1b[90mWordlist : ${passList}\x1b[0m`,
    '',
    `\x1b[32m[DATA]\x1b[0m ${tasks} tasks, dictionary attack...`,
    '\x1b[32m[STATUS]\x1b[0m 1024 / 14,344 attempts',
    `\x1b[32m[FOUND]\x1b[0m  ${target} ${svc} login: \x1b[1m${foundUser}\x1b[0m  password: \x1b[1m${password}\x1b[0m`,
    '',
    '\x1b[90m1 valid credential found. Duration: 00:02:11\x1b[0m',
  ]
}

function cmdHashcat(cmd: string, args: string[]): string[] {
  const target = args.find(a => !a.startsWith('-') && !a.startsWith('/usr/')) ?? 'hash.txt'
  const wordlist = args.find(a => a.startsWith('/usr/') || a.endsWith('.txt') && a !== target) ?? '/usr/share/wordlists/rockyou.txt'
  const mode = flagValue(args, '-m')
  const attack = flagValue(args, '-a') ?? '0'
  const tool = cmd === 'john' ? 'John the Ripper' : 'Hashcat'
  const ver  = cmd === 'john' ? '1.9.0' : '6.2.6'

  const hashType = mode === '0' ? 'MD5' :
    mode === '100' ? 'SHA1' :
    mode === '1000' ? 'NTLM' :
    mode === '1800' ? 'sha512crypt $6$ (Unix)' :
    mode === '2500' ? 'WPA-EAPOL-PBKDF2' :
    mode === '5600' ? 'NetNTLMv2' :
    mode ? `mode ${mode}` : 'MD5 (auto-detected)'

  const cracked = mode === '1000' ? 'Welcome2024!' :
    mode === '1800' ? 'P@ssw0rd!' :
    mode === '5600' ? 'spring2024' :
    'password'

  const speed = mode === '1800' ? '14,234' :
    mode === '1000' ? '5,621,003,994' :
    '1,234,567'

  return [
    ...simHeader(tool, ver),
    `\x1b[90mTarget   : ${target}\x1b[0m`,
    `\x1b[90mWordlist : ${wordlist}\x1b[0m`,
    `\x1b[90mAttack   : -a ${attack}\x1b[0m`,
    '',
    `\x1b[32m[*]\x1b[0m Hash type   : ${hashType}`,
    `\x1b[32m[*]\x1b[0m Speed       : ${speed} H/s`,
    `\x1b[32m[CRACKED]\x1b[0m  \x1b[1m${cracked}\x1b[0m`,
    '',
    '\x1b[90m1/1 hash cracked.\x1b[0m',
  ]
}

function cmdMsf(cmd: string, args: string[]): string[] {
  if (cmd === 'msfvenom') {
    const payload = flagValue(args, '-p') ?? 'linux/x64/shell_reverse_tcp'
    const format = flagValue(args, '-f') ?? 'elf'
    const output = flagValue(args, '-o')
    const lhost = args.find(a => a.startsWith('LHOST='))?.split('=')[1]
    const lport = args.find(a => a.startsWith('LPORT='))?.split('=')[1]
    if (lhost || lport || output) {
      return [
        ...simHeader('msfvenom', '6.3.44'),
        `\x1b[90mPayload : ${payload}\x1b[0m`,
        `\x1b[90mFormat  : ${format}\x1b[0m`,
        ...(lhost ? [`\x1b[90mLHOST   : ${lhost}\x1b[0m`] : []),
        ...(lport ? [`\x1b[90mLPORT   : ${lport}\x1b[0m`] : []),
        '',
        `\x1b[32m[+]\x1b[0m No platform was selected, choosing Msf::Module::Platform::Linux`,
        `\x1b[32m[+]\x1b[0m Payload size: 132 bytes`,
        `\x1b[32m[+]\x1b[0m Final size of ${format} file: 247 bytes`,
        ...(output ? [`\x1b[32mSaved as: ${output}\x1b[0m`] : []),
      ]
    }
    return [
      ...simHeader('msfvenom', '6.3.44'),
      '\x1b[90mUsage: msfvenom -p <payload> LHOST=<ip> LPORT=<port> -f <format>\x1b[0m',
      '',
      '  linux/x64/shell_reverse_tcp',
      '  windows/x64/meterpreter/reverse_tcp',
      '  php/meterpreter_reverse_tcp',
    ]
  }
  const quiet = args.includes('-q')
  return [
    ...(quiet ? [] : ['\x1b[1;31m       =[ metasploit v6.3.44 ]=\x1b[0m',
                      '\x1b[90m+ -- --=[ 2369 exploits | 1232 auxiliary ]=-- -- +\x1b[0m',
                      '']),
    ...(quiet ? ['\x1b[90m[msfconsole -q] started in quiet mode\x1b[0m'] : []),
    '\x1b[90mmsf6 >\x1b[0m \x1b[33mSimulation mode — real exploits cannot be executed.\x1b[0m',
  ]
}

function cmdAircrack(cmd: string, args: string[]): string[] {
  const iface = args.find(a => !a.startsWith('-') && /wlan|mon/.test(a)) ?? 'wlan0mon'
  const bssid = flagValue(args, '--bssid') ?? 'AA:BB:CC:DD:EE:FF'
  const channel = flagValue(args, '-c') ?? '6'
  const wordlist = flagValue(args, '-w')
  const capFile = args.find(a => a.endsWith('.cap')) ?? null

  if (cmd === 'airodump-ng') return [
    ...simHeader('airodump-ng', '1.7'),
    `\x1b[90mInterface: ${iface}  CH: ${channel}\x1b[0m`,
    ...(bssid !== 'AA:BB:CC:DD:EE:FF' ? [`\x1b[90mBSSID    : ${bssid}\x1b[0m`] : []),
    ...(wordlist ? [`\x1b[90mWriting  : ${wordlist}\x1b[0m`] : []),
    '',
    '\x1b[1m BSSID              PWR  CH  ENC   ESSID\x1b[0m',
    ` ${bssid}  -42  ${channel.padEnd(2)}  WPA2  TargetNetwork`,
    ' 11:22:33:44:55:66  -78  11  WPA2  HomeWifi',
    ' DD:EE:FF:00:11:22  -65  1   WPA3  GuestNet',
  ]
  if (cmd === 'aireplay-ng') {
    const count = flagValue(args, '-0') ?? '10'
    return [
      ...simHeader('aireplay-ng', '1.7'),
      `\x1b[90mTarget BSSID: ${bssid}\x1b[0m`,
      `Sending ${count} DeAuth (code 7) to broadcast -- BSSID: ${bssid}`,
    ]
  }
  return [
    ...simHeader('aircrack-ng', '1.7'),
    `\x1b[90mCapture  : ${capFile ?? 'capture-01.cap'}\x1b[0m`,
    `\x1b[90mWordlist : ${wordlist ?? 'rockyou.txt'}\x1b[0m`,
    '',
    `\x1b[32m[*]\x1b[0m WPA handshake captured: ${bssid}`,
    '\x1b[32m[KEY FOUND!]\x1b[0m [ \x1b[1mwifi123456\x1b[0m ]',
  ]
}

function cmdEnum4linux(args: string[]): string[] {
  const target = args.find(a => !a.startsWith('-')) ?? '10.10.10.1'
  const fl = flags(args)
  const all = fl.includes('a')
  const blocks: string[] = [
    ...simHeader('enum4linux', '0.9.1'),
    `\x1b[90mTarget: ${target}  Flags: ${fl || '(default)'}\x1b[0m`,
    '',
  ]
  if (all || fl.includes('S')) {
    blocks.push(
      '\x1b[32m[*]\x1b[0m SMB Shares:',
      `    //${target}/ADMIN$  — Windows Remote Admin`,
      `    //${target}/Share   — \x1b[32mAccessible\x1b[0m`,
    )
  }
  if (all || fl.includes('U')) {
    blocks.push('\x1b[32m[*]\x1b[0m Users: Administrator (500), Guest (501), \x1b[1moperator\x1b[0m (1001)')
  }
  if (all || fl.includes('G')) {
    blocks.push('\x1b[32m[*]\x1b[0m Groups: Domain Admins, Backup Operators, Remote Desktop Users')
  }
  if (all || fl.includes('P')) {
    blocks.push('\x1b[32m[*]\x1b[0m Password Policy: min-length 8, lockout-threshold 5')
  }
  blocks.push('', '\x1b[90mScan complete.\x1b[0m')
  return blocks
}

function cmdResponder(args: string[]): string[] {
  const iface = flagValue(args, '-I') ?? args.find(a => !a.startsWith('-')) ?? 'eth0'
  const analyze = args.includes('-A')
  const verbose = args.includes('-v') || args.includes('-rdwv') || args.includes('-rdw')
  return [
    ...simHeader('Responder', '3.1.4.0'),
    `\x1b[90mInterface: ${iface}\x1b[0m`,
    `\x1b[90mMode     : ${analyze ? 'analyze (passive)' : 'poison (LLMNR + NBT-NS + MDNS)'}\x1b[0m`,
    ...(verbose ? [`\x1b[90mVerbose  : enabled\x1b[0m`] : []),
    '',
    `\x1b[32m[+]\x1b[0m ${analyze ? 'Listening for broadcast queries' : 'Poisoner started'}`,
    '\x1b[33m[SMB]\x1b[0m 10.10.10.50 — user: \x1b[1mDOMAIN\\john\x1b[0m',
    '\x1b[32m[HASH]\x1b[0m NTLMv2: john::DOMAIN:aad3b435b51404eeaad3b435b51404ee:...',
    '\x1b[90mCrack with hashcat: hashcat -m 5600 hash.txt rockyou.txt\x1b[0m',
  ]
}

function cmdNucleI(args: string[]): string[] {
  const target = flagValue(args, '-u') ?? flagValue(args, '-l') ?? args.find(a => a.startsWith('http')) ?? 'https://target.com'
  const templates = flagValue(args, '-t')
  const sevFilter = flagValue(args, '-severity')
  const isList = !!flagValue(args, '-l')
  const allSev = ['critical', 'high', 'medium', 'info']
  const wantedSev = sevFilter ? sevFilter.split(',').map(s => s.trim()) : allSev

  const findings: string[] = []
  if (wantedSev.includes('critical')) {
    findings.push('\x1b[31m[critical]\x1b[0m CVE-2021-44228 Log4Shell — \x1b[1mVULNERABLE\x1b[0m')
  }
  if (wantedSev.includes('high')) {
    findings.push('\x1b[33m[high]\x1b[0m    CVE-2023-44487 HTTP/2 Rapid Reset')
    findings.push('\x1b[33m[high]\x1b[0m    CVE-2024-3094 xz-utils backdoor (sshd)')
  }
  if (wantedSev.includes('medium')) {
    findings.push('\x1b[33m[medium]\x1b[0m  /server-status exposed')
  }
  if (wantedSev.includes('info')) {
    findings.push('\x1b[32m[info]\x1b[0m    PHP 8.1.12  |  nginx 1.24.0')
  }

  return [
    ...simHeader('Nuclei', '3.1.0'),
    `\x1b[90mTarget   : ${isList ? `(list: ${target})` : target}\x1b[0m`,
    `\x1b[90mTemplates: ${templates ?? '8,432 default'}\x1b[0m`,
    ...(sevFilter ? [`\x1b[90mSeverity : ${sevFilter}\x1b[0m`] : []),
    '',
    ...findings,
    '',
    `\x1b[90m${findings.length} findings. Duration: 00:00:47\x1b[0m`,
  ]
}

function cmdAmass(cmd: string, args: string[]): string[] {
  const domain = flagValue(args, '-d') ?? args.find(a => !a.startsWith('-') && a.includes('.') && !a.includes('/')) ?? 'target.com'
  const active = args.includes('-active')
  const passive = args.includes('-passive')
  const isIntel = args.includes('intel')

  if (isIntel) {
    return [
      ...simHeader(cmd, '4.2.0'),
      `\x1b[90mDomain: ${domain} (WHOIS intel)\x1b[0m`,
      `Registrant : Example Corp`,
      `Email      : domains@${domain}`,
      `Created    : 2014-03-21`,
    ]
  }

  return [
    ...simHeader(cmd, '4.2.0'),
    `\x1b[90mDomain: ${domain}  Mode: ${active ? 'active' : passive ? 'passive' : 'default'}\x1b[0m`,
    '',
    `\x1b[32m[+]\x1b[0m mail.${domain}`,
    `\x1b[32m[+]\x1b[0m api.${domain}`,
    `\x1b[32m[+]\x1b[0m dev.${domain}`,
    `\x1b[33m[+]\x1b[0m vpn.${domain}  ← VPN access`,
    `\x1b[33m[+]\x1b[0m jenkins.${domain}  ← CI/CD`,
    ...(active ? [`\x1b[33m[+]\x1b[0m staging.${domain}  ← active probe`] : []),
    '',
    `\x1b[90m${active ? 6 : 5} subdomains discovered.\x1b[0m`,
  ]
}

function cmdTcpdump(cmd: string, args: string[]): string[] {
  if (cmd === 'wireshark') return [
    '\x1b[33m[!]\x1b[0m Wireshark is a GUI application.',
    '\x1b[90m    For terminal: tcpdump -i eth0 -w capture.pcap\x1b[0m',
  ]
  const iface = flagValue(args, '-i') ?? 'eth0'
  const writeFile = flagValue(args, '-w')
  const filter = args.filter(a => /^(port|host|tcp|udp|or|and|not|src|dst)$/.test(a) || /^\d+$/.test(a)).join(' ').trim()
  return [
    ...simHeader('tcpdump', '4.99.4'),
    `\x1b[90mListening on ${iface}${filter ? ` with filter: ${filter}` : ''}\x1b[0m`,
    ...(writeFile ? [`\x1b[90mWriting to: ${writeFile}\x1b[0m`] : []),
    '',
    '12:04:01  IP 10.10.10.1.443  > 10.10.10.50.52341  Flags [P.] len 512',
    '12:04:01  IP 10.10.10.50.52341 > 10.10.10.1.443   Flags [.] ack 513',
    '12:04:02  IP 10.10.10.100.80 > 10.10.10.50.43210  Flags [P.] len 1024',
    '12:04:03  IP 10.10.10.50.43211 > 10.10.10.100.80  Flags [S]  win 65535',
    '\x1b[90m^C — press Ctrl+C to stop\x1b[0m',
  ]
}

function cmdNetcat(args: string[]): string[] {
  const listen = args.includes('-l') || args.some(a => a.includes('lvnp') || a.includes('lp'))
  const verbose = args.includes('-v') || args.some(a => a.includes('v'))
  const portScan = args.includes('-z')
  const port = args.find(a => /^\d{2,5}$/.test(a)) ?? '4444'
  const target = args.find(a => /^\d{1,3}\.\d/.test(a) || (!a.startsWith('-') && /\./.test(a))) ?? '10.10.10.1'

  if (portScan) {
    const range = args.find(a => /^\d+-\d+$/.test(a)) ?? '20-100'
    const [lo, hi] = range.split('-').map(Number)
    const opens: string[] = []
    for (const p of [22, 80, 443, 3306, 8080]) {
      if (p >= lo && p <= hi) {
        opens.push(`Connection to ${target} ${p} port [tcp/*] succeeded!`)
      }
    }
    return [
      `\x1b[90m[nc -z ${target} ${range}] port scan${verbose ? ' (verbose)' : ''}\x1b[0m`,
      ...opens,
      `\x1b[90m${opens.length} open ports in ${range}.\x1b[0m`,
    ]
  }

  if (listen) return [
    `\x1b[90mListening on 0.0.0.0:${port} ...\x1b[0m`,
    `\x1b[32mConnection received\x1b[0m from ${target}:54321`,
    '\x1b[1;32m$\x1b[0m ',
  ]
  return [
    `\x1b[90mConnecting to ${target}:${port} ...\x1b[0m`,
    `\x1b[32m(UNKNOWN) [${target}] ${port} open\x1b[0m`,
  ]
}

function cmdSsh(cmd: string, args: string[]): string[] {
  const target = args.find(a => !a.startsWith('-')) ?? 'user@target.com'
  return [
    `\x1b[90m${cmd} ${target} — simulation mode, no real connection.\x1b[0m`,
  ]
}

// ─── New simulators (Block C polish) ─────────────────────────────────────────

function flagValue(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null
}

function cmdFfuf(args: string[]): string[] {
  const wordlist = flagValue(args, '-w') ?? 'wordlist.txt'
  const url = flagValue(args, '-u') ?? 'http://target.com/FUZZ'
  const fc = flagValue(args, '-fc')
  const fs = flagValue(args, '-fs')
  return [
    ...simHeader('ffuf', '2.1.0'),
    `\x1b[90mTarget    : ${url}\x1b[0m`,
    `\x1b[90mWordlist  : ${wordlist}\x1b[0m`,
    ...(fc ? [`\x1b[90mFilter    : status != ${fc}\x1b[0m`] : []),
    ...(fs ? [`\x1b[90mFilter    : size  != ${fs}\x1b[0m`] : []),
    '',
    '\x1b[1m::: Method ::: ::: Status ::: ::: Size :::\x1b[0m',
    `\x1b[32m  admin\x1b[0m            [Status: 200, Size: 4821]`,
    `\x1b[32m  login\x1b[0m            [Status: 200, Size: 1203]`,
    `\x1b[33m  backup\x1b[0m           [Status: 301, Size: 0]`,
    `\x1b[31m  .env\x1b[0m             [Status: 200, Size: 118] ← exposed`,
    `\x1b[32m  api\x1b[0m              [Status: 200, Size: 44]`,
    '',
    '\x1b[90m5 paths matched. Duration: 00:00:34\x1b[0m',
  ]
}

function cmdTshark(args: string[]): string[] {
  const iface = flagValue(args, '-i') ?? 'eth0'
  const file = flagValue(args, '-r')
  const filter = flagValue(args, '-Y')
  const writeFile = flagValue(args, '-w')
  return [
    ...simHeader('tshark', '4.2.4'),
    file
      ? `\x1b[90mReading capture: ${file}\x1b[0m`
      : `\x1b[90mCapturing on interface: ${iface}\x1b[0m`,
    ...(filter ? [`\x1b[90mDisplay filter: ${filter}\x1b[0m`] : []),
    ...(writeFile ? [`\x1b[90mWriting to    : ${writeFile}\x1b[0m`] : []),
    '',
    '  1   0.000000 10.0.2.15 → 8.8.8.8       DNS  74 Standard query A example.com',
    '  2   0.012431 8.8.8.8   → 10.0.2.15     DNS  90 Standard query response',
    '  3   0.014892 10.0.2.15 → 93.184.216.34 TCP  74 49152→443 [SYN]',
    '  4   0.067120 93.184.216.34 → 10.0.2.15 TCP  74 443→49152 [SYN, ACK]',
    '  5   0.067334 10.0.2.15 → 93.184.216.34 TCP  66 49152→443 [ACK]',
    '  6   0.082414 10.0.2.15 → 93.184.216.34 TLSv1.3 583 Client Hello',
    '',
    '\x1b[90m6 packets captured.\x1b[0m',
  ]
}

function cmdShodan(args: string[]): string[] {
  const sub = args[0]
  if (sub === 'host' && args[1]) {
    const ip = args[1]
    return [
      ...simHeader('shodan', '1.31'),
      `\x1b[1m${ip}\x1b[0m  (Cloudflare, Inc., US)`,
      '\x1b[1mPorts:\x1b[0m  22/tcp ssh  80/tcp http  443/tcp https',
    ]
  }
  if (sub === 'search') {
    const query = args.slice(1).filter(a => !a.startsWith('--')).join(' ')
    const limit = flagValue(args, '--limit')
    return [
      ...simHeader('shodan', '1.31'),
      `\x1b[90mQuery: ${query || '(empty)'}${limit ? '  Limit: ' + limit : ''}\x1b[0m`,
      '',
      '1.2.3.4         443    nginx        US',
      '5.6.7.8         443    Apache/2.4   DE',
      '203.0.113.42    22     OpenSSH 8.2  TR',
      '',
      `\x1b[90m3 results shown.\x1b[0m`,
    ]
  }
  if (sub === 'count') return [`\x1b[90m${args.slice(1).join(' ') || '(no query)'}\x1b[0m`, '12,478']
  return [...simHeader('shodan', '1.31'), '\x1b[90mUsage: shodan {search|host|count}\x1b[0m']
}

function cmdTheHarvester(args: string[]): string[] {
  const domain = flagValue(args, '-d') ?? 'target.com'
  const sources = flagValue(args, '-b') ?? 'all'
  const limit = flagValue(args, '-l')
  return [
    ...simHeader('theHarvester', '4.4.3'),
    `\x1b[90mTarget : ${domain}\x1b[0m`,
    `\x1b[90mSources: ${sources}\x1b[0m`,
    ...(limit ? [`\x1b[90mLimit  : ${limit}\x1b[0m`] : []),
    '',
    '\x1b[1m[*] Emails found:\x1b[0m',
    `  contact@${domain}`,
    `  admin@${domain}`,
    `  john.doe@${domain}`,
    '',
    '\x1b[1m[*] Hosts found:\x1b[0m',
    `  www.${domain}     (1.2.3.4)`,
    `  mail.${domain}    (1.2.3.5)`,
    `  api.${domain}     (1.2.3.6)`,
    '',
    '\x1b[1m[*] LinkedIn (filtered):\x1b[0m',
    '  John Doe — Senior Engineer',
    '  Jane Smith — DevOps Lead',
  ]
}

function cmdBinwalk(args: string[]): string[] {
  const target = args.find(a => !a.startsWith('-')) ?? 'firmware.bin'
  const extract = args.includes('-e') || args.includes('--extract')
  const entropy = args.includes('-E')
  const matryoshka = args.includes('-M')
  return [
    ...simHeader('binwalk', '2.4.3'),
    `\x1b[90mScanning: ${target}\x1b[0m`,
    '',
    'DECIMAL    HEXADECIMAL    DESCRIPTION',
    '-------------------------------------------------------------------',
    '0          0x0            uImage header, image size: 4194304 bytes',
    '64         0x40           LZMA compressed data',
    '1245184    0x130000       Squashfs filesystem, little endian, version 4.0',
    '4194304    0x400000       JFFS2 filesystem, little endian',
    ...(extract ? ['', `\x1b[32m[+] Extracted to ./_${target}.extracted/\x1b[0m`] : []),
    ...(entropy ? ['', '\x1b[33m[*] Entropy: 0x130000 falling — likely encrypted region\x1b[0m'] : []),
    ...(matryoshka ? ['', '\x1b[90m[*] Recursive scan complete (matryoshka)\x1b[0m'] : []),
  ]
}

function cmdGdb(args: string[]): string[] {
  const target = args.find(a => !a.startsWith('-') && !a.startsWith('(')) ?? 'a.out'
  return [
    'GNU gdb (Ubuntu 14.2-ubuntu) 14.2',
    'Copyright (C) 2024 Free Software Foundation, Inc.',
    `Reading symbols from ${target}...`,
    `(No debugging symbols found in ${target})`,
    'pwndbg: loaded 159 pwndbg commands. Type pwndbg [filter] for a list.',
    '\x1b[90m(gdb)\x1b[0m \x1b[90m(simulated — no real execution)\x1b[0m',
    '',
    '\x1b[90mUseful starting points:\x1b[0m',
    '  checksec        — show binary protections (NX, PIE, RELRO, Canary)',
    '  info functions  — list defined symbols',
    '  disas main      — disassemble main',
    '  b *main+50      — set breakpoint at offset',
    '  r / run         — start program',
    '  x/20wx $rsp     — examine the stack',
  ]
}

function cmdSsh2john(args: string[]): string[] {
  const key = args[0] ?? 'id_rsa'
  return [
    `\x1b[90m[ssh2john]\x1b[0m converting ${key} → John format`,
    `${key}:$sshng$1$16$a3b4c5d6e7f80910$1216$AAAAB3NzaC1yc2EAAAADAQABAAAB...<truncated>`,
    '',
    `\x1b[90mPipe to file:  ssh2john ${key} > ${key}.hash\x1b[0m`,
    `\x1b[90mThen crack:    john --wordlist=rockyou.txt ${key}.hash\x1b[0m`,
  ]
}

function cmdUnshadow(args: string[]): string[] {
  const passwd = args[0] ?? '/etc/passwd'
  const shadow = args[1] ?? '/etc/shadow'
  return [
    `\x1b[90m[unshadow]\x1b[0m merging ${passwd} + ${shadow}`,
    'root:$6$abcd1234$encryptedRootHashGoesHere:0:0:root:/root:/bin/bash',
    'operator:$6$efgh5678$anotherEncryptedHash:1000:1000:Operator:/home/operator:/bin/bash',
    'mysql:$6$ijkl9012$mysqlAccountHash:999:999:MySQL Server:/var/lib/mysql:/bin/false',
    '',
    `\x1b[90mPipe to john:  unshadow ${passwd} ${shadow} > combined.txt\x1b[0m`,
  ]
}
