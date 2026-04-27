import { resolvePath, getNode, basename, colorEntry } from './filesystem'
import { getCommand } from './commands'
import type { EvidenceEvent, EvidenceLog, EvidencePrimitive } from './evidence'
import { applyMutation, getMutableNode } from './mutation'
import { detectRevealEvent, formatBanner } from './reveal'
import { challengeContracts } from './validation/contracts'
import type { CommandContext, FSNode } from './types'

export interface RevealHooks {
  evidenceLog: EvidenceLog
  unlockedLevels: ReadonlySet<number>
  alreadyRevealed: ReadonlySet<number>
}

let nextEvidenceEventId = 0
const SYSLOG_PATH = '/var/log/syslog'

// ─── Valid CTF Flags ──────────────────────────────────────────────────────────

export const VALID_FLAGS: ReadonlySet<string> = new Set([
  'FLAG{r3con_master_l1nux}',
  'FLAG{ch4mod_p3rm1ss10ns}',
  'FLAG{h1dden_1n_pl41n_s1ght}',
  'FLAG{gr3p_1s_p0w3r}',
  'FLAG{pr1v3sc_r00t_0wn3d}',
  'FLAG{n3tw0rk_m4st3r_2024}',
])

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
    case 'date':         return [new Date().toString()]
    case 'uptime':       return [` ${new Date().toTimeString().slice(0, 8)} up 3 days, 4:22, 1 user, load average: 0.08, 0.05, 0.01`]
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
    case 'ifconfig': case 'ip': return cmdIfconfig()
    case 'netstat': case 'ss': return cmdNetstat()
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
    case 'hydra':        return cmdHydra(args)
    case 'hashcat': case 'john': return cmdHashcat(cmd, args)
    case 'msfconsole': case 'msfvenom': return cmdMsf(cmd)
    case 'aircrack-ng': case 'airodump-ng': case 'aireplay-ng': return cmdAircrack(cmd, args)
    case 'enum4linux':   return cmdEnum4linux(args)
    case 'responder':    return cmdResponder(args)
    case 'nuclei':       return cmdNucleI(args)
    case 'amass': case 'sublist3r': case 'recon-ng': return cmdAmass(cmd, args)
    case 'wireshark': case 'tcpdump': return cmdTcpdump(cmd, args)
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
      }

      return [`\x1b[31mbash: ${cmd}: command not found\x1b[0m`]
    }
  }
  })()

  // ============================================================
  // TEMPORARY: 01-recon hybrid mode bridge
  // ============================================================
  // The five commands below (cat, wc, grep, awk, submit) have not yet been
  // migrated to the registry but must still emit evidence so 01-recon's
  // hybrid validation passes. This inference is a deliberate exception to
  // the "switch-case fallback emits no primitives" rule. Will be removed
  // once those handlers move into the registry.
  // ============================================================
  const primitives = inferSwitchEvidence(cmd, args, cwdBefore, ctx)

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

