import { resolvePath, getNode, basename, colorEntry, ROOT } from './filesystem'
import type { CommandContext, FSNode } from './types'

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

/** Flag doğrulama helper — CTFTab bağımsız kullanabilsin */
export function isValidFlag(flag: string): boolean {
  return VALID_FLAGS.has(flag.trim())
}

/** Runs a raw command string (supports pipes). Returns output lines. */
export function runCommand(raw: string, ctx: CommandContext): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  if (trimmed.includes(' | ')) {
    return runPipeline(trimmed.split(' | '), ctx)
  }

  return runSingle(trimmed, ctx, '')
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

function runPipeline(cmds: string[], ctx: CommandContext): string[] {
  let stdin = ''
  for (const cmd of cmds) {
    stdin = runSingle(cmd.trim(), ctx, stdin).join('\n')
  }
  return stdin.split('\n')
}

// ─── Single Command ───────────────────────────────────────────────────────────

function runSingle(raw: string, ctx: CommandContext, stdin: string): string[] {
  const tokens = tokenize(raw)
  const cmd    = tokens[0]?.toLowerCase() ?? ''
  const args   = tokens.slice(1).map(stripQuotes)

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
    case 'awk':          return cmdAwk(args, stdin)
    case 'sed':          return cmdSed(args, stdin)
    case 'strings':      return cmdStrings(args, ctx)
    case 'xxd':          return cmdXxd(args, ctx)
    case 'base64':       return cmdBase64(args, stdin)
    case 'file':         return cmdFile(args, ctx)
    case 'stat':         return cmdStat(args, ctx)
    case 'chmod':        return args.length >= 2 ? [`\x1b[32m✓ chmod ${args.join(' ')} \x1b[90m(simüle)\x1b[0m`] : ['\x1b[31mchmod: eksik argüman\x1b[0m']
    case 'mkdir':        return args.length ? [`\x1b[90m(simüle: mkdir ${args.join(' ')})\x1b[0m`] : ['\x1b[31mmkdir: eksik operand\x1b[0m']
    case 'touch':        return args.length ? [`\x1b[90m(simüle: touch ${args.join(' ')})\x1b[0m`] : ['\x1b[31mtouch: eksik operand\x1b[0m']
    case 'ps':           return cmdPs(args)
    case 'top': case 'htop': return cmdTop()
    case 'ifconfig': case 'ip': return cmdIfconfig()
    case 'netstat': case 'ss': return cmdNetstat()
    case 'ping':         return cmdPing(args)
    case 'curl': case 'wget': return cmdCurl(args)
    case 'sudo':         return cmdSudo(args)
    case 'man':          return cmdMan(args)
    case 'which':        return cmdWhich(args)
    case 'crontab':      return args.includes('-l') ? ['*/5 * * * * root /usr/bin/backup.sh', '0 3 * * 0 root /usr/bin/cleanup.sh'] : ['kullanım: crontab -l']
    case 'bash':         return cmdBash(args, ctx)
    case 'python3': case 'python': return cmdPython(args, ctx)
    case 'submit':       return cmdSubmit(args)
    case 'exit': case 'logout': return ['\x1b[90mGoodbye, Operator.\x1b[0m']
    case '':             return []
    default:             return [`\x1b[31mbash: ${cmd}: komut bulunamadı\x1b[0m`]
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tokenize(raw: string): string[] {
  return raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
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

function resolve(cwd: string, target = '.'): FSNode | null {
  return getNode(resolvePath(cwd, target))
}

// ─── Command Implementations ──────────────────────────────────────────────────

function cmdHelp(): string[] {
  return [
    '\x1b[1;32m┌── BREACH LAB — KOMUTLAR ─────────────────────────────────────┐\x1b[0m',
    '\x1b[32m│\x1b[0m \x1b[1mDOSYA\x1b[0m   ls [-la]  cd  pwd  cat  find  stat  file  tree',
    '\x1b[32m│\x1b[0m \x1b[1mMETİN\x1b[0m   grep  awk  sed  wc  head  tail  sort  uniq  strings',
    '\x1b[32m│\x1b[0m \x1b[1mSİSTEM\x1b[0m  whoami  id  uname  ps  top  env  history  crontab',
    '\x1b[32m│\x1b[0m \x1b[1mİZİN\x1b[0m    chmod  sudo -l  find -perm -4000',
    '\x1b[32m│\x1b[0m \x1b[1mAĞ\x1b[0m      ifconfig  netstat  ss  ping  curl',
    '\x1b[32m│\x1b[0m \x1b[1mARSİV\x1b[0m   xxd  base64  file  strings',
    '\x1b[32m│\x1b[0m \x1b[1mDİĞER\x1b[0m   man  which  bash  python3  submit <FLAG>  clear',
    '\x1b[1;32m└──────────────────────────────────────────────────────────────┘\x1b[0m',
    '\x1b[90mPipe desteği: cat log.txt | grep "ERROR" | wc -l\x1b[0m',
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
    'LANG=tr_TR.UTF-8',
  ]
}

function cmdLs(args: string[], ctx: CommandContext): string[] {
  const fl     = flags(args)
  const target = nonFlags(args)[0] ?? '.'
  const path   = resolvePath(ctx.cwd, target)
  const node   = getNode(path)

  if (!node) return [`\x1b[31mls: '${target}': yok\x1b[0m`]
  if (node.type === 'file') return [colorEntry(basename(path), node)]

  const showHidden = fl.includes('a') || fl.includes('A')
  const entries = Object.entries(node.children)
    .filter(([name]) => showHidden || !name.startsWith('.'))
    .sort(([a], [b]) => a.localeCompare(b))

  if (!fl.includes('l')) {
    return [entries.map(([name, child]) => colorEntry(name, child)).join('  ') || '(boş)']
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
  const node   = getNode(path)

  if (!node)              return [`\x1b[31mcd: '${target}': yok\x1b[0m`]
  if (node.type !== 'dir') return [`\x1b[31mcd: '${target}': dizin değil\x1b[0m`]

  ctx.setCwd(path)
  return []
}

function cmdCat(args: string[], ctx: CommandContext): string[] {
  const targets = nonFlags(args)
  if (!targets.length) return ['\x1b[90m(stdin bekliyor — Ctrl+C)\x1b[0m']

  return targets.flatMap(target => {
    const node = resolve(ctx.cwd, target)
    if (!node)              return [`\x1b[31mcat: ${target}: yok\x1b[0m`]
    if (node.type === 'dir') return [`\x1b[31mcat: ${target}: bir dizin\x1b[0m`]
    return node.content.split('\n')
  })
}

function cmdGrep(args: string[], ctx: CommandContext, stdin: string): string[] {
  const fl   = flags(args)
  const nf   = nonFlags(args)
  if (!nf.length) return ['\x1b[31mgrep: pattern belirtilmedi\x1b[0m']

  const [pattern, file] = nf
  const re = new RegExp(pattern, fl.includes('i') ? 'i' : '')

  let lines: string[]
  if (file) {
    const node = resolve(ctx.cwd, file)
    if (!node || node.type !== 'file') return [`\x1b[31mgrep: ${file}: yok\x1b[0m`]
    lines = node.content.split('\n')
  } else {
    lines = stdin.split('\n')
  }

  return lines
    .map((line, idx) => ({ line, idx: idx + 1 }))
    .filter(({ line }) => fl.includes('v') ? !re.test(line) : re.test(line))
    .map(({ line, idx }) => {
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
  const startNode  = getNode(startPath)

  if (!startNode) return [`\x1b[31mfind: '${rootTarget}': yok\x1b[0m`]

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

  const node = getNode(ctx.cwd)
  if (node?.type === 'dir') walk(node, '')
  return lines
}

function cmdWc(args: string[], ctx: CommandContext, stdin: string): string[] {
  const fl   = flags(args)
  const file = nonFlags(args)[0]
  let content = stdin

  if (file) {
    const node = resolve(ctx.cwd, file)
    if (!node || node.type !== 'file') return [`\x1b[31mwc: ${file}: yok\x1b[0m`]
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
    const node = resolve(ctx.cwd, file)
    if (!node || node.type !== 'file') return [`\x1b[31m${mode}: ${file}: yok\x1b[0m`]
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

function cmdAwk(args: string[], stdin: string): string[] {
  const program = nonFlags(args)[0] ?? ''
  const lines   = stdin.split('\n').filter(Boolean)

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
  if (!match) return ['\x1b[31msed: geçersiz ifade. Örn: s/eski/yeni/g\x1b[0m']
  const re = new RegExp(match[1], match[3])
  return stdin.split('\n').map(l => l.replace(re, match[2]))
}

function cmdStrings(args: string[], ctx: CommandContext): string[] {
  const file = args[0]
  if (!file) return ['\x1b[31mstrings: dosya belirtilmedi\x1b[0m']
  const node = resolve(ctx.cwd, file)
  if (!node || node.type !== 'file') return [`\x1b[31mstrings: ${file}: yok\x1b[0m`]
  return node.content.split('\n').filter(l => l.trim().length >= 4)
}

function cmdXxd(args: string[], ctx: CommandContext): string[] {
  const file = args[0]
  if (!file) return ['\x1b[31mxxd: dosya belirtilmedi\x1b[0m']
  const node = resolve(ctx.cwd, file)
  if (!node || node.type !== 'file') return [`\x1b[31mxxd: ${file}: yok\x1b[0m`]

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
    return ['\x1b[31mbase64: geçersiz giriş\x1b[0m']
  }
}

function cmdFile(args: string[], ctx: CommandContext): string[] {
  return args.map(target => {
    const node = resolve(ctx.cwd, target)
    if (!node) return `${target}: yok`
    if (node.type === 'dir') return `${target}: directory`
    if (target.endsWith('.sh'))  return `${target}: Bourne-Again shell script, ASCII text executable`
    if (target.endsWith('.py'))  return `${target}: Python script, ASCII text executable`
    if (target.endsWith('.txt')) return `${target}: ASCII text`
    return `${target}: regular file`
  })
}

function cmdStat(args: string[], ctx: CommandContext): string[] {
  const target = args[0]
  if (!target) return ['\x1b[31mstat: dosya belirtilmedi\x1b[0m']
  const node = resolve(ctx.cwd, target)
  if (!node) return [`\x1b[31mstat: '${target}': yok\x1b[0m`]
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
    '\x1b[90m(q çıkış — simüle)\x1b[0m',
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
  if (!url) return ['\x1b[31mcurl: URL belirtilmedi\x1b[0m']
  return [
    `\x1b[90m> GET ${url}\x1b[0m`,
    'HTTP/1.1 200 OK',
    'Content-Type: application/json',
    '{"status":"ok","server":"nginx","message":"pong"}',
  ]
}

function cmdSudo(args: string[]): string[] {
  if (args[0] === '-l') {
    return [
      'User operator may run the following commands on breach-lab:',
      '    (ALL : ALL) NOPASSWD: /usr/bin/vim',
      '    (root) /usr/bin/find',
    ]
  }
  return [
    `\x1b[33m[sudo] password for operator: ****\x1b[0m`,
    `\x1b[32m✓ Komut çalıştırıldı: ${args.join(' ')}\x1b[0m`,
  ]
}

function cmdMan(args: string[]): string[] {
  const pages: Record<string, string[]> = {
    grep: [
      '\x1b[1mGREP(1)\x1b[0m — Dosyalarda kalıp arama',
      '',
      'KULLANIM: grep [SEÇENEK]... DESEN [DOSYA]...',
      '',
      '  -i   Büyük/küçük duyarsız',
      '  -n   Satır numarası göster',
      '  -r   Alt dizinlere gir',
      '  -v   Eşleşmeyenleri göster',
      '  -c   Sadece sayıyı göster',
      '  -l   Sadece dosya adlarını göster',
    ],
    find: [
      '\x1b[1mFIND(1)\x1b[0m — Dosya hiyerarşisini tara',
      '',
      'KULLANIM: find [YOL] [SEÇENEK]',
      '',
      '  -name "*.txt"   İsim kalıbı',
      '  -type f         Sadece dosyalar',
      '  -type d         Sadece dizinler',
      '  -perm -4000     SUID biti aktif',
      '  2>/dev/null     Hata mesajlarını gizle',
    ],
    chmod: [
      '\x1b[1mCHMOD(1)\x1b[0m — Dosya izinlerini değiştir',
      '',
      'KULLANIM: chmod [MODE] DOSYA',
      '',
      '  +x  Çalıştırma ekle',
      '  -x  Çalıştırma kaldır',
      '  755 rwxr-xr-x (script standart)',
      '  644 rw-r--r--  (dosya standart)',
      '  400 r--------  (salt okunur)',
      '  777 rwxrwxrwx  (tam erişim)',
    ],
    awk: [
      '\x1b[1mAWK(1)\x1b[0m — Metin işleme dili',
      '',
      "KULLANIM: awk 'PROGRAM' [DOSYA]",
      '',
      "  '{print $1}'          1. sütun",
      "  '{print $NF}'         Son sütun",
      "  '{sum+=$1} END{print sum}'  Toplam",
      "  '/DESEN/{print}'      Eşleşen satırlar",
    ],
  }

  const page = pages[args[0] ?? '']
  if (!page) return [`\x1b[31mman: '${args[0]}': kılavuz yok\x1b[0m`]
  return page
}

function cmdWhich(args: string[]): string[] {
  const bins: Record<string, string> = {
    bash: '/bin/bash', python3: '/usr/bin/python3', grep: '/bin/grep',
    find: '/usr/bin/find', chmod: '/bin/chmod', sudo: '/usr/bin/sudo',
    nmap: '/usr/bin/nmap', curl: '/usr/bin/curl', nc: '/usr/bin/nc',
    netcat: '/usr/bin/nc', xxd: '/usr/bin/xxd',
  }
  return args.map(a => bins[a] ?? `\x1b[31m${a}: bulunamadı\x1b[0m`)
}

function cmdBash(args: string[], ctx: CommandContext): string[] {
  const file = args[0]
  if (!file) return ['\x1b[31mbash: dosya belirtilmedi\x1b[0m']
  const node = resolve(ctx.cwd, file)
  if (!node || node.type !== 'file') return [`\x1b[31mbash: ${file}: yok\x1b[0m`]

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
    return ['\x1b[90mPython 3.10.12 (simüle REPL)\x1b[0m', '>>> (python3 <dosya.py> ile çalıştır)']
  }
  const node = resolve(ctx.cwd, file)
  if (!node || node.type !== 'file') return [`\x1b[31mpython3: ${file}: yok\x1b[0m`]

  return [
    `\x1b[90m[python3 ${file}]\x1b[0m`,
    ...node.content
      .split('\n')
      .filter(l => l.includes('print('))
      .map(l => {
        const m = l.match(/print\((?:f?["'])(.+?)["']\)/)
        return m ? m[1].replace(/\{.*?\}/g, '[değer]') : ''
      })
      .filter(Boolean),
  ]
}

function cmdSubmit(args: string[]): string[] {
  const flag = args[0]
  if (!flag) return ['\x1b[31mKullanım: submit FLAG{...}\x1b[0m']
  if (VALID_FLAGS.has(flag)) {
    return [
      '\x1b[1;32m╔═══════════════════════════════╗\x1b[0m',
      '\x1b[1;32m║  ✓  BAYRAK KABUL EDİLDİ!     ║\x1b[0m',
      `\x1b[32m║  ${flag.padEnd(29)}║\x1b[0m`,
      '\x1b[1;32m╚═══════════════════════════════╝\x1b[0m',
    ]
  }
  return ['\x1b[31m✗ Geçersiz bayrak. Tekrar dene.\x1b[0m']
}
