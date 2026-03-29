// ─── Filesystem ───────────────────────────────────────────────────────────────

export interface FileNode {
  type: 'file'
  perms: string
  content: string
}

export interface DirNode {
  type: 'dir'
  perms: string
  children: Record<string, FSNode>
}

export type FSNode = FileNode | DirNode

// ─── Terminal ─────────────────────────────────────────────────────────────────

export interface TerminalLine {
  id: number
  text: string
  isPrompt?: boolean
}

export interface CommandContext {
  cwd: string
  setCwd: (path: string) => void
  history: string[]
}

// ─── Lab Platform ─────────────────────────────────────────────────────────────

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export interface Module {
  id: string
  title: string
  subtitle: string
  difficulty: Difficulty
  color: string
  icon: string
  topics: string[]
  resources: Resource[]
}

export interface Resource {
  label: string
  url: string
}

export interface ToolCard {
  id: string
  name: string
  category: string
  description: string
  install: string
  flags: Flag[]
  examples: Example[]
  tags: string[]
}

export interface Flag {
  flag: string
  description: string
}

export interface Example {
  command: string
  description: string
}

export interface Challenge {
  level: number
  title: string
  path: string
  difficulty: 'KOLAY' | 'ORTA' | 'ZOR' | 'EXPERT'
  color: string
  description: string
  flagKey: string
}
