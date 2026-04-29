import type { Challenge } from '@/lib/lab/types'

// ─── Challenges ───────────────────────────────────────────────────────────────

export const CHALLENGES: Challenge[] = [
  {
    level: 1,
    title: 'RECONNAISSANCE',
    path: 'challenges/01-recon',
    difficulty: 'EASY',
    color: '#00ff41',
    description: 'Inspect /etc/passwd with cat and wc -l to derive the user count of this host.',
    flagKey: 'FLAG{r3con_master_l1nux}',
    hints: [
      'Start by listing the system users: `cat /etc/passwd`.',
      'Count the lines with a pipeline: `cat /etc/passwd | wc -l` — chaining two commands together.',
      'Once the line count is derived, the flag will reveal in the terminal automatically — no manual file read required.',
    ],
    commands: ['cat /etc/passwd', 'cat /etc/passwd | wc -l'],
  },
  {
    level: 2,
    title: 'FILE PERMISSIONS',
    path: 'challenges/02-perms',
    difficulty: 'EASY',
    color: '#00ff41',
    description: 'Use chmod to add execute permission to a script and run it under bash.',
    flagKey: 'FLAG{ch4mod_p3rm1ss10ns}',
    hints: [
      'Inspect the current permissions with `ls -la`.',
      'Grant the execute bit with `chmod +x secret.sh`.',
      'Run the script with `bash secret.sh`. When the prerequisites are met, the flag will reveal in the terminal.',
    ],
    commands: ['ls -la', 'chmod +x secret.sh', 'bash secret.sh'],
  },
  {
    level: 3,
    title: 'HIDDEN FILES',
    path: 'challenges/03-hidden',
    difficulty: 'MEDIUM',
    color: '#f59e0b',
    description: 'Find a hidden (dot-prefixed) file in this directory and inspect its contents.',
    flagKey: 'FLAG{h1dden_1n_pl41n_s1ght}',
    hints: [
      'Surface the hidden entries with `ls -la` (dotfiles are filtered from a plain `ls`).',
      'Notice the new entry that appears alongside the decoy and visible files.',
      'Read the hidden file with `cat .vault`. The flag will reveal in the terminal once you do.',
    ],
    commands: ['ls -la', 'cat .vault'],
  },
  {
    level: 4,
    title: 'GREP MASTER',
    path: 'challenges/04-grep',
    difficulty: 'MEDIUM',
    color: '#f59e0b',
    description: 'Use grep to filter the access log and surface the line containing the flag.',
    flagKey: 'FLAG{gr3p_1s_p0w3r}',
    hints: [
      'Reading every log line is wasteful — filter for the keyword instead.',
      'Run `grep "FLAG" access.log` (or `grep -n "FLAG" access.log` for line numbers).',
      'When the matching line renders, the flag reveals in the terminal automatically.',
    ],
    commands: ['grep "FLAG" access.log', 'grep -n "FLAG" access.log'],
  },
  {
    level: 5,
    title: 'PRIVILEGE ESCALATION',
    path: 'challenges/05-privesc',
    difficulty: 'HARD',
    color: '#ef4444',
    description: 'Identify the privesc vector via sudo -l and execute a root-context read.',
    flagKey: 'FLAG{pr1v3sc_r00t_0wn3d}',
    hints: [
      'List allowed root commands with `sudo -l`. Notice the NOPASSWD entry.',
      'Discover SUID surface area with `find / -perm -4000 2>/dev/null`.',
      'Trigger the GTFOBins find vector: `sudo find . -exec cat target \\;`. When the chain executes, the flag reveals.',
    ],
    commands: ['sudo -l', 'find / -perm -4000 2>/dev/null', 'sudo find . -exec cat target \\;'],
  },
  {
    level: 6,
    title: 'NETWORK ANALYSIS',
    path: 'challenges/06-network',
    difficulty: 'HARD',
    color: '#ef4444',
    description: 'Identify the unusual listening port, then correlate it in the system log.',
    flagKey: 'FLAG{n3tw0rk_m4st3r_2024}',
    hints: [
      'List open sockets with `ss -tulpn` or `netstat -tulpn` — t=tcp, u=udp, l=listening, p=process, n=numeric.',
      'A non-standard port `0.0.0.0:4444` LISTEN looks suspicious for a blue-team triage.',
      'Correlate it in syslog: `grep 4444 /var/log/syslog`. The flag reveals once the activity is correlated.',
    ],
    commands: ['ss -tulpn', 'netstat -tulpn', 'grep 4444 /var/log/syslog'],
  },
]

