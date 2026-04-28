// Manual page registry for the BREACH LAB simulated terminal.
// Each entry produces a structured (NAME, SYNOPSIS, DESCRIPTION, OPTIONS,
// EXAMPLES, SEE ALSO) layout. Output kept under ~40 lines per page to
// avoid excessive bundle bloat while staying informative.

interface ManEntry {
  name: string
  section?: number
  synopsis: string
  description: string
  options: ReadonlyArray<readonly [string, string]>
  examples?: ReadonlyArray<readonly [string, string]>
  seeAlso?: readonly string[]
}

const PAGES: Record<string, ManEntry> = {
  ls: {
    name: 'ls — list directory contents',
    synopsis: 'ls [OPTION]... [FILE]...',
    description: 'List information about the FILEs (the current directory by default). Sort entries alphabetically.',
    options: [
      ['-a, --all', 'Do not ignore entries starting with .'],
      ['-l', 'Use a long listing format (perms, owner, size, date)'],
      ['-h, --human-readable', 'With -l, print sizes like 1K 234M 2G'],
      ['-A', 'List all except . and ..'],
      ['-R', 'List subdirectories recursively'],
      ['-S', 'Sort by file size, largest first'],
      ['-t', 'Sort by modification time, newest first'],
    ],
    examples: [
      ['ls -la', 'Long format including hidden files'],
      ['ls -lh /var/log', 'Human-readable sizes in /var/log'],
    ],
    seeAlso: ['find(1)', 'stat(1)', 'tree(1)'],
  },
  cd: {
    name: 'cd — change the working directory',
    synopsis: 'cd [DIR]',
    description: 'Change the shell working directory to DIR. With no argument, cd changes to $HOME.',
    options: [
      ['-', 'Change to the previous working directory ($OLDPWD)'],
      ['..', 'Change to the parent directory'],
      ['~', 'Change to $HOME'],
    ],
    examples: [
      ['cd /home/operator', 'Switch to operator home'],
      ['cd ..', 'Go up one level'],
      ['cd -', 'Toggle to previous directory'],
    ],
    seeAlso: ['pwd(1)', 'pushd(1)'],
  },
  cat: {
    name: 'cat — concatenate and print files',
    synopsis: 'cat [OPTION]... [FILE]...',
    description: 'Concatenate FILEs to standard output. With no FILE, or when FILE is -, read standard input.',
    options: [
      ['-n', 'Number all output lines'],
      ['-b', 'Number nonempty output lines'],
      ['-A', 'Show all (including non-printing chars)'],
      ['-E', 'Display $ at end of each line'],
      ['-T', 'Display TAB characters as ^I'],
    ],
    examples: [
      ['cat /etc/passwd', 'Print user database'],
      ['cat a.txt b.txt > combined.txt', 'Concatenate two files'],
    ],
    seeAlso: ['head(1)', 'tail(1)', 'tac(1)', 'less(1)'],
  },
  grep: {
    name: 'grep — print lines matching a pattern',
    synopsis: 'grep [OPTION]... PATTERN [FILE]...',
    description: 'Search for PATTERN in each FILE. PATTERN is, by default, a basic regular expression.',
    options: [
      ['-i', 'Case-insensitive matching'],
      ['-n', 'Prefix each line with line number'],
      ['-r, -R', 'Recurse into directories'],
      ['-v', 'Invert match (non-matching lines)'],
      ['-c', 'Print only count of matching lines'],
      ['-l', 'Print only filenames with matches'],
      ['-E', 'Use extended regex (egrep)'],
      ['-w', 'Match only whole words'],
    ],
    examples: [
      ['grep "ERROR" /var/log/syslog', 'Find ERROR lines'],
      ['grep -rn "TODO" src/', 'Recursive search with line numbers'],
      ['ps aux | grep nginx', 'Filter process list'],
    ],
    seeAlso: ['awk(1)', 'sed(1)', 'rg(1)'],
  },
  find: {
    name: 'find — search for files in a directory hierarchy',
    synopsis: 'find [PATH...] [EXPRESSION]',
    description: 'Walk the file hierarchy starting at PATH and evaluate EXPRESSION against every file.',
    options: [
      ['-name PATTERN', 'Filename matches glob PATTERN'],
      ['-type f|d|l', 'Files / directories / symlinks'],
      ['-perm MODE', 'Permissions match (e.g. -4000 = SUID)'],
      ['-size +1M', 'Larger than 1 megabyte'],
      ['-mtime -7', 'Modified within 7 days'],
      ['-exec CMD {} \\;', 'Run CMD against each match'],
      ['-delete', 'Delete each match (be careful)'],
    ],
    examples: [
      ['find / -perm -4000 2>/dev/null', 'Find SUID binaries'],
      ['find . -name "*.log" -mtime -1', 'Recent log files'],
      ['find /tmp -type f -delete', 'Clean /tmp files'],
    ],
    seeAlso: ['locate(1)', 'xargs(1)'],
  },
  awk: {
    name: 'awk — pattern scanning and processing language',
    synopsis: "awk 'PROGRAM' [FILE...]",
    description: 'awk scans each input file for lines matching any pattern and applies the corresponding action.',
    options: [
      ['-F SEP', 'Set field separator (default whitespace)'],
      ['-v VAR=VAL', 'Define variable before program'],
      ['-f FILE', 'Read program from FILE'],
    ],
    examples: [
      ["awk '{print $1}'", 'Print first column'],
      ["awk -F: '{print $1}' /etc/passwd", 'List usernames'],
      ["awk 'END{print NR}'", 'Print line count at end'],
      ["awk '/ERROR/'", 'Print lines matching ERROR'],
    ],
    seeAlso: ['sed(1)', 'grep(1)', 'cut(1)'],
  },
  sed: {
    name: 'sed — stream editor for filtering and transforming text',
    synopsis: 'sed [OPTION]... SCRIPT [FILE]...',
    description: 'sed reads input line by line, transforms it according to SCRIPT and writes to stdout.',
    options: [
      ['-i', 'Edit files in place'],
      ['-e SCRIPT', 'Add the script to the commands'],
      ['-n', 'Suppress automatic output'],
      ['-r, -E', 'Use extended regex'],
    ],
    examples: [
      ["sed 's/old/new/g' file.txt", 'Replace all occurrences'],
      ["sed -i 's/v1/v2/g' *.conf", 'In-place replace across files'],
      ["sed -n '5,10p' file.txt", 'Print lines 5 through 10'],
      ["sed '/^#/d'", 'Delete comment lines'],
    ],
    seeAlso: ['awk(1)', 'tr(1)', 'perl(1)'],
  },
  sudo: {
    name: 'sudo — execute a command as another user',
    synopsis: 'sudo [OPTION]... COMMAND',
    description: 'sudo allows a permitted user to execute a command as the superuser or another user.',
    options: [
      ['-l', 'List allowed (and forbidden) commands for the user'],
      ['-u USER', 'Run as USER (default root)'],
      ['-i', 'Simulate initial login (start root shell)'],
      ['-s', 'Run shell as target user'],
      ['-k', 'Invalidate cached credentials'],
    ],
    examples: [
      ['sudo -l', 'List your sudo privileges'],
      ['sudo apt update', 'Run apt as root'],
      ['sudo -u www-data id', 'Run id as www-data'],
    ],
    seeAlso: ['su(1)', 'visudo(8)', 'sudoers(5)'],
  },
  chmod: {
    name: 'chmod — change file mode bits',
    synopsis: 'chmod [OPTION]... MODE FILE...',
    description: 'Change the access mode of each FILE to MODE. MODE may be symbolic (u+x) or octal (755).',
    options: [
      ['+x', 'Add execute bit for all'],
      ['u+rwx', 'Owner read/write/execute'],
      ['755', 'rwxr-xr-x (script default)'],
      ['644', 'rw-r--r-- (file default)'],
      ['-R', 'Recurse into directories'],
    ],
    examples: [
      ['chmod +x script.sh', 'Make script executable'],
      ['chmod 644 config.txt', 'Owner write, others read'],
      ['chmod -R 750 /var/www', 'Recursive permission set'],
    ],
    seeAlso: ['chown(1)', 'umask(1)', 'stat(1)'],
  },
  chown: {
    name: 'chown — change file owner and group',
    synopsis: 'chown [OPTION]... [OWNER][:[GROUP]] FILE...',
    description: 'Change the ownership of each FILE to OWNER and optionally GROUP.',
    options: [
      ['-R', 'Operate recursively'],
      ['user:group', 'Set both owner and group'],
      [':group', 'Change only group'],
    ],
    examples: [
      ['chown alice file.txt', 'Set owner to alice'],
      ['chown www-data:www-data /var/www', 'Web server ownership'],
      ['chown -R operator:operator /home/operator', 'Recursive home fix'],
    ],
    seeAlso: ['chmod(1)', 'chgrp(1)'],
  },
  ps: {
    name: 'ps — report a snapshot of current processes',
    synopsis: 'ps [OPTIONS]',
    description: 'Display information about a selection of the active processes.',
    options: [
      ['aux', 'BSD style: all users, every process, with command'],
      ['-ef', 'Full listing in System V style'],
      ['-p PID', 'Show only the given PID'],
      ['-u USER', 'Filter by user'],
      ['--sort=-%cpu', 'Sort by descending CPU'],
    ],
    examples: [
      ['ps aux', 'List every process verbosely'],
      ['ps -ef | grep nginx', 'Find nginx workers'],
      ['ps aux --sort=-%mem | head', 'Top memory consumers'],
    ],
    seeAlso: ['top(1)', 'pgrep(1)', 'kill(1)'],
  },
  kill: {
    name: 'kill — send a signal to a process',
    synopsis: 'kill [-SIG] PID...',
    description: 'Send the specified signal (default TERM) to the listed processes.',
    options: [
      ['-9, -SIGKILL', 'Force-terminate (cannot be ignored)'],
      ['-15, -SIGTERM', 'Polite termination request (default)'],
      ['-1, -SIGHUP', 'Reload configuration (daemons)'],
      ['-l', 'List signal names and numbers'],
    ],
    examples: [
      ['kill 1234', 'Politely terminate PID 1234'],
      ['kill -9 1234', 'Force kill'],
      ['killall nginx', 'Kill every process named nginx'],
    ],
    seeAlso: ['ps(1)', 'killall(1)', 'pkill(1)'],
  },
  top: {
    name: 'top — display Linux processes',
    synopsis: 'top [OPTIONS]',
    description: 'Provide a dynamic real-time view of the running system.',
    options: [
      ['-b', 'Batch mode (script-friendly)'],
      ['-n N', 'Exit after N iterations'],
      ['-u USER', 'Filter by user'],
      ['-p PID', 'Monitor specific PIDs'],
    ],
    examples: [
      ['top', 'Interactive process monitor'],
      ['top -b -n 1', 'One-shot snapshot'],
      ['top -p 1234,5678', 'Watch specific PIDs'],
    ],
    seeAlso: ['htop(1)', 'ps(1)', 'iotop(1)'],
  },
  ssh: {
    name: 'ssh — OpenSSH remote login client',
    synopsis: 'ssh [OPTIONS] [user@]hostname [command]',
    description: 'Connect to a remote machine via the encrypted SSH protocol.',
    options: [
      ['-i KEY', 'Identity file (private key)'],
      ['-p PORT', 'Connect on a non-standard port'],
      ['-L L:H:P', 'Local port forward'],
      ['-D PORT', 'Dynamic SOCKS proxy'],
      ['-J HOST', 'Jump-host (proxy through bastion)'],
      ['-v', 'Verbose (debug); -vvv for max'],
    ],
    examples: [
      ['ssh user@10.0.0.1', 'Open shell on host'],
      ['ssh -i id_rsa -p 2222 user@host', 'Custom key + port'],
      ['ssh -L 8080:localhost:80 user@host', 'Local port forward'],
    ],
    seeAlso: ['scp(1)', 'sftp(1)', 'ssh-keygen(1)'],
  },
  scp: {
    name: 'scp — secure copy over SSH',
    synopsis: 'scp [OPTIONS] SRC DEST',
    description: 'Copy files between hosts on a network using SSH for authentication.',
    options: [
      ['-r', 'Recurse into directories'],
      ['-P PORT', 'Use non-default SSH port'],
      ['-i KEY', 'Identity file'],
      ['-p', 'Preserve modification times'],
    ],
    examples: [
      ['scp file.txt user@host:/tmp/', 'Upload to remote'],
      ['scp -r user@host:/etc/nginx ./', 'Recursive download'],
    ],
    seeAlso: ['ssh(1)', 'rsync(1)', 'sftp(1)'],
  },
  rsync: {
    name: 'rsync — fast incremental file transfer',
    synopsis: 'rsync [OPTIONS] SRC DEST',
    description: 'Copy files between local and remote hosts. Only transfers changed bytes.',
    options: [
      ['-a', 'Archive mode (recursive + perms + timestamps)'],
      ['-v', 'Verbose'],
      ['-z', 'Compress data in transit'],
      ['--delete', 'Delete extra files on destination'],
      ['--dry-run', 'Show what would happen, do not change'],
      ['-e ssh', 'Specify remote shell'],
    ],
    examples: [
      ['rsync -avz src/ host:/backup/', 'Sync to remote'],
      ['rsync -avh --delete src/ dst/', 'Mirror locally'],
    ],
    seeAlso: ['scp(1)', 'cp(1)', 'tar(1)'],
  },
  tar: {
    name: 'tar — archive utility',
    synopsis: 'tar [OPTIONS] ARCHIVE [FILES...]',
    description: 'Manipulate tar archives — create, extract, list, append.',
    options: [
      ['-c', 'Create a new archive'],
      ['-x', 'Extract from archive'],
      ['-t', 'List contents'],
      ['-f FILE', 'Use archive FILE'],
      ['-z', 'gzip filter'],
      ['-j', 'bzip2 filter'],
      ['-J', 'xz filter'],
      ['-v', 'Verbose'],
    ],
    examples: [
      ['tar -czvf out.tar.gz src/', 'Create gzipped archive'],
      ['tar -xzvf out.tar.gz', 'Extract gzipped archive'],
      ['tar -tvf out.tar.gz', 'List contents'],
    ],
    seeAlso: ['gzip(1)', 'zip(1)', 'rsync(1)'],
  },
  gzip: {
    name: 'gzip — compress or expand files',
    synopsis: 'gzip [OPTIONS] [FILE...]',
    description: 'Reduce the size of FILE using Lempel–Ziv coding (LZ77).',
    options: [
      ['-d', 'Decompress (same as gunzip)'],
      ['-k', 'Keep original after compression'],
      ['-9', 'Best compression (slower)'],
      ['-1', 'Fastest compression'],
      ['-c', 'Write to stdout'],
    ],
    examples: [
      ['gzip file.txt', 'Compress to file.txt.gz'],
      ['gunzip file.txt.gz', 'Decompress'],
      ['gzip -9 -c big.log > big.log.gz', 'Best compression to stdout'],
    ],
    seeAlso: ['gunzip(1)', 'bzip2(1)', 'xz(1)', 'tar(1)'],
  },
  curl: {
    name: 'curl — transfer a URL',
    synopsis: 'curl [OPTIONS] URL...',
    description: 'Transfer data from or to a server using HTTP, HTTPS, FTP, SFTP and many more.',
    options: [
      ['-X METHOD', 'HTTP method (GET/POST/PUT/...)'],
      ['-d DATA', 'POST body'],
      ['-H HEADER', 'Custom request header'],
      ['-o FILE', 'Save response to FILE'],
      ['-O', 'Save with remote filename'],
      ['-L', 'Follow redirects'],
      ['-s', 'Silent (no progress bar)'],
      ['-k', 'Insecure (skip TLS verification)'],
    ],
    examples: [
      ['curl -O https://host/file', 'Download a file'],
      ['curl -H "Authorization: Bearer X" https://api/x', 'Auth header'],
      ['curl -X POST -d \'{"k":"v"}\' -H "Content-Type: application/json" URL', 'POST JSON'],
    ],
    seeAlso: ['wget(1)', 'httpie(1)'],
  },
  wget: {
    name: 'wget — retrieve files from the web',
    synopsis: 'wget [OPTIONS] URL...',
    description: 'Non-interactive network downloader. Supports HTTP, HTTPS, FTP and proxies.',
    options: [
      ['-r', 'Recursive download'],
      ['-c', 'Continue interrupted download'],
      ['-O FILE', 'Save to FILE'],
      ['--user-agent=AGENT', 'Custom User-Agent'],
      ['--limit-rate=N', 'Bandwidth limit'],
      ['--mirror', 'Suitable for site mirroring'],
    ],
    examples: [
      ['wget https://host/file.zip', 'Simple download'],
      ['wget -r -np -k https://docs.example.com/', 'Mirror docs'],
    ],
    seeAlso: ['curl(1)', 'rsync(1)'],
  },
  ping: {
    name: 'ping — send ICMP ECHO_REQUEST to network hosts',
    synopsis: 'ping [OPTIONS] HOST',
    description: 'Sends ICMP echo packets to HOST and reports response times.',
    options: [
      ['-c COUNT', 'Stop after COUNT packets'],
      ['-i INTERVAL', 'Wait INTERVAL seconds between packets'],
      ['-W TIMEOUT', 'Timeout per packet'],
      ['-s SIZE', 'Specify packet size'],
      ['-4 / -6', 'Force IPv4 / IPv6'],
    ],
    examples: [
      ['ping -c 4 example.com', 'Send 4 packets'],
      ['ping -i 0.2 -c 100 host', 'Stress test 100 packets'],
    ],
    seeAlso: ['traceroute(1)', 'mtr(1)', 'arping(8)'],
  },
  netstat: {
    name: 'netstat — print network connections, routing tables …',
    synopsis: 'netstat [OPTIONS]',
    description: 'Display network status. Considered legacy; ss is the modern replacement.',
    options: [
      ['-t', 'TCP connections'],
      ['-u', 'UDP connections'],
      ['-l', 'Listening sockets only'],
      ['-p', 'Show owning process (requires root)'],
      ['-n', 'Numeric output (no DNS lookup)'],
      ['-r', 'Routing table'],
    ],
    examples: [
      ['netstat -tulpn', 'Listening TCP+UDP with PIDs'],
      ['netstat -rn', 'Routing table numerically'],
    ],
    seeAlso: ['ss(8)', 'ip(8)', 'lsof(8)'],
  },
  ss: {
    name: 'ss — another utility to investigate sockets',
    synopsis: 'ss [OPTIONS] [FILTER]',
    description: 'Modern replacement for netstat. Reads from /proc/net for fast socket info.',
    options: [
      ['-t', 'TCP sockets'],
      ['-u', 'UDP sockets'],
      ['-l', 'Listening sockets'],
      ['-p', 'Show process information'],
      ['-n', 'Numeric (no name resolution)'],
      ['-a', 'All (listening + established)'],
    ],
    examples: [
      ['ss -tulpn', 'Listening TCP+UDP with PIDs'],
      ['ss -tan state established', 'Established TCP only'],
    ],
    seeAlso: ['netstat(8)', 'ip(8)', 'lsof(8)'],
  },
  ifconfig: {
    name: 'ifconfig — configure a network interface',
    synopsis: 'ifconfig [INTERFACE] [OPTIONS]',
    description: 'Display or configure network interfaces. Considered legacy; "ip addr" is preferred on modern systems.',
    options: [
      ['-a', 'Show all interfaces (incl. down)'],
      ['INTERFACE up/down', 'Bring interface up or down'],
      ['INTERFACE IP', 'Set IP address'],
      ['INTERFACE netmask MASK', 'Set netmask'],
    ],
    examples: [
      ['ifconfig', 'Show all up interfaces'],
      ['ifconfig eth0 up', 'Bring eth0 up'],
    ],
    seeAlso: ['ip(8)', 'route(8)', 'arp(8)'],
  },
  dig: {
    name: 'dig — DNS lookup utility',
    synopsis: 'dig [@SERVER] [DOMAIN] [TYPE] [OPTIONS]',
    description: 'Flexible DNS lookup tool — queries DNS records in detail.',
    options: [
      ['+short', 'Compact answer-only output'],
      ['+trace', 'Trace delegation from root'],
      ['+noall +answer', 'Show only the answer section'],
      ['-x IP', 'Reverse DNS lookup'],
    ],
    examples: [
      ['dig example.com', 'Default A record query'],
      ['dig example.com MX', 'Mail records'],
      ['dig +short example.com', 'Just the IP'],
      ['dig -x 8.8.8.8', 'Reverse DNS'],
    ],
    seeAlso: ['nslookup(1)', 'host(1)'],
  },
  nslookup: {
    name: 'nslookup — query DNS servers interactively',
    synopsis: 'nslookup [DOMAIN] [SERVER]',
    description: 'Query DNS records. Older but widely available.',
    options: [
      ['-type=TYPE', 'Record type (A, MX, NS, TXT…)'],
      ['-debug', 'Verbose mode'],
    ],
    examples: [
      ['nslookup example.com', 'Default A query'],
      ['nslookup -type=mx example.com', 'MX records'],
    ],
    seeAlso: ['dig(1)', 'host(1)'],
  },
  du: {
    name: 'du — estimate file space usage',
    synopsis: 'du [OPTION]... [FILE]...',
    description: 'Summarize disk usage of each FILE, recursively for directories.',
    options: [
      ['-h, --human-readable', 'Human-readable sizes (1K, 234M, 2G)'],
      ['-s, --summarize', 'Display only a total for each argument'],
      ['-a, --all', 'Include files (not just directories)'],
      ['-c, --total', 'Produce a grand total'],
      ['--max-depth=N', 'Only show entries up to N levels deep'],
    ],
    examples: [
      ['du -sh /var/log', 'Total size of /var/log'],
      ['du -h --max-depth=1 /home', 'One-level summary of /home'],
    ],
    seeAlso: ['df(1)', 'ls(1)'],
  },
  df: {
    name: 'df — report file system disk space usage',
    synopsis: 'df [OPTION]... [FILE]...',
    description: 'Show how much disk space is available on file systems.',
    options: [
      ['-h, --human-readable', 'Sizes in K, M, G'],
      ['-T', 'Print file system type'],
      ['-i', 'Show inode usage instead of blocks'],
      ['--total', 'Append a total row'],
    ],
    examples: [
      ['df -h', 'Human-readable sizes'],
      ['df -i', 'Inode usage'],
    ],
    seeAlso: ['du(1)', 'mount(8)'],
  },
  mount: {
    name: 'mount — mount a filesystem',
    synopsis: 'mount [OPTION]... [SOURCE] [TARGET]',
    description: 'Attach a filesystem to the directory tree. With no arguments, list current mounts.',
    options: [
      ['-t TYPE', 'Filesystem type (ext4, xfs, nfs, …)'],
      ['-o OPT', 'Mount options (rw, ro, noexec, …)'],
      ['-a', 'Mount everything in /etc/fstab'],
      ['-r', 'Read-only mount'],
    ],
    examples: [
      ['mount', 'List current mounts'],
      ['mount -t ext4 /dev/sdb1 /mnt', 'Mount disk'],
      ['mount -o remount,rw /', 'Remount root read-write'],
    ],
    seeAlso: ['umount(8)', 'fstab(5)', 'df(1)'],
  },
  history: {
    name: 'history — display the command history',
    synopsis: 'history [N]',
    description: 'Print the command history. With argument N, print the last N commands.',
    options: [
      ['N', 'Show last N commands'],
      ['-c', 'Clear in-memory history'],
      ['-w FILE', 'Write current history to FILE'],
    ],
    examples: [
      ['history', 'Show all history'],
      ['history 20', 'Last 20 commands'],
      ['!42', 'Re-run history entry 42'],
      ['!!', 'Repeat last command'],
    ],
    seeAlso: ['bash(1)', 'fc(1)'],
  },
  man: {
    name: 'man — an interface to the system reference manuals',
    synopsis: 'man [SECTION] PAGE',
    description: 'Look up the manual page for PAGE. SECTION restricts to a manual section (1=cmds, 5=files, 8=admin).',
    options: [
      ['-k REGEX', 'Search the manpage index (apropos)'],
      ['-f NAME', 'Equivalent to whatis NAME'],
      ['SECTION', '1=user cmds, 2=syscalls, 5=files, 8=admin'],
    ],
    examples: [
      ['man ls', 'Manual for ls'],
      ['man 5 fstab', 'Section-5 manual for fstab'],
    ],
    seeAlso: ['apropos(1)', 'whatis(1)', 'info(1)'],
  },
  whoami: {
    name: 'whoami — print effective userid',
    synopsis: 'whoami',
    description: 'Print the user name associated with the current effective user ID.',
    options: [],
    examples: [['whoami', 'Print current username']],
    seeAlso: ['id(1)', 'who(1)', 'logname(1)'],
  },
  uname: {
    name: 'uname — print system information',
    synopsis: 'uname [OPTION]...',
    description: 'Print system information about the running kernel.',
    options: [
      ['-a', 'All available information'],
      ['-r', 'Kernel release'],
      ['-s', 'Kernel name'],
      ['-m', 'Machine architecture'],
    ],
    examples: [
      ['uname -a', 'Full kernel info'],
      ['uname -r', 'Kernel release only'],
    ],
    seeAlso: ['hostnamectl(1)', 'lsb_release(1)'],
  },
}

