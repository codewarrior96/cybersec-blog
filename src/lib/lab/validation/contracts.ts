import type { EvidencePrimitive } from '../evidence'
import type { ValidationContract } from './types'

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
  { type: 'fact_derived', fact: 'passwd_line_count', method: 'wc' },
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
  { type: 'fact_derived', fact: 'passwd_line_count', method: 'awk' },
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
  { type: 'fact_derived', fact: 'passwd_line_count', method: 'grep' },
]

const passwdLineCountSolutions = [
  passwdLineCountViaPipeline,
  passwdLineCountViaWc,
  passwdLineCountViaAwk,
  passwdLineCountViaGrep,
] as const

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

const sudoListPrivileges: EvidencePrimitive = {
  type: 'command_executed_with_args',
  command: 'sudo',
  args: ['-l'],
}

const sudoFindExecCatPrivescFlag: EvidencePrimitive = {
  type: 'command_executed_with_args',
  command: 'sudo',
  args: ['find', '-exec', 'cat', 'flag.txt'],
  argMatch: 'ordered_subsequence',
  pathArgs: [{ index: 6, pathMatch: 'exact' }],
}

const privescViaSudoFind: EvidencePrimitive = {
  type: 'fact_derived',
  fact: 'privesc_via_sudo_find',
  method: 'sudo-find-exec',
}

const submitLevel5Flag: EvidencePrimitive = {
  type: 'flag_submitted',
  flag: 'FLAG{pr1v3sc_r00t_0wn3d}',
}

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

const suspiciousPortDiscovered: EvidencePrimitive = {
  type: 'fact_derived',
  fact: 'suspicious_port_4444',
}

const backdoorInvestigated: EvidencePrimitive = {
  type: 'fact_derived',
  fact: 'backdoor_investigated',
  method: 'grep-syslog',
}

const submitLevel6Flag: EvidencePrimitive = {
  type: 'flag_submitted',
  flag: 'FLAG{n3tw0rk_m4st3r_2024}',
}

const networkDiscoveryViaSs: readonly EvidencePrimitive[] = [
  { type: 'command_executed', command: 'ss' },
  suspiciousPortDiscovered,
]

const networkDiscoveryViaNetstat: readonly EvidencePrimitive[] = [
  { type: 'command_executed', command: 'netstat' },
  suspiciousPortDiscovered,
]

const backdoorGrepViaPort: readonly EvidencePrimitive[] = [
  {
    type: 'command_executed_with_args',
    command: 'grep',
    args: ['4444', '/var/log/syslog'],
    argMatch: 'ordered_subsequence',
    pathArgs: [{ index: 1, pathMatch: 'exact' }],
  },
  { type: 'file_read', path: '/var/log/syslog', via: 'grep' },
  backdoorInvestigated,
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
  backdoorInvestigated,
]

export const challengeContracts: Partial<Record<number, ValidationContract>> = {
  1: {
    required: [],
    sufficient: passwdLineCountSolutions,
    requiresBeforeReading: [
      {
        target: {
          path: '/home/operator/challenges/01-recon/flag.txt',
          pathMatch: 'exact',
        },
        anyOf: passwdLineCountSolutions,
      },
    ],
  },
  2: {
    required: [
      chmodSecretExecutable,
      bashSecretScript,
      submitLevel2Flag,
    ],
  },
  3: {
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
    required: [
      submitLevel5Flag,
      sudoListPrivileges,
      sudoFindExecCatPrivescFlag,
      privescViaSudoFind,
    ],
    requiresBeforeReading: [
      {
        target: {
          path: '/home/operator/challenges/05-privesc/flag.txt',
          pathMatch: 'exact',
        },
        all: [
          sudoListPrivileges,
          sudoFindExecCatPrivescFlag,
        ],
      },
    ],
  },
  6: {
    required: [
      submitLevel6Flag,
      suspiciousPortDiscovered,
      backdoorInvestigated,
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
        all: [
          suspiciousPortDiscovered,
          backdoorInvestigated,
        ],
      },
    ],
  },
}
