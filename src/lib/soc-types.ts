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
  /**
   * Email verification status. Surfaced in the session payload so edge
   * middleware can gate access (Phase 4 of email foundation) without
   * a per-request DB lookup. Defaults to false on stores that don't
   * yet persist email (memory, postgres pre-migration).
   */
  emailVerified: boolean
}
