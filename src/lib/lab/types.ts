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
  toolIds: string[]          // araç-modül çapraz bağlantı
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
  difficulty: Difficulty     // öğrenme zorluğu
  version: string            // ör: "7.94"
  os: string[]               // ör: ['Linux', 'Windows', 'macOS']
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
  hints: string[]            // 3 kademeli ipucu
}

// ─── Terminal Command Injection ────────────────────────────────────────────────

export interface PendingCommand {
  cmd: string
  id: number   // Date.now() — aynı komut tekrar gönderilebilsin
}
