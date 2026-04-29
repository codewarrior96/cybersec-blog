import type { EvidencePrimitive } from '../evidence'
import type { ValidationContract } from './types'

// ─── L1: RECONNAISSANCE ──────────────────────────────────────────────────────
//
// Each "sufficient" group expresses a complete, observable command pattern.
// The engine emits the underlying primitives (command_executed_with_args,
// file_read, pipeline_used) universally; no CTF-specific inference required.

const passwdLineCountViaPipeline: readonly EvidencePrimitive[] = [
  { type: 'file_read', path: '/etc/passwd', via: 'cat' },
  { type: 'command_executed_with_args', command: 'wc', args: ['-l'] },
  { type: 'pipeline_used', commands: ['cat', 'wc'], pipelineMatch: 'ordered_subsequence' },
]

const passwdLineCountViaWc: readonly EvidencePrimitive[] = [
  {
    type: 'command_executed_with_args',
    command: 'wc',
    args: ['-l', '/etc/passwd'],
    argMatch: 'ordered_subsequence',
    pathArgs: [{ index: 1, pathMatch: 'exact' }],
  },
  { type: 'file_read', path: '/etc/passwd', via: 'wc' },
]

const passwdLineCountViaAwk: readonly EvidencePrimitive[] = [
  {
    type: 'command_executed_with_args',
    command: 'awk',
    args: ['END{print NR}', '/etc/passwd'],
    argMatch: 'ordered_subsequence',
    pathArgs: [{ index: 1, pathMatch: 'exact' }],
  },
  { type: 'file_read', path: '/etc/passwd', via: 'awk' },
]

const passwdLineCountViaGrep: readonly EvidencePrimitive[] = [
  {
    type: 'command_executed_with_args',
    command: 'grep',
    args: ['-c', '/etc/passwd'],
    argMatch: 'ordered_subsequence',
    pathArgs: [{ index: 1, pathMatch: 'exact' }],
  },
  { type: 'file_read', path: '/etc/passwd', via: 'grep' },
]

const passwdLineCountSolutions = [
  passwdLineCountViaPipeline,
  passwdLineCountViaWc,
  passwdLineCountViaAwk,
  passwdLineCountViaGrep,
] as const

// ─── L2: FILE PERMISSIONS ────────────────────────────────────────────────────

const chmodSecretExecutable: EvidencePrimitive = {
  type: 'command_executed_with_args',
  command: 'chmod',
  args: ['+x', '/home/operator/challenges/02-perms/secret.sh'],
  argMatch: 'ordered_subsequence',
  pathArgs: [{ index: 1, pathMatch: 'exact' }],
}

const bashSecretScript: EvidencePrimitive = {
  type: 'command_executed_with_args',
  command: 'bash',
  args: ['/home/operator/challenges/02-perms/secret.sh'],
  argMatch: 'ordered_subsequence',
  pathArgs: [{ index: 0, pathMatch: 'exact' }],
}

const submitLevel2Flag: EvidencePrimitive = {
  type: 'flag_submitted',
  flag: 'FLAG{ch4mod_p3rm1ss10ns}',
}

// ─── L5: PRIVILEGE ESCALATION ────────────────────────────────────────────────

const sudoListPrivileges: EvidencePrimitive = {
  type: 'command_executed_with_args',
  command: 'sudo',
  args: ['-l'],
}

// `sudo find … -exec cat …` IS the privesc vector — the underlying
// command pattern is the contract's source of truth (no fact_derived
// inference needed; pattern is fully declarative).
const sudoFindExecCatPrivescFlag: EvidencePrimitive = {
  type: 'command_executed_with_args',
  command: 'sudo',
  args: ['find', '-exec', 'cat'],
  argMatch: 'ordered_subsequence',
}

const submitLevel5Flag: EvidencePrimitive = {
  type: 'flag_submitted',
  flag: 'FLAG{pr1v3sc_r00t_0wn3d}',
}

// ─── L3: HIDDEN FILES ────────────────────────────────────────────────────────

const hiddenListViaLa: readonly EvidencePrimitive[] = [
  { type: 'command_executed_with_args', command: 'ls', args: ['-l', '-a'] },
]

const hiddenListViaA: readonly EvidencePrimitive[] = [
  { type: 'command_executed_with_args', command: 'ls', args: ['-A'] },
]

const hiddenFileRead: EvidencePrimitive = {
  type: 'file_read',
  path: '/home/operator/challenges/03-hidden/.vault',
  via: 'cat',
}

const submitLevel3Flag: EvidencePrimitive = {
  type: 'flag_submitted',
  flag: 'FLAG{h1dden_1n_pl41n_s1ght}',
}

// ─── L4: GREP MASTER ─────────────────────────────────────────────────────────

const grepFlagAccessLog: readonly EvidencePrimitive[] = [
  {
    type: 'command_executed_with_args',
    command: 'grep',
    args: ['FLAG', '/home/operator/challenges/04-grep/access.log'],
    argMatch: 'ordered_subsequence',
    pathArgs: [{ index: 1, pathMatch: 'exact' }],
  },
  {
    type: 'file_read',
    path: '/home/operator/challenges/04-grep/access.log',
    via: 'grep',
  },
]

