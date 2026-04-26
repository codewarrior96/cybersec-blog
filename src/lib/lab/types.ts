// Filesystem

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

// Terminal

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

export type TerminalCommandSource = 'manual' | 'assisted'

export interface TerminalExecution {
  raw: string
  source: TerminalCommandSource
  cwdBefore: string
  cwdAfter: string
  output: string[]
  timestamp: number
}

// Lab Platform

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
  toolIds: string[]
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
  difficulty: Difficulty
  version: string
  os: string[]
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
  hints: string[]
  commands?: string[]
}

// Training Sets

export type LessonDifficulty = 'kolay' | 'orta' | 'zor'

export type LessonValidationType =
  | 'commandIncludesAll'
  | 'commandIncludesAny'
  | 'outputIncludes'
  | 'cwdEquals'

export interface LessonValidationCheck {
  id: string
  label: string
  type: LessonValidationType
  values: string[]
}

export interface LessonMission {
  objective: string
  operatorBrief: string
  task: string
  evidence: string[]
  hints: string[]
  reflection: string
  validation: LessonValidationCheck[]
}

export interface TrainingSetBriefing {
  heading: string
  summary: string
  pillars: string[]
  assessment: string
}

export interface Lesson {
  id: string
  title: string
  description: string
  difficulty: LessonDifficulty
  practiceCmd?: string
  duration: number
  mission?: LessonMission
}

export interface TrainingSet {
  id: string
  title: string
  subtitle: string
  icon: string
  color: string
  overview?: TrainingSetBriefing
  lessons: Lesson[]
}

// Terminal Command Injection

export interface PendingCommand {
  cmd: string
  id: number
}