const ALIASES: Record<string, string> = {
  egrep: 'grep',
  fgrep: 'grep',
  vi: 'vim',
  gunzip: 'gzip',
  ll: 'ls',
}

function dashes(n: number): string {
  return '─'.repeat(n)
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

function renderPage(cmd: string, page: ManEntry): string[] {
  const head = `${cmd.toUpperCase()}(${page.section ?? 1})`
  const lines: string[] = [
    `\x1b[1m${head}\x1b[0m  ${dashes(56 - head.length)}  Linux User Manual`,
    '',
    '\x1b[1mNAME\x1b[0m',
    `       ${page.name}`,
    '',
    '\x1b[1mSYNOPSIS\x1b[0m',
    `       \x1b[36m${page.synopsis}\x1b[0m`,
    '',
    '\x1b[1mDESCRIPTION\x1b[0m',
  ]

  // Wrap description at ~70 chars
  const words = page.description.split(/\s+/)
  let line = '       '
  for (const w of words) {
    if (line.length + w.length + 1 > 78) {
      lines.push(line)
      line = '       ' + w
    } else {
      line = line === '       ' ? line + w : line + ' ' + w
    }
  }
  if (line.trim()) lines.push(line)

  if (page.options.length > 0) {
    lines.push('', '\x1b[1mOPTIONS\x1b[0m')
    for (const [flag, desc] of page.options) {
      lines.push(`       \x1b[32m${pad(flag, 22)}\x1b[0m ${desc}`)
    }
  }

  if (page.examples && page.examples.length > 0) {
    lines.push('', '\x1b[1mEXAMPLES\x1b[0m')
    for (const [example, note] of page.examples) {
      lines.push(`       \x1b[33m${example}\x1b[0m`)
      lines.push(`           \x1b[90m${note}\x1b[0m`)
    }
  }

  if (page.seeAlso && page.seeAlso.length > 0) {
    lines.push('', '\x1b[1mSEE ALSO\x1b[0m', `       ${page.seeAlso.join(', ')}`)
  }

  lines.push('', '\x1b[90mManual page ' + cmd + '(' + (page.section ?? 1) + ')\x1b[0m')
  return lines
}

/** Returns a structured manual page rendering, or null if not found. */
export function getManPage(rawCmd: string): string[] | null {
  if (!rawCmd) return null
  const cmd = rawCmd.toLowerCase()
  const target = ALIASES[cmd] ?? cmd
  const page = PAGES[target]
  if (!page) return null
  return renderPage(target, page)
}

/** Total number of distinct man pages registered (excluding aliases). */
export function manPageCount(): number {
  return Object.keys(PAGES).length
}

/** List the names of all registered manual pages — used by tab completion. */
export function listManPages(): readonly string[] {
  return [...Object.keys(PAGES), ...Object.keys(ALIASES)].sort()
}