function inferSwitchEvidence(cmd: string, args: string[], cwdBefore: string, ctx: CommandContext): EvidencePrimitive[] {
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
      primitives.push(
        { type: 'security_tool_used', tool: 'find' },
        { type: 'fact_derived', fact: 'privesc_via_sudo_find', method: 'sudo-find-exec' },
      )
    }
  }

  if (cmd === 'find') {
    const permIdx = args.indexOf('-perm')
    if (permIdx >= 0 && args[permIdx + 1] === '-4000') {
      primitives.push({ type: 'fact_derived', fact: 'suid_discovered', method: 'find-perm-4000' })
    }
  }

  if (cmd === 'wc') {
    const fl = flags(args)
    const target = nonFlags(args)[0]
    const path = existingFilePath(ctx, target)
    if (path) primitives.push({ type: 'file_read', path, via: 'wc' })
    if (fl.includes('l') && path === '/etc/passwd') {
      primitives.push({ type: 'fact_derived', fact: 'passwd_line_count', method: 'wc' })
    }
  }

  if (cmd === 'grep') {
    const fl = flags(args)
    const nf = nonFlags(args)
    const pattern = nf[0] ?? ''
    const target = nf[1]
    const path = existingFilePath(ctx, target)
    if (path) primitives.push({ type: 'file_read', path, via: 'grep' })
    if (fl.includes('c') && path === '/etc/passwd') {
      primitives.push({ type: 'fact_derived', fact: 'passwd_line_count', method: 'grep' })
    }
    if (path === SYSLOG_PATH && /4444|BACKDOOR/i.test(pattern)) {
      primitives.push({ type: 'fact_derived', fact: 'backdoor_investigated', method: 'grep-syslog' })
    }
  }

  if (cmd === 'netstat' || cmd === 'ss') {
    primitives.push({ type: 'fact_derived', fact: 'suspicious_port_4444', method: cmd })
  }

  if (cmd === 'awk') {
    const nf = nonFlags(args)
    const program = nf[0] ?? ''
    const target = nf[1]
    const path = existingFilePath(ctx, target)
    if (path) primitives.push({ type: 'file_read', path, via: 'awk' })
    if (program.includes('END') && program.includes('NR') && path === '/etc/passwd') {
      primitives.push({ type: 'fact_derived', fact: 'passwd_line_count', method: 'awk' })
    }
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

function cmdPs(args: string[]): string[] {
  const all = args.some(a => a.includes('a'))
  if (!all) return ['  PID TTY    CMD', ' 1234 pts/0  bash', ' 5678 pts/0  ps']
  return [
    'USER       PID %CPU %MEM COMMAND',
    'root         1  0.0  0.1 /sbin/init',
    'root       234  0.0  0.0 sshd: [listener]',
    'www-data   456  0.1  0.2 nginx: worker process',
    'mysql      789  0.3  1.5 /usr/sbin/mysqld',
    'operator  1234  0.0  0.1 bash',
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

function cmdIfconfig(): string[] {
  return [
    '\x1b[1meth0\x1b[0m: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500',
    '        inet \x1b[32m10.0.2.15\x1b[0m  netmask 255.255.255.0  broadcast 10.0.2.255',
    '        ether 08:00:27:ab:cd:ef',
    '',
    '\x1b[1mlo\x1b[0m: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536',
    '        inet \x1b[32m127.0.0.1\x1b[0m  netmask 255.0.0.0',
  ]
}

function cmdNetstat(): string[] {
  return [
    'Proto  Local Address          State',
    'tcp    0.0.0.0:22             LISTEN',
    'tcp    0.0.0.0:80             LISTEN',
    'tcp    0.0.0.0:443            LISTEN',
    'tcp    0.0.0.0:4444           LISTEN   backdoor-agent',
    'tcp    127.0.0.1:3306         LISTEN',
    'tcp    10.0.2.15:22           ESTABLISHED',
  ]
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
  const pages: Record<string, string[]> = {
    grep: [
      '\x1b[1mGREP(1)\x1b[0m — Search files for a pattern',
      '',
      'USAGE: grep [OPTION]... PATTERN [FILE]...',
      '',
      '  -i   Case-insensitive',
      '  -n   Show line numbers',
      '  -r   Recurse into subdirectories',
      '  -v   Invert match',
      '  -c   Count only',
      '  -l   List filenames only',
    ],
    find: [
      '\x1b[1mFIND(1)\x1b[0m — Walk a file hierarchy',
      '',
      'USAGE: find [PATH] [OPTION]',
      '',
      '  -name "*.txt"   Name pattern',
      '  -type f         Files only',
      '  -type d         Directories only',
      '  -perm -4000     SUID bit set',
      '  2>/dev/null     Suppress errors',
    ],
    chmod: [
      '\x1b[1mCHMOD(1)\x1b[0m — Change file permissions',
      '',
      'USAGE: chmod [MODE] FILE',
      '',
      '  +x  Add execute',
      '  -x  Remove execute',
      '  755 rwxr-xr-x (script default)',
      '  644 rw-r--r--  (file default)',
      '  400 r--------  (read-only owner)',
      '  777 rwxrwxrwx  (full access)',
    ],
    awk: [
      '\x1b[1mAWK(1)\x1b[0m — Pattern scanning and processing',
      '',
      "USAGE: awk 'PROGRAM' [FILE]",
      '',
      "  '{print $1}'                First column",
      "  '{print $NF}'               Last column",
      "  '{sum+=$1} END{print sum}'  Sum",
      "  '/PATTERN/{print}'          Lines matching",
    ],
  }

  const page = pages[args[0] ?? '']
  if (!page) return [`\x1b[31mman: '${args[0]}': no manual entry\x1b[0m`]
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
  const node = resolve(ctx, file)
  if (!node || node.type !== 'file') return [`\x1b[31mpython3: ${file}: No such file or directory\x1b[0m`]

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
  const ports = args.find(a => a.startsWith('-p'))?.slice(2) ?? '1-1000'
  return [
    ...simHeader('Nmap', '7.94'),
    `\x1b[90mStarting Nmap scan on ${target} (ports: ${ports})\x1b[0m`,
    '',
    `Host: \x1b[1;32m${target}\x1b[0m  Status: \x1b[32mUp\x1b[0m  Latency: 0.42ms`,
    '',
    '\x1b[1mPORT      STATE  SERVICE' + (isSV ? '    VERSION' : '') + '\x1b[0m',
    `22/tcp    \x1b[32mopen\x1b[0m   ssh      ${isSV ? 'OpenSSH 8.2p1 Ubuntu' : ''}`,
    `80/tcp    \x1b[32mopen\x1b[0m   http     ${isSV ? 'Apache httpd 2.4.41' : ''}`,
    `443/tcp   \x1b[32mopen\x1b[0m   https    ${isSV ? 'Apache httpd 2.4.41' : ''}`,
    `3306/tcp  \x1b[33mopen\x1b[0m   mysql    ${isSV ? 'MySQL 8.0.28' : ''}`,
    ...(isSC ? [
      '',
      '\x1b[90m| http-title: Welcome to the Lab\x1b[0m',
      '\x1b[90m| ssh-hostkey: 3072 RSA (2048-bit)\x1b[0m',
      '\x1b[90m|_http-server-header: Apache/2.4.41\x1b[0m',
    ] : []),
    '',
    `\x1b[90mNmap done: 1 IP (1 host up) scanned in 4.23 seconds\x1b[0m`,
  ]
}

function cmdWpscan(args: string[]): string[] {
  const url     = args.find(a => a.startsWith('http')) ?? 'https://target.com'
  const enumArg = args.find(a => a.startsWith('--enumerate'))
  const passwd  = args.includes('--passwords')
  return [
    ...simHeader('WPScan', '3.8.25'),
    `\x1b[90mScanning: ${url}\x1b[0m`,
    '',
    '\x1b[32m[+]\x1b[0m WordPress \x1b[1m6.4.2\x1b[0m detected',
    '\x1b[33m[!]\x1b[0m XML-RPC enabled → /xmlrpc.php',
    '\x1b[33m[!]\x1b[0m readme.html exposed',
    ...(enumArg ? [
      '',
      '\x1b[32m[+]\x1b[0m Users: admin (id:1), editor (id:2)',
      '\x1b[31m[!]\x1b[0m contact-form-7 4.9 — SQLi (CVE-2023-1234)',
      '\x1b[31m[!]\x1b[0m woocommerce 7.1 — XSS (CVE-2023-5678)',
    ] : []),
    ...(passwd ? [
      '',
      '\x1b[32m[FOUND]\x1b[0m  admin : \x1b[1mpassword123\x1b[0m',
    ] : []),
    '',
    '\x1b[90mScan complete.\x1b[0m',
  ]
}

function cmdNikto(args: string[]): string[] {
  const host = args.find(a => !a.startsWith('-')) ?? 'http://target.com'
  return [
    ...simHeader('Nikto', '2.1.6'),
    `\x1b[90mTarget: ${host}\x1b[0m`,
    '',
    '\x1b[32m+\x1b[0m Server: Apache/2.4.41 (Ubuntu)',
    '\x1b[33m+\x1b[0m /admin/ directory accessible',
    '\x1b[33m+\x1b[0m /backup.zip found — backup exposed!',
    '\x1b[31m+\x1b[0m X-Frame-Options missing → Clickjacking risk',
    '\x1b[33m+\x1b[0m /phpinfo.php → information disclosure',
    '\x1b[33m+\x1b[0m HTTP TRACE enabled → XST possible',
    '',
    '\x1b[90m6 findings. Duration: 00:01:23\x1b[0m',
  ]
}

function cmdSqlmap(args: string[]): string[] {
  const url = args.find(a => a.startsWith('http')) ?? 'http://target.com/?id=1'
  return [
    ...simHeader('sqlmap', '1.7.8'),
    `\x1b[90mTarget: ${url}\x1b[0m`,
    '',
    '\x1b[32m[+]\x1b[0m \x1b[1mid\x1b[0m parameter is vulnerable — Boolean-based blind SQLi',
    '    Payload: id=1 AND 1=1-- -',
    '',
    '\x1b[32m[+]\x1b[0m DBMS: MySQL >= 5.0',
    '\x1b[32m[+]\x1b[0m Databases: information_schema, \x1b[1mwebapp\x1b[0m, mysql',
    ...(args.includes('--dump') ? [
      '',
      '\x1b[32m[+]\x1b[0m webapp.users:',
      '    admin  |  5f4dcc3b5aa765d61d8327deb882cf99  (MD5: "password")',
      '    user1  |  482c811da5d5b4bc6d497ffa98491e38',
    ] : []),
    '',
    '\x1b[90mScan complete.\x1b[0m',
  ]
}

function cmdGobuster(cmd: string, args: string[]): string[] {
  const url = args.find(a => a.startsWith('http')) ?? 'http://target.com'
  return [
    ...simHeader(cmd, '3.6.0'),
    `\x1b[90mTarget: ${url}\x1b[0m`,
    '',
    `\x1b[32m/admin\x1b[0m         (Status: 200) [Size: 4821]`,
    `\x1b[32m/login\x1b[0m         (Status: 200) [Size: 1203]`,
    `\x1b[33m/backup\x1b[0m        (Status: 301) [→ /backup/]`,
    `\x1b[32m/uploads\x1b[0m       (Status: 200) [Size: 892]`,
    `\x1b[31m/.env\x1b[0m          (Status: 200) [Size: 118]  ← ATTENTION!`,
    `\x1b[32m/api\x1b[0m           (Status: 200) [Size: 44]`,
    '',
    '\x1b[90m6 paths discovered.\x1b[0m',
  ]
}

function cmdHydra(args: string[]): string[] {
  const target = args.find(a => !a.startsWith('-') && !a.startsWith('/') && a !== args[args.length - 1]) ?? 'target.com'
  const svc    = args[args.length - 1] ?? 'ssh'
  return [
    ...simHeader('Hydra', '9.5'),
    `\x1b[90mTarget: ${target}  Service: ${svc}\x1b[0m`,
    '',
    '\x1b[32m[DATA]\x1b[0m 16 tasks, dictionary attack...',
    '\x1b[32m[STATUS]\x1b[0m 1024 / 14,344 attempts',
    `\x1b[32m[FOUND]\x1b[0m  login: \x1b[1madmin\x1b[0m  password: \x1b[1mwinter2023\x1b[0m`,
    '',
    '\x1b[90m1 valid credential found. Duration: 00:02:11\x1b[0m',
  ]
}

function cmdHashcat(cmd: string, args: string[]): string[] {
  const hash = args.find(a => !a.startsWith('-')) ?? '5f4dcc3b5aa765d61d8327deb882cf99'
  const tool = cmd === 'john' ? 'John the Ripper' : 'Hashcat'
  const ver  = cmd === 'john' ? '1.9.0' : '6.2.6'
  return [
    ...simHeader(tool, ver),
    `\x1b[90mHash: ${hash.slice(0, 32)}\x1b[0m`,
    '',
    '\x1b[32m[*]\x1b[0m Type detected: MD5',
    '\x1b[32m[*]\x1b[0m Dictionary attack — 1,234,567 hash/sec',
    '\x1b[32m[CRACKED]\x1b[0m  \x1b[1mpassword\x1b[0m',
    '',
    '\x1b[90m1/1 hash cracked.\x1b[0m',
  ]
}

function cmdMsf(cmd: string): string[] {
  if (cmd === 'msfvenom') return [
    ...simHeader('msfvenom', '6.3.44'),
    '\x1b[90mUsage: msfvenom -p <payload> LHOST=<ip> LPORT=<port> -f <format>\x1b[0m',
    '',
    '  linux/x64/shell_reverse_tcp',
    '  windows/x64/meterpreter/reverse_tcp',
    '  php/meterpreter_reverse_tcp',
  ]
  return [
    '\x1b[1;31m       =[ metasploit v6.3.44 ]=\x1b[0m',
    '\x1b[90m+ -- --=[ 2369 exploits | 1232 auxiliary ]=-- -- +\x1b[0m',
    '',
    '\x1b[90mmsf6 >\x1b[0m \x1b[33mSimulation mode — real exploits cannot be executed.\x1b[0m',
  ]
}

function cmdAircrack(cmd: string, args: string[]): string[] {
  const iface = args.find(a => !a.startsWith('-')) ?? 'wlan0mon'
  if (cmd === 'airodump-ng') return [
    ...simHeader('airodump-ng', '1.7'),
    `\x1b[90mInterface: ${iface}  CH: 6\x1b[0m`,
    '',
    '\x1b[1m BSSID              PWR  CH  ENC   ESSID\x1b[0m',
    ' AA:BB:CC:DD:EE:FF  -42  6   WPA2  TargetNetwork',
    ' 11:22:33:44:55:66  -78  11  WPA2  HomeWifi',
  ]
  if (cmd === 'aireplay-ng') return [
    ...simHeader('aireplay-ng', '1.7'),
    'Sending DeAuth (code 7) to broadcast -- BSSID: AA:BB:CC:DD:EE:FF',
  ]
  return [
    ...simHeader('aircrack-ng', '1.7'),
    '\x1b[32m[*]\x1b[0m WPA handshake captured: AA:BB:CC:DD:EE:FF',
    '\x1b[32m[KEY FOUND!]\x1b[0m [ \x1b[1mwifi123456\x1b[0m ]',
  ]
}

function cmdEnum4linux(args: string[]): string[] {
  const target = args.find(a => !a.startsWith('-')) ?? '10.10.10.1'
  return [
    ...simHeader('enum4linux', '0.9.1'),
    `\x1b[90mTarget: ${target}\x1b[0m`,
    '',
    '\x1b[32m[*]\x1b[0m SMB Shares:',
    '    //10.10.10.1/ADMIN$  — Windows Remote Admin',
    '    //10.10.10.1/Share   — \x1b[32mAccessible\x1b[0m',
    '',
    '\x1b[32m[*]\x1b[0m Users: Administrator (500), Guest (501), \x1b[1moperator\x1b[0m (1001)',
    '',
    '\x1b[90mScan complete.\x1b[0m',
  ]
}

function cmdResponder(args: string[]): string[] {
  const iface = args.find(a => !a.startsWith('-')) ?? 'eth0'
  return [
    ...simHeader('Responder', '3.1.4.0'),
    `\x1b[90mInterface: ${iface}  LLMNR/NBT-NS poisoning active\x1b[0m`,
    '',
    '\x1b[32m[+]\x1b[0m LLMNR + NBT-NS Poisoner started',
    '\x1b[33m[SMB]\x1b[0m 10.10.10.50 — user: \x1b[1mDOMAIN\\john\x1b[0m',
    '\x1b[32m[HASH]\x1b[0m NTLMv2: john::DOMAIN:aad3b435...',
    '\x1b[90mCrack with hashcat: hashcat -m 5600 hash.txt rockyou.txt\x1b[0m',
  ]
}

function cmdNucleI(args: string[]): string[] {
  const target = args.find(a => !a.startsWith('-')) ?? 'https://target.com'
  return [
    ...simHeader('Nuclei', '3.1.0'),
    `\x1b[90mTarget: ${target}  8,432 templates\x1b[0m`,
    '',
    '\x1b[31m[critical]\x1b[0m CVE-2021-44228 Log4Shell — \x1b[1mVULNERABLE\x1b[0m',
    '\x1b[33m[high]\x1b[0m    CVE-2023-44487 HTTP/2 Rapid Reset',
    '\x1b[33m[medium]\x1b[0m  /server-status exposed',
    '\x1b[32m[info]\x1b[0m    PHP 8.1.12  |  nginx 1.24.0',
    '',
    '\x1b[90m4 findings. Duration: 00:00:47\x1b[0m',
  ]
}

function cmdAmass(cmd: string, args: string[]): string[] {
  const domain = args.find(a => !a.startsWith('-') && a.includes('.')) ?? 'target.com'
  return [
    ...simHeader(cmd, '4.2.0'),
    `\x1b[90mDomain: ${domain}\x1b[0m`,
    '',
    `\x1b[32m[+]\x1b[0m mail.${domain}`,
    `\x1b[32m[+]\x1b[0m api.${domain}`,
    `\x1b[32m[+]\x1b[0m dev.${domain}`,
    `\x1b[33m[+]\x1b[0m vpn.${domain}  ← VPN access`,
    `\x1b[33m[+]\x1b[0m jenkins.${domain}  ← CI/CD`,
    '',
    '\x1b[90m5 subdomains discovered.\x1b[0m',
  ]
}

function cmdTcpdump(cmd: string, _args: string[]): string[] {
  if (cmd === 'wireshark') return [
    '\x1b[33m[!]\x1b[0m Wireshark is a GUI application.',
    '\x1b[90m    For terminal: tcpdump -i eth0 -w capture.pcap\x1b[0m',
  ]
  return [
    ...simHeader('tcpdump', '4.99.4'),
    '\x1b[90mListening on eth0 ...\x1b[0m',
    '',
    '12:04:01  IP 10.10.10.1.443  > 10.10.10.50.52341  Flags [P.] len 512',
    '12:04:01  IP 10.10.10.50.52341 > 10.10.10.1.443   Flags [.] ack 513',
    '12:04:02  IP 10.10.10.100.80 > 10.10.10.50.43210  Flags [P.] len 1024',
    '\x1b[90m^C — press Ctrl+C to stop\x1b[0m',
  ]
}

function cmdNetcat(args: string[]): string[] {
  const listen = args.includes('-l') || args.some(a => a.includes('lvnp'))
  const port   = args.find(a => /^\d{2,5}$/.test(a)) ?? '4444'
  const target = args.find(a => /^\d{1,3}\.\d/.test(a)) ?? '10.10.10.1'
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