const grepFlagAccessLogWithLineNumber: readonly EvidencePrimitive[] = [
  {
    type: 'command_executed_with_args',
    command: 'grep',
    args: ['-n', 'FLAG', '/home/operator/challenges/04-grep/access.log'],
    argMatch: 'ordered_subsequence',
    pathArgs: [{ index: 2, pathMatch: 'exact' }],
  },
  {
    type: 'file_read',
    path: '/home/operator/challenges/04-grep/access.log',
    via: 'grep',
  },
]

const submitLevel4Flag: EvidencePrimitive = {
  type: 'flag_submitted',
  flag: 'FLAG{gr3p_1s_p0w3r}',
}

// ─── L6: NETWORK ANALYSIS ────────────────────────────────────────────────────
//
// Port discovery (ss/netstat) and log correlation (grep on syslog) used to be
// expressed as `fact_derived` inferences emitted by the engine. They are now
// captured declaratively by the underlying universal primitives the engine
// already emits for every command.

const netstatRun: EvidencePrimitive = { type: 'command_executed', command: 'netstat' }
const ssRun: EvidencePrimitive = { type: 'command_executed', command: 'ss' }

const submitLevel6Flag: EvidencePrimitive = {
  type: 'flag_submitted',
  flag: 'FLAG{n3tw0rk_m4st3r_2024}',
}

const networkDiscoveryViaSs: readonly EvidencePrimitive[] = [ssRun]

const networkDiscoveryViaNetstat: readonly EvidencePrimitive[] = [netstatRun]

const backdoorGrepViaPort: readonly EvidencePrimitive[] = [
  {
    type: 'command_executed_with_args',
    command: 'grep',
    args: ['4444', '/var/log/syslog'],
    argMatch: 'ordered_subsequence',
    pathArgs: [{ index: 1, pathMatch: 'exact' }],
  },
  { type: 'file_read', path: '/var/log/syslog', via: 'grep' },
]

const backdoorGrepViaLabel: readonly EvidencePrimitive[] = [
  {
    type: 'command_executed_with_args',
    command: 'grep',
    args: ['BACKDOOR', '/var/log/syslog'],
    argMatch: 'ordered_subsequence',
    pathArgs: [{ index: 1, pathMatch: 'exact' }],
  },
  { type: 'file_read', path: '/var/log/syslog', via: 'grep' },
]

export const challengeContracts: Partial<Record<number, ValidationContract>> = {
  1: {
    expectedFlag: 'FLAG{r3con_master_l1nux}',
    levelTitle: 'RECONNAISSANCE',
    required: [],
    sufficient: passwdLineCountSolutions,
  },
  2: {
    expectedFlag: 'FLAG{ch4mod_p3rm1ss10ns}',
    levelTitle: 'FILE PERMISSIONS',
    required: [
      chmodSecretExecutable,
      bashSecretScript,
      submitLevel2Flag,
    ],
  },
  3: {
    expectedFlag: 'FLAG{h1dden_1n_pl41n_s1ght}',
    levelTitle: 'HIDDEN FILES',
    required: [
      hiddenFileRead,
      submitLevel3Flag,
    ],
    sufficient: [
      hiddenListViaLa,
      hiddenListViaA,
    ],
    requiresBeforeReading: [
      {
        target: {
          path: '/home/operator/challenges/03-hidden/.vault',
          pathMatch: 'exact',
        },
        anyOf: [
          hiddenListViaLa,
          hiddenListViaA,
        ],
      },
    ],
  },
  4: {
    expectedFlag: 'FLAG{gr3p_1s_p0w3r}',
    levelTitle: 'GREP MASTER',
    required: [
      submitLevel4Flag,
    ],
    sufficient: [
      grepFlagAccessLog,
      grepFlagAccessLogWithLineNumber,
    ],
    requiresBeforeReading: [
      {
        target: {
          path: '/home/operator/challenges/04-grep/access.log',
          pathMatch: 'exact',
        },
        anyOf: [
          grepFlagAccessLog,
          grepFlagAccessLogWithLineNumber,
        ],
      },
    ],
  },
  5: {
    expectedFlag: 'FLAG{pr1v3sc_r00t_0wn3d}',
    levelTitle: 'PRIVILEGE ESCALATION',
    required: [
      submitLevel5Flag,
      sudoListPrivileges,
      sudoFindExecCatPrivescFlag,
    ],
  },
  6: {
    expectedFlag: 'FLAG{n3tw0rk_m4st3r_2024}',
    levelTitle: 'NETWORK ANALYSIS',
    required: [
      submitLevel6Flag,
    ],
    sufficient: [
      [...networkDiscoveryViaSs, ...backdoorGrepViaPort],
      [...networkDiscoveryViaSs, ...backdoorGrepViaLabel],
      [...networkDiscoveryViaNetstat, ...backdoorGrepViaPort],
      [...networkDiscoveryViaNetstat, ...backdoorGrepViaLabel],
    ],
    requiresBeforeReading: [
      {
        target: {
          path: '/var/log/syslog',
          pathMatch: 'exact',
        },
        // Port discovery (any of ss/netstat) must precede the syslog read.
        anyOf: [
          [ssRun],
          [netstatRun],
        ],
      },
    ],
  },
}
