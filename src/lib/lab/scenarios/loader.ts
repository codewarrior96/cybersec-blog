import type { Difficulty, Scenario } from './types'

export interface ScenarioListItem {
  id: string
  title: string
  difficulty: Difficulty
}

const SCENARIOS: readonly ScenarioListItem[] = [
  { id: '01-recon', title: 'Recon Basics', difficulty: 'beginner' },
  { id: '02-perms', title: 'File Permissions', difficulty: 'beginner' },
  { id: '03-hidden', title: 'Hidden Files', difficulty: 'intermediate' },
  { id: '04-grep', title: 'Grep Analysis', difficulty: 'intermediate' },
  { id: '05-privesc', title: 'Privilege Escalation', difficulty: 'advanced' },
  { id: '06-network', title: 'Network Analysis', difficulty: 'advanced' },
] as const

export function listScenarios(): readonly ScenarioListItem[] {
  return SCENARIOS
}

export async function loadScenario(id: string): Promise<Scenario> {
  switch (id) {
    case '01-recon':
      return (await import('@/content/scenarios/01-recon.json')).default as Scenario
    case '02-perms':
      return (await import('@/content/scenarios/02-perms.json')).default as Scenario
    case '03-hidden':
      return (await import('@/content/scenarios/03-hidden.json')).default as Scenario
    case '04-grep':
      return (await import('@/content/scenarios/04-grep.json')).default as Scenario
    case '05-privesc':
      return (await import('@/content/scenarios/05-privesc.json')).default as Scenario
    case '06-network':
      return (await import('@/content/scenarios/06-network.json')).default as Scenario
    default:
      throw new Error(`Unknown BREACH LAB scenario: ${id}`)
  }
}
