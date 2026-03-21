import type { AlertPriority, AlertStatus } from './soc-types';

export interface CVEItem {
  id: string;
  description: string;
  severity: string | null;
  score: number | null;
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

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  tags?: string[];
  description?: string;
  readingTime?: number;
}
