export type UserRole = 'admin' | 'analyst' | 'viewer'

export type AlertStatus = 'new' | 'in_progress' | 'blocked' | 'resolved'

export type AlertPriority = 'P1' | 'P2' | 'P3' | 'P4'

export type AttackSeverity = 'critical' | 'high' | 'low'

export type ReportStatus = 'active' | 'archived'

export interface SessionUser {
  id: number
  username: string
  displayName: string
  role: UserRole
}
