export type SerializedFSNode =
  | { type: 'file'; perms: string; content: string }
  | { type: 'dir'; perms: string; children: Record<string, SerializedFSNode> }

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface ChallengeRef {
  level: number
  id: string
  path: string
}

export interface ScenarioMetadata {
  estimatedTime: number
  tags: readonly string[]
  prerequisites: readonly string[]
}

export interface Scenario {
  id: string
  title: string
  description: string
  difficulty: Difficulty
  initialFs: SerializedFSNode
  challenges: readonly ChallengeRef[]
  metadata: ScenarioMetadata
}
