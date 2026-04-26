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
}
