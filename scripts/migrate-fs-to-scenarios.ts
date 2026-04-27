import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT } from '../src/lib/lab/filesystem'
import type { FSNode } from '../src/lib/lab/types'
import type { Difficulty, Scenario, SerializedFSNode } from '../src/lib/lab/scenarios'

const CHALLENGES = [
  {
    id: '01-recon',
    level: 1,
    title: 'Recon Basics',
    description: 'System discovery with /etc/passwd and line-count validation.',
    difficulty: 'beginner',
    estimatedTime: 10,
    tags: ['linux', 'recon', 'filesystem'],
    prerequisites: [],
  },
  {
    id: '02-perms',
    level: 2,
    title: 'File Permissions',
    description: 'Permission inspection and executable script workflow.',
    difficulty: 'beginner',
    estimatedTime: 12,
    tags: ['linux', 'permissions', 'chmod'],
    prerequisites: ['01-recon'],
  },
  {
    id: '03-hidden',
    level: 3,
    title: 'Hidden Files',
    description: 'Discovery of dotfiles through expanded directory listing.',
    difficulty: 'intermediate',
    estimatedTime: 12,
    tags: ['linux', 'hidden-files', 'enumeration'],
    prerequisites: ['01-recon'],
  },
  {
    id: '04-grep',
    level: 4,
    title: 'Grep Analysis',
    description: 'Log filtering with grep and pattern-based triage.',
    difficulty: 'intermediate',
    estimatedTime: 14,
    tags: ['linux', 'grep', 'logs'],
    prerequisites: ['01-recon'],
  },
  {
    id: '05-privesc',
    level: 5,
    title: 'Privilege Escalation',
    description: 'Sudo discovery and GTFOBins-style find execution path.',
    difficulty: 'advanced',
    estimatedTime: 18,
    tags: ['linux', 'sudo', 'privesc', 'gtfobins'],
    prerequisites: ['02-perms'],
  },
  {
    id: '06-network',
    level: 6,
    title: 'Network Analysis',
    description: 'Suspicious port discovery and syslog correlation.',
    difficulty: 'advanced',
    estimatedTime: 18,
    tags: ['linux', 'network', 'syslog', 'blue-team'],
    prerequisites: ['04-grep'],
  },
] as const satisfies readonly {
  id: string
  level: number
  title: string
  description: string
  difficulty: Difficulty
  estimatedTime: number
  tags: readonly string[]
  prerequisites: readonly string[]
}[]

const FORCE_FLAG = '--force'

if (!process.argv.includes(FORCE_FLAG)) {
  console.warn('⚠️  This script will OVERWRITE existing scenario JSON files.')
  console.warn('   Manual changes to scenario files will be LOST.')
  console.warn(`   Re-run with: ${FORCE_FLAG}`)
  process.exit(1)
}

function cloneFsNode(node: FSNode): SerializedFSNode {
  if (node.type === 'file') {
    return {
      type: 'file',
      perms: node.perms,
      content: node.content,
    }
  }

  const children: Record<string, SerializedFSNode> = {}

  for (const [name, child] of Object.entries(node.children)) {
    children[name] = cloneFsNode(child)
  }

  return {
    type: 'dir',
    perms: node.perms,
    children,
  }
}

function assertDir(node: FSNode | SerializedFSNode, path: string): Extract<SerializedFSNode, { type: 'dir' }> {
  if (node.type !== 'dir') {
    throw new Error(`Expected directory at ${path}`)
  }

  return node as Extract<SerializedFSNode, { type: 'dir' }>
}

function getDir(root: SerializedFSNode, path: readonly string[]): Extract<SerializedFSNode, { type: 'dir' }> {
  let current = assertDir(root, '/')

  for (const segment of path) {
    const child = current.children[segment]
    if (!child) {
      throw new Error(`Missing directory segment: /${path.join('/')}`)
    }

    current = assertDir(child, `/${path.join('/')}`)
  }

  return current
}

function createBaseFs(): SerializedFSNode {
  const base = cloneFsNode(ROOT)
  const challengesDir = getDir(base, ['home', 'operator', 'challenges'])

  for (const challenge of CHALLENGES) {
    delete challengesDir.children[challenge.id]
  }

  return base
}

function createChallengeFs(challengeId: string): SerializedFSNode {
  const root = assertDir(cloneFsNode(ROOT), '/')
  const home: SerializedFSNode = { type: 'dir', perms: 'drwxr-xr-x', children: {} }
  const operator: SerializedFSNode = { type: 'dir', perms: 'drwxr-xr-x', children: {} }
  const challenges: SerializedFSNode = { type: 'dir', perms: 'drwxr-xr-x', children: {} }

  const sourceChallenges = getDir(cloneFsNode(ROOT), ['home', 'operator', 'challenges'])
  const challengeNode = sourceChallenges.children[challengeId]

  if (!challengeNode) {
    throw new Error(`Challenge not found in ROOT: ${challengeId}`)
  }

  assertDir(challenges, '/home/operator/challenges').children[challengeId] = challengeNode
  assertDir(operator, '/home/operator').children.challenges = challenges
  assertDir(home, '/home').children.operator = operator
  root.children = { home }

  return root
}

function createScenario(challenge: (typeof CHALLENGES)[number]): Scenario {
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    difficulty: challenge.difficulty,
    initialFs: createChallengeFs(challenge.id),
    challenges: [
      {
        level: challenge.level,
        id: challenge.id,
        path: `/home/operator/challenges/${challenge.id}`,
      },
    ],
    metadata: {
      estimatedTime: challenge.estimatedTime,
      tags: challenge.tags,
      prerequisites: challenge.prerequisites,
    },
  }
}

function createBaseScenario(): Scenario {
  return {
    id: '_base',
    title: 'BREACH LAB Base Filesystem',
    description: 'Shared Linux training environment used by all BREACH LAB scenarios.',
    difficulty: 'beginner',
    initialFs: createBaseFs(),
    challenges: [],
    metadata: {
      estimatedTime: 0,
      tags: ['base', 'filesystem', 'shared'],
      prerequisites: [],
    },
  }
}

async function writeJson(filePath: string, value: Scenario): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const outputDir = join(repoRoot, 'src', 'content', 'scenarios')

  await writeJson(join(outputDir, '_base.json'), createBaseScenario())

  for (const challenge of CHALLENGES) {
    await writeJson(join(outputDir, `${challenge.id}.json`), createScenario(challenge))
  }

  console.log(`Generated ${CHALLENGES.length + 1} scenario JSON files in ${outputDir}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
