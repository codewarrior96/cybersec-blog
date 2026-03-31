import type { AlertPriority, AlertStatus } from './soc-types';

export interface CVEItem {
  id: string;
  description: string;
  severity: string | null;
  score: number | null;
  published?: string;
  lastModified?: string;
  references?: string[];
  weaknesses?: string | null;
}

export interface NewsItem {
  title: string;
  source: string;
}

export interface AttackEvent {
  id: number;
  time: string;
  createdAt: string;
  sourceIP: string;
  sourceCountry: string;
  targetPort: number;
  type: string;
  severity: 'critical' | 'high' | 'low';
}

export interface WorkflowMetrics {
  generatedAt: string;
  shiftSnapshot: {
    openCritical: number;
    unassigned: number;
    slaBreaches: number;
  };
  triageBoard: {
    new: number;
    inProgress: number;
    blocked: number;
    resolved: number;
  };
  sla: {
    p1FirstResponseMinutes: number;
    avgResolutionMinutes: number;
    breachCount: number;
  };
  attack: {
    topCountries: Array<{ name: string; count: number }>;
    topTags: Array<{ name: string; count: number }>;
    attacksPerMinute: number;
    activeIps: number;
    liveDensity: number;
    totalLast24h: number;
  };
}

export type AlarmQueueState = 'idle' | 'alarm_active' | 'queue_draining';

export type AlarmTransitionReason =
  | 'critical_ingest'
  | 'overlay_timeout'
  | 'queue_drained'
  | 'panel_closed'
  | 'manual_reset';

export interface CriticalIncident extends AttackEvent {
  detectedAt: string;
}

export interface AlarmTransition {
  from: AlarmQueueState;
  to: AlarmQueueState;
  at: string;
  reason: AlarmTransitionReason;
}

export interface SocRuntimeSnapshot {
  alarmState: AlarmQueueState;
  overlayActive: boolean;
  overlayCycle: number;
  panelOpen: boolean;
  reportModalOpen: boolean;
  criticalQueue: CriticalIncident[];
  reportTarget: CriticalIncident | null;
  attacks: AttackEvent[];
  metrics: WorkflowMetrics | null;
  alertCount: number;
  cveCount: number;
  demoMode: boolean;
  transitions: AlarmTransition[];
}

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  tags?: string[];
  description?: string;
  readingTime?: number;
}
