import type { AlertPriority, AttackSeverity } from '@/lib/soc-types'

export function mapAttackTypeToTag(attackType: string): string {
  const value = attackType.toLowerCase()
  if (value.includes('port')) return 'scanner'
  if (value.includes('ssh')) return 'bruteforce'
  if (value.includes('sql')) return 'sqli'
  if (value.includes('rce')) return 'exploit'
  if (value.includes('ddos')) return 'botnet'
  if (value.includes('phishing')) return 'phishing'
  return 'threat'
}

export function severityToPriority(severity: AttackSeverity): AlertPriority {
  if (severity === 'critical') return 'P1'
  if (severity === 'high') return 'P2'
  return 'P3'
}

export function priorityWeight(priority: AlertPriority): number {
  if (priority === 'P1') return 4
  if (priority === 'P2') return 3
  if (priority === 'P3') return 2
  return 1
}

export function severityWeight(severity: AttackSeverity): number {
  if (severity === 'critical') return 4
  if (severity === 'high') return 2
  return 1
}

export function normalizeSeverity(value: string | null | undefined): AttackSeverity {
  if (value === 'critical') return 'critical'
  if (value === 'high') return 'high'
  return 'low'
}

export function clampNumber(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
