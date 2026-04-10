import type { UserRole } from '@/lib/soc-types'

export type DomainKey =
  | 'core_operator'
  | 'blue_team'
  | 'red_team'
  | 'threat_research'
  | 'white_team'

export type CapabilityKey =
  | 'dashboard.view'
  | 'telemetry.view'
  | 'incident.create'
  | 'incident.update'
  | 'report.create'
  | 'report.archive'
  | 'report.delete'
  | 'community.access'
  | 'training.access'
  | 'portfolio.manage'
  | 'cve.view'
  | 'threatintel.view'
  | 'lab.offense'
  | 'lab.defense'
  | 'governance.view'

export interface DomainDefinition {
  key: DomainKey
  label: string
  shortLabel: string
  description: string
  accent: string
  surface: string
  defaultRoute: string
  capabilities: CapabilityKey[]
}

export const DOMAIN_ORDER: DomainKey[] = [
  'core_operator',
  'blue_team',
  'red_team',
  'threat_research',
  'white_team',
]

export const PLATFORM_DOMAINS: Record<DomainKey, DomainDefinition> = {
  core_operator: {
    key: 'core_operator',
    label: 'Core Operator',
    shortLabel: 'Core',
    description: 'Platforma giris, operator kimligi, profil ve ortak yetenek merkezi.',
    accent: '#39ff14',
    surface: 'matrix-green',
    defaultRoute: '/home',
    capabilities: [
      'dashboard.view',
      'community.access',
      'training.access',
      'portfolio.manage',
      'report.create',
      'report.archive',
    ],
  },
  blue_team: {
    key: 'blue_team',
    label: 'Blue Team',
    shortLabel: 'Blue',
    description: 'SOC, telemetry, incident response ve threat hunting odakli savunma alani.',
    accent: '#2dd4ff',
    surface: 'electric-blue',
    defaultRoute: '/home',
    capabilities: [
      'dashboard.view',
      'telemetry.view',
      'incident.create',
      'incident.update',
      'report.create',
      'report.archive',
      'cve.view',
      'threatintel.view',
      'community.access',
      'training.access',
    ],
  },
  red_team: {
    key: 'red_team',
    label: 'Red Team',
    shortLabel: 'Red',
    description: 'Adversary simulation, exploit zinciri ve saldiri pratiði odakli operasyon alani.',
    accent: '#ff5f56',
    surface: 'ember-red',
    defaultRoute: '/community',
    capabilities: [
      'community.access',
      'training.access',
      'lab.offense',
      'report.create',
      'report.archive',
      'portfolio.manage',
    ],
  },
  threat_research: {
    key: 'threat_research',
    label: 'Threat Research',
    shortLabel: 'Research',
    description: 'APT, malware, reverse engineering ve ileri tehdit arastirma alani.',
    accent: '#8b5cf6',
    surface: 'violet-obsidian',
    defaultRoute: '/zafiyet-taramasi',
    capabilities: [
      'threatintel.view',
      'cve.view',
      'report.create',
      'report.archive',
      'community.access',
      'training.access',
    ],
  },
  white_team: {
    key: 'white_team',
    label: 'White Team',
    shortLabel: 'White',
    description: 'Audit, governance, secure architecture ve uyumluluk odakli alan.',
    accent: '#d7e3f4',
    surface: 'silver-ice',
    defaultRoute: '/portfolio',
    capabilities: [
      'governance.view',
      'report.create',
      'report.archive',
      'portfolio.manage',
      'community.access',
      'training.access',
    ],
  },
}

export const ROLE_DOMAIN_ACCESS: Record<UserRole, DomainKey[]> = {
  admin: DOMAIN_ORDER,
  analyst: ['core_operator', 'blue_team', 'red_team', 'threat_research', 'white_team'],
  viewer: ['core_operator', 'blue_team', 'threat_research'],
}

export function getDomainDefinition(domain: DomainKey): DomainDefinition {
  return PLATFORM_DOMAINS[domain]
}

export function getDomainsForRole(role: UserRole): DomainDefinition[] {
  return ROLE_DOMAIN_ACCESS[role].map(getDomainDefinition)
}

export function getDefaultDomainForRole(role: UserRole): DomainDefinition {
  return getDomainDefinition(ROLE_DOMAIN_ACCESS[role][0])
}

export function hasDomainCapability(domain: DomainKey, capability: CapabilityKey): boolean {
  return PLATFORM_DOMAINS[domain].capabilities.includes(capability)
}
