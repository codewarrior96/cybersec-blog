'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Tag, X, ChevronRight, Filter, FileText, Clock, Shield, Zap } from 'lucide-react';
import { breachData, type BreachEvent, type BreachCategory } from '@/lib/breachData';
import CveRadarTab from '@/components/CveRadarTab';
import { aptProfiles, type AptProfile } from '@/lib/aptData';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { REPORTS_UPDATED_EVENT } from '@/lib/reports-events';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TYPES
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
interface ReportRecord {
  id: number;
  title: string;
  content: string;
  severity: string;
  tags: string[];
  createdAt: string;
  status: 'active' | 'archived';
  updatedAt: string;
  archivedAt: string | null;
  // BUG-002: server-derived ownership flag. UI gates ARŞİVLE +
  // KALICI SİL on this. Optional in the type for backward-compat
  // with any payload built before the fix shipped — falsy default
  // means buttons stay hidden, which is the safe behavior.
  isOwner?: boolean;
}

type ReportStatusFilter = 'active' | 'archived' | 'all';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CONSTANTS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#8b5cf6',
};
const SEV_LABEL: Record<string, string> = {
  CRITICAL: 'KRİTİK', HIGH: 'YÜKSEK', MEDIUM: 'ORTA', LOW: 'DÜŞÜK',
};

const BREACH_CAT: Record<BreachCategory, { label: string; color: string; bg: string }> = {
  espionage:  { label: 'ESPIONAGE',  color: '#22d3ee', bg: 'rgba(34,211,238,0.08)'  },
  ransomware: { label: 'RANSOMWARE', color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
  datatheft:  { label: 'DATA THEFT', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)'  },
  sabotage:   { label: 'SABOTAGE',   color: '#fb923c', bg: 'rgba(251,146,60,0.08)'  },
  hacktivism: { label: 'HACKTIVISM', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
};

const BREACH_SEV_COLOR: Record<string, string> = {
  catastrophic: '#ef4444', critical: '#f97316', major: '#eab308',
};

const NATION_FLAGS: Record<string, string> = {
  Russia: 'RU',
  China: 'CN',
  'North Korea': 'KP',
  Iran: 'IR',
  'USA/Israel': 'US / IL',
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HELPERS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function timeStr(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function excerpt(content: string, max = 160) {
  const plain = content.replace(/^#+\s+/gm, '').replace(/\*\*/g, '').trim();
  return plain.length > max ? plain.slice(0, max) + '...' : plain;
}

function normalizeReportHeading(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseReportSections(content: string) {
  const ordered: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^##+\s+(.+)$/);
    if (headingMatch) {
      current = { title: headingMatch[1].trim(), lines: [] };
      ordered.push(current);
      continue;
    }

    if (!current) {
      current = { title: 'Icerik', lines: [] };
      ordered.push(current);
    }

    current.lines.push(line);
  }

  return ordered.map((section) => ({
    title: section.title,
    key: normalizeReportHeading(section.title),
    lines: section.lines.filter((line, index, source) => !(line === '' && source[index - 1] === '')),
  }));
}

function getReportPreview(report: ReportRecord, max = 220) {
  const sections = parseReportSections(report.content);
  const preferredKeys = [
    'saldiri baglami',
    'bulgular',
    'etki degerlendirmesi',
    'oneriler',
    'olay ozeti',
  ];

  for (const key of preferredKeys) {
    const match = sections.find((section) => section.key === key);
    if (!match) continue;

    const plain = match.lines
      .join(' ')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (plain) {
      return plain.length > max ? plain.slice(0, max) + '...' : plain;
    }
  }

  return excerpt(report.content, max);
}

/** Match report tags to relevant historical breaches */
function matchHistory(report: ReportRecord): BreachEvent[] {
  const tags = report.tags.map(t => t.toLowerCase());
  const titleLow = report.title.toLowerCase();

  return breachData.filter(e => {
    const vec  = e.attackVector.toLowerCase();
    const desc = (e.description + ' ' + e.impact).toLowerCase();

    if (tags.some(t => ['sqli', 'sql', 'database', 'injection'].includes(t)) &&
        (vec.includes('sql') || desc.includes('sql injection'))) return true;
    if (tags.some(t => ['rce', 'buffer', 'overflow', 'exploit', 'os-injection', 'command'].includes(t)) &&
        (vec.includes('exploit') || vec.includes('zero-day') || vec.includes('buffer') || vec.includes('usb'))) return true;
    if (tags.some(t => ['ddos', 'botnet'].includes(t)) && vec.includes('ddos')) return true;
    if (tags.some(t => ['ransomware'].includes(t)) && e.category === 'ransomware') return true;
    if (tags.some(t => ['bruteforce', 'brute', 'auth-bypass', 'soap-api'].includes(t)) &&
        (e.category === 'espionage' || desc.includes('password') || desc.includes('credential'))) return true;
    if (tags.some(t => ['phishing', 'social-engineering'].includes(t)) &&
        (vec.includes('phish') || desc.includes('phish') || vec.includes('social'))) return true;
    if (report.severity === 'CRITICAL' && e.severity === 'catastrophic') return true;
    if ((titleLow.includes('iran') || tags.includes('iran')) && e.nation === 'Iran') return true;
    if ((titleLow.includes('russia') || tags.includes('russia')) && e.nation === 'Russia') return true;

    return false;
  }).slice(0, 3);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   REPORT MODAL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function ReportModal({
  report,
  onClose,
  onArchive,
  archiving,
  onDelete,
  deleting,
}: {
  report: ReportRecord;
  onClose: () => void;
  onArchive?: (report: ReportRecord) => Promise<void> | void;
  archiving?: boolean;
  onDelete?: (report: ReportRecord) => Promise<void> | void;
  deleting?: boolean;
}) {
  const col = SEV_COLOR[report.severity.toUpperCase()] ?? '#8b5cf6';
  const related = matchHistory(report);
  const parsedSections = parseReportSections(report.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const renderLine = (line: string, key: string) => {
    if (!line.trim()) return <div key={key} className="h-2" />;
    if (line.startsWith('- ')) {
      return (
        <div key={key} className="flex gap-2 break-words text-slate-300 text-xs leading-relaxed [overflow-wrap:anywhere]">
          <span className="text-violet-500 shrink-0">•</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    }
    const kvMatch = line.match(/^\*\*(.+?)\*\*:\s*(.+)$/);
    if (kvMatch) {
      return (
        <div key={key} className="grid grid-cols-1 gap-1.5 text-xs leading-relaxed sm:grid-cols-[120px_1fr] sm:gap-3">
          <span className="text-slate-500 font-bold">{kvMatch[1]}</span>
          <span className="break-words text-slate-200 [overflow-wrap:anywhere]">{kvMatch[2]}</span>
        </div>
      );
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={key} className="break-words text-slate-300 text-xs leading-relaxed [overflow-wrap:anywhere]">
        {parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} className="text-slate-200">{p.slice(2, -2)}</strong>
            : p
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(6,0,15,0.9)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border font-mono sm:max-h-[90vh] sm:rounded-lg"
        style={{
          background: '#0d0018',
          borderColor: `${col}40`,
          boxShadow: `0 0 80px ${col}15`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 flex-col gap-2 border-b px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5" style={{ borderColor: `${col}20` }}>
          <div className="min-w-0 flex-1 sm:pr-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-bold px-2 py-0.5 rounded border"
                style={{ color: col, borderColor: `${col}50`, background: `${col}15` }}>
                {SEV_LABEL[report.severity.toUpperCase()] ?? report.severity}
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 text-slate-400">
                {report.status === 'archived' ? 'ARŞİV' : 'AKTİF'}
              </span>
              {!report.isOwner && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-slate-600/40 bg-slate-800/30 text-slate-500">
                  DİĞER KULLANICI
                </span>
              )}
              <span className="text-[9px] text-slate-600">{timeStr(report.createdAt)}</span>
            </div>
            <div className="break-words text-sm font-bold leading-snug text-slate-200 [overflow-wrap:anywhere]">{report.title}</div>
          </div>
          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
            {report.status !== 'archived' && onArchive && report.isOwner && (
              <button
                onClick={() => void onArchive(report)}
                disabled={archiving}
                className="rounded border px-2.5 py-1 text-[9px] font-bold tracking-[0.18em] text-slate-300 transition-all disabled:opacity-50 sm:px-3 sm:text-[10px]"
                style={{
                  borderColor: 'rgba(148,163,184,0.25)',
                  background: 'rgba(15,23,42,0.4)',
                }}
              >
                {archiving ? 'ARŞİVLENİYOR' : 'ARŞİVLE'}
              </button>
            )}
            {report.status === 'archived' && onDelete && report.isOwner && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="rounded border px-2.5 py-1 text-[9px] font-bold tracking-[0.18em] text-rose-200 transition-all disabled:opacity-50 sm:px-3 sm:text-[10px]"
                style={{
                  borderColor: 'rgba(244,63,94,0.35)',
                  background: 'rgba(244,63,94,0.1)',
                }}
              >
                {deleting ? 'SİLİNİYOR' : 'KALICI SİL'}
              </button>
            )}
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tags */}
        {report.tags.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-1.5 border-b px-3 py-2 sm:px-5" style={{ borderColor: `${col}15` }}>
            {report.tags.map(t => (
              <span key={t} className="flex max-w-full items-center gap-1 break-all rounded border border-violet-700/35 bg-violet-900/25 px-1.5 py-0.5 text-[9px] text-violet-300">
                <Tag className="w-2.5 h-2.5" />{t}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 space-y-0.5 overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {parsedSections.map((section) => (
            <div key={section.key} className="mb-3 rounded border border-violet-900/25 bg-violet-950/10 px-3 py-3 sm:px-4">
              <div className="text-violet-400 font-bold text-[10px] mb-2 tracking-widest uppercase">
                {section.title}
              </div>
              <div className="space-y-1.5">
                {section.lines.map((line, index) => renderLine(line, `${section.key}-${index}`))}
              </div>
            </div>
          ))}

          {/* Historical Parallels */}
          {related.length > 0 && (
            <div className="mt-6 pt-4 border-t border-violet-900/30">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3 h-3 text-slate-600" />
                <span className="text-[9px] text-slate-600 tracking-widest uppercase">Tarihsel Paralel Olaylar</span>
              </div>
              <div className="space-y-2">
                {related.map(e => {
                  const cat = BREACH_CAT[e.category];
                  return (
                    <div key={e.id}
                      className="rounded border px-3 py-2"
                      style={{ borderColor: `${cat.color}25`, background: cat.bg }}
                    >
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-[9px] font-bold" style={{ color: cat.color }}>{cat.label}</span>
                          <span className="text-[9px] text-slate-600">{e.year}</span>
                          {e.nation && (
                            <span className="rounded border border-slate-700/50 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.18em] text-slate-400">
                              {NATION_FLAGS[e.nation] ?? 'N/A'}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px]" style={{ color: BREACH_SEV_COLOR[e.severity] ?? '#eab308' }}>
                          {e.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="mb-0.5 break-words text-[10px] font-bold text-slate-300 [overflow-wrap:anywhere]">{e.title}</div>
                      <div className="line-clamp-2 break-words text-[9px] leading-relaxed text-slate-500 [overflow-wrap:anywhere]">{e.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* F-001: Permanent-delete confirmation overlay. Anchored to the
            modal card via `relative` on the inner wrapper above; covers
            only the modal interior so users can still see the report
            title/header context above the dialog. */}
        {showDeleteConfirm && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center p-4"
            style={{ background: 'rgba(6,0,15,0.92)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(false);
            }}
          >
            <div
              className="w-full max-w-md rounded-lg border p-5 font-mono"
              style={{
                background: '#0d0018',
                borderColor: 'rgba(244,63,94,0.4)',
                boxShadow: '0 0 60px rgba(244,63,94,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 text-xs font-bold tracking-[0.2em] text-rose-300 uppercase">
                Kalıcı silme onayı
              </div>
              <div className="mb-2 break-words text-sm text-slate-200 [overflow-wrap:anywhere]">
                &quot;{report.title}&quot;
              </div>
              <div className="mb-5 text-xs leading-relaxed text-slate-400">
                Bu raporu kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="rounded border border-slate-600 bg-slate-800/40 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-slate-300 transition disabled:opacity-50"
                >
                  İPTAL
                </button>
                <button
                  onClick={async () => {
                    if (!onDelete) return;
                    await onDelete(report);
                    setShowDeleteConfirm(false);
                  }}
                  disabled={deleting}
                  className="rounded border border-rose-500/50 bg-rose-500/15 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-rose-200 transition disabled:opacity-50"
                >
                  {deleting ? 'SİLİNİYOR' : 'EVET, SİL'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HISTORY TAB â€” Compact breach cards
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
type BreachCatFilter = 'ALL' | BreachCategory;

function AptModal({ apt, onClose }: { apt: AptProfile; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const riskCol = apt.riskLevel === 'CRITICAL' ? '#ef4444' : apt.riskLevel === 'HIGH' ? '#f97316' : '#eab308';
  const linkedBreaches = breachData.filter(b => apt.notableBreachIds.includes(b.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(6,0,15,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl flex flex-col rounded-xl border overflow-hidden font-mono"
        style={{
          background: 'linear-gradient(160deg,#0d0018 0%,#0a000f 100%)',
          borderColor: `${apt.color}45`,
          boxShadow: `0 0 80px ${apt.color}18`,
          maxHeight: '88vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${apt.color}20` }}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{apt.flagEmoji}</span>
            <div>
              <div className="font-black text-lg tracking-wider" style={{ color: apt.color }}>{apt.name}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {apt.aliases.map(a => (
                  <span key={a} className="text-[8px] text-slate-500 border border-slate-700/50 px-1.5 py-0.5 rounded">{a}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ color: riskCol, background: `${riskCol}15`, border: `1px solid ${riskCol}35` }}>
              {apt.riskLevel}
            </span>
            <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">

          {/* Meta row */}
          <div className="grid grid-cols-3 gap-2">
            {([
              ['ÜLKE / KÖKEN', apt.nation],
              ['AKTİF DÖNEM',  apt.active],
              ['KATEGORİ',     apt.category === 'nation-state' ? 'Devlet Destekli' : apt.category === 'criminal' ? 'Siber Suç Örgütü' : 'Hacktivist'],
            ] as [string,string][]).map(([label, val]) => (
              <div key={label} className="rounded px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="text-[8px] text-slate-600 tracking-widest uppercase mb-0.5">{label}</div>
                <div className="text-[10px] font-bold text-slate-300">{val}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-1.5">▸ GRUP HAKKINDA</div>
            <p className="text-xs text-slate-300 leading-relaxed">{apt.description}</p>
          </div>

          {/* Motivation */}
          <div>
            <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-1.5">▸ MOTİVASYON</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{apt.motivation}</p>
          </div>

          {/* Specialty tags */}
          <div>
            <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-1.5">▸ UZMANLIK ALANLARI</div>
            <div className="flex flex-wrap gap-1.5">
              {apt.specialty.map(s => (
                <span key={s} className="text-[9px] px-2 py-1 rounded border font-bold" style={{ color: apt.color, borderColor: `${apt.color}35`, background: `${apt.color}10` }}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Linked breaches */}
          {linkedBreaches.length > 0 && (
            <div>
              <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-1.5">▸ BAĞLANTILI OLAYLAR</div>
              <div className="space-y-2">
                {linkedBreaches.map(b => {
                  const cat = BREACH_CAT[b.category];
                  return (
                    <div key={b.id} className="flex items-center gap-3 rounded px-3 py-2" style={{ background: `${cat.color}08`, border: `1px solid ${cat.color}20` }}>
                      <div className="w-1 h-8 rounded-full shrink-0" style={{ background: cat.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-slate-200 truncate">{b.title}</div>
                        <div className="text-[8px] text-slate-500">{b.year} · {b.target}</div>
                      </div>
                      <span className="text-[8px] font-bold shrink-0" style={{ color: cat.color }}>{cat.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-2.5 flex items-center justify-between" style={{ borderTop: `1px solid ${apt.color}15` }}>
          <span className="text-[8px] text-slate-700 tracking-widest">MITRE ATT&CK · Threat Actor Intelligence</span>
          <span className="text-[8px]" style={{ color: apt.color }}>ESC ile kapat</span>
        </div>
      </div>
    </div>
  );
}

function HistoryTab() {
  const [catFilter, setCatFilter] = useState<BreachCatFilter>('ALL');
  const [sevFilter, setSevFilter] = useState<'ALL' | 'catastrophic' | 'critical' | 'major'>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedApt, setSelectedApt] = useState<AptProfile | null>(null);

  const filtered = breachData.filter(e => {
    if (catFilter !== 'ALL' && e.category !== catFilter) return false;
    if (sevFilter !== 'ALL' && e.severity !== sevFilter) return false;
    return true;
  });

  const totalRecords = breachData.reduce((s, e) => s + (e.records ?? 0), 0);

  const catButtons: { value: BreachCatFilter; label: string }[] = [
    { value: 'ALL', label: 'TÜMÜ' },
    { value: 'espionage', label: 'ESPIONAGE' },
    { value: 'ransomware', label: 'RANSOMWARE' },
    { value: 'datatheft', label: 'DATA THEFT' },
    { value: 'sabotage', label: 'SABOTAGE' },
    { value: 'hacktivism', label: 'HACKTIVISM' },
  ];

  return (
    <div className="flex-1 min-w-0">
      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'TOPLAM OLAY', value: breachData.length, col: '#f97316' },
          { label: 'ETKİLENEN', value: `${(totalRecords / 1000).toFixed(1)}B`, col: '#ef4444' },
          { label: 'TAHMİNİ ZARAR', value: '$100B+', col: '#eab308' },
          { label: 'EN YIKICI YIL', value: '2017', col: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="rounded border border-white/5 bg-white/[0.02] px-3 py-2">
            <div className="text-sm font-bold" style={{ color: s.col }}>{s.value}</div>
            <div className="text-[9px] text-slate-600 tracking-widest mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {catButtons.map(b => {
          const style = b.value !== 'ALL' ? BREACH_CAT[b.value as BreachCategory] : null;
          const active = catFilter === b.value;
          return (
            <button key={b.value} onClick={() => setCatFilter(b.value)}
              className="text-[9px] px-2 py-1 rounded border transition-all tracking-widest"
              style={{
                borderColor: active && style ? `${style.color}50` : active ? '#f97316' : 'rgba(255,255,255,0.08)',
                background:  active && style ? style.bg : active ? 'rgba(249,115,22,0.1)' : 'transparent',
                color:       active && style ? style.color : active ? '#f97316' : '#64748b',
              }}>
              {b.label}
            </button>
          );
        })}
        <div className="flex gap-1 ml-2">
          {(['ALL', 'catastrophic', 'critical', 'major'] as const).map(s => (
            <button key={s} onClick={() => setSevFilter(s)}
              className="text-[9px] px-2 py-1 rounded border transition-all"
              style={{
                borderColor: sevFilter === s ? `${BREACH_SEV_COLOR[s] ?? '#f97316'}50` : 'rgba(255,255,255,0.08)',
                background:  sevFilter === s ? `${BREACH_SEV_COLOR[s] ?? '#f97316'}10` : 'transparent',
                color:       sevFilter === s ? (BREACH_SEV_COLOR[s] ?? '#f97316') : '#64748b',
              }}>
              {s === 'ALL' ? 'SEV: TÜMÜ' : s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Bar chart: attacks by year */}
        <div className="rounded-lg border border-violet-500/15 bg-[#0a000f] p-4">
          <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-3">▸ Yıllara Göre Saldırı Dağılımı</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={(() => {
              const map: Record<number, number> = {};
              breachData.forEach(e => { map[e.year] = (map[e.year] || 0) + 1; });
              return Object.entries(map).sort(([a],[b]) => Number(a)-Number(b)).map(([year,count]) => ({ year: String(year).slice(2), count }));
            })()} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0d0018', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, fontFamily: 'monospace', fontSize: 10 }}
                labelStyle={{ color: '#c084fc' }}
                itemStyle={{ color: '#94a3b8' }}
                formatter={(v) => [v, 'olay']}
                labelFormatter={(l) => `20${String(l)}`}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart: by category */}
        <div className="rounded-lg border border-violet-500/15 bg-[#0a000f] p-4">
          <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-3">▸ Kategori Dağılımı</div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={(() => {
                    const map: Record<string, number> = {};
                    breachData.forEach(e => { map[e.category] = (map[e.category] || 0) + 1; });
                    return Object.entries(map).map(([name, value]) => ({ name, value }));
                  })()}
                  cx="50%" cy="50%" innerRadius={32} outerRadius={52}
                  dataKey="value" stroke="none"
                >
                  {(['espionage','ransomware','datatheft','sabotage','hacktivism']).map((cat, i) => (
                    <Cell key={cat} fill={['#22d3ee','#f87171','#fbbf24','#fb923c','#a78bfa'][i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0d0018', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, fontFamily: 'monospace', fontSize: 10 }}
                  itemStyle={{ color: '#94a3b8' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 flex-1">
              {([
                { cat: 'espionage',  label: 'Espionage',  col: '#22d3ee' },
                { cat: 'ransomware', label: 'Ransomware', col: '#f87171' },
                { cat: 'datatheft', label: 'Data Theft',  col: '#fbbf24' },
                { cat: 'sabotage',  label: 'Sabotage',    col: '#fb923c' },
                { cat: 'hacktivism',label: 'Hacktivism',  col: '#a78bfa' },
              ] as { cat: string; label: string; col: string }[]).map(({ cat, label, col }) => {
                const count = breachData.filter(e => e.category === cat).length;
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                    <span className="text-[9px] text-slate-400 flex-1">{label}</span>
                    <span className="text-[9px] font-bold tabular-nums" style={{ color: col }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* APT Profile Cards */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] text-slate-600 tracking-widest uppercase">▸ Tehdit Aktörü Profilleri</span>
          <span className="text-[8px] bg-red-900/30 border border-red-700/30 text-red-400 px-1.5 py-0.5 rounded">{aptProfiles.length} APT Grubu</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {aptProfiles.map((apt: AptProfile) => (
            <div
              key={apt.id}
              onClick={() => setSelectedApt(apt)}
              className="rounded-lg border p-3 space-y-2 hover:brightness-125 transition-all cursor-pointer"
              style={{ borderColor: `${apt.color}25`, background: `${apt.color}06` }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{apt.flagEmoji}</span>
                  <div>
                    <div className="font-bold text-xs" style={{ color: apt.color }}>{apt.name}</div>
                    <div className="text-[8px] text-slate-600">{apt.aliases[0]}</div>
                  </div>
                </div>
                <span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded"
                  style={{
                    color: apt.riskLevel === 'CRITICAL' ? '#ef4444' : apt.riskLevel === 'HIGH' ? '#f97316' : '#eab308',
                    background: apt.riskLevel === 'CRITICAL' ? 'rgba(239,68,68,0.12)' : apt.riskLevel === 'HIGH' ? 'rgba(249,115,22,0.12)' : 'rgba(234,179,8,0.12)',
                    border: `1px solid ${apt.riskLevel === 'CRITICAL' ? 'rgba(239,68,68,0.3)' : apt.riskLevel === 'HIGH' ? 'rgba(249,115,22,0.3)' : 'rgba(234,179,8,0.3)'}`,
                  }}
                >
                  {apt.riskLevel}
                </span>
              </div>

              {/* Description */}
              <p className="text-[9px] text-slate-400 leading-relaxed line-clamp-2">{apt.description}</p>

              {/* Specialty tags */}
              <div className="flex flex-wrap gap-1">
                {apt.specialty.slice(0, 3).map(s => (
                  <span key={s} className="text-[8px] px-1.5 py-0.5 rounded border border-slate-800 text-slate-500">{s}</span>
                ))}
              </div>

              {/* Footer: active + motivation */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-[8px] text-slate-600">{apt.active}</span>
                <span className="text-[8px] text-slate-600 text-right max-w-[120px] truncate">{apt.motivation.split(',')[0]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline line + cards */}
      <div className="relative">
        {/* Vertical glow line */}
        <div className="absolute left-[11px] top-0 bottom-0 w-px"
          style={{ background: 'linear-gradient(to bottom, transparent, #f9731630, #ef444430, transparent)' }} />

        <div className="space-y-2 pl-7">
          {filtered.map(e => {
            const cat  = BREACH_CAT[e.category];
            const isEx = expanded === e.id;
            return (
              <div key={e.id} className="relative">
                {/* Timeline dot */}
                <div className="absolute -left-7 top-3 w-3 h-3 rounded-full border-2 border-[#06000f] z-10"
                  style={{ background: cat.color, boxShadow: `0 0 8px ${cat.color}80` }} />

                <div
                  className="rounded border px-3 py-2.5 cursor-pointer transition-all"
                  style={{
                    borderColor: isEx ? `${cat.color}45` : 'rgba(255,255,255,0.06)',
                    background:  isEx ? cat.bg : 'rgba(255,255,255,0.015)',
                  }}
                  onClick={() => setExpanded(isEx ? null : e.id)}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] text-slate-600 border border-white/5 px-1.5 py-0.5 rounded">
                        {e.year}.{String(e.month).padStart(2, '0')}
                      </span>
                      <span className="text-[9px] font-bold tracking-widest" style={{ color: cat.color }}>
                        {cat.label}
                      </span>
                      <span className="text-[9px]"
                        style={{ color: BREACH_SEV_COLOR[e.severity] ?? '#eab308' }}>
                        {e.severity.toUpperCase()}
                      </span>
                      {e.nation && (
                        <span className="rounded border border-slate-700/50 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.18em] text-slate-400">
                          {NATION_FLAGS[e.nation] ?? 'N/A'}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-700 border border-white/5 px-1.5 py-0.5 rounded">
                      {e.attackVector}
                    </span>
                  </div>

                  {/* Title */}
                  <div className="text-xs font-bold text-slate-200 mb-1">{e.title}</div>
                  <div className="text-[9px] text-slate-600 mb-1">
                    <span className="text-slate-700">HEDEF: </span>{e.target}
                  </div>

                  {/* Records */}
                  {e.records !== undefined && (
                    <div className="text-[9px] text-red-400/70 mb-1">
                      Etki {e.records >= 1000 ? `${(e.records / 1000).toFixed(1)}B` : `${e.records}M`} kişi
                    </div>
                  )}

                  {/* Description */}
                  <div className={`text-[10px] text-slate-400 leading-relaxed ${!isEx ? 'line-clamp-2' : ''}`}>
                    {e.description}
                  </div>

                  {/* Expanded: impact */}
                  {isEx && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-1">ETKİ</div>
                      <div className="text-[10px] text-slate-300 leading-relaxed">{e.impact}</div>
                    </div>
                  )}

                  <div className="mt-1 text-[9px]" style={{ color: cat.color, opacity: 0.6 }}>
                    {isEx ? 'KAPAT' : 'DETAY'}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-slate-600 text-xs text-center py-12">
              Seçilen filtrelere uygun olay bulunamadı.
            </div>
          )}
        </div>
      </div>

      {/* End marker */}
      <div className="flex justify-center mt-6">
        <div className="text-[9px] text-slate-700 border border-white/5 px-4 py-1.5 rounded tracking-widest">
          2000 {'->'} 2024 · {breachData.length} olay kayıtlı
        </div>
      </div>

      {/* APT Detail Modal */}
      {selectedApt && <AptModal apt={selectedApt} onClose={() => setSelectedApt(null)} />}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN PAGE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
type Tab = 'reports' | 'history' | 'cve';

export default function ZafiyetTaramasiPage() {
  const [activeTab, setActiveTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportStatus, setReportStatus] = useState<ReportStatusFilter>('active');
  const [sevFilter, setSevFilter] = useState<Set<string>>(new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']));
  const [tagFilter, setTagFilter] = useState('');
  const [showTagFilters, setShowTagFilters] = useState(false);
  const [selected, setSelected] = useState<ReportRecord | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?limit=50&status=${reportStatus}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as { reports: ReportRecord[] };
        setReports(data.reports ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [reportStatus]);

  useEffect(() => {
    void fetchReports();
    if (typeof window === 'undefined') return;

    const onReportsUpdated = () => {
      void fetchReports();
    };

    window.addEventListener(REPORTS_UPDATED_EVENT, onReportsUpdated as EventListener);
    window.addEventListener('focus', onReportsUpdated);

    return () => {
      window.removeEventListener(REPORTS_UPDATED_EVENT, onReportsUpdated as EventListener);
      window.removeEventListener('focus', onReportsUpdated);
    };
  }, [fetchReports]);

  const archiveSelectedReport = useCallback(async (report: ReportRecord) => {
    setArchivingId(report.id);
    try {
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, action: 'archive' }),
      });

      if (!res.ok) {
        return;
      }

      const data = await res.json() as { report?: ReportRecord };
      if (reportStatus === 'active') {
        setSelected(null);
      } else if (data.report) {
        setSelected(data.report);
      }

      window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT));
      await fetchReports();
    } catch {
      /* ignore */
    } finally {
      setArchivingId(null);
    }
  }, [fetchReports, reportStatus]);

  // F-001: permanent deletion. Only triggered after the in-modal
  // confirmation overlay (ReportModal owns the confirm UI). Server
  // returns 409 if the report isn't archived — UI shouldn't reach
  // this path because the KALICI SİL button is hidden on active
  // reports, but the server contract is the source of truth.
  // credentials:'include' is the BUG-001 defensive pattern.
  const deleteSelectedReport = useCallback(async (report: ReportRecord) => {
    setDeletingId(report.id);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        return;
      }

      setSelected(null);
      window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT));
      await fetchReports();
    } catch {
      /* ignore — UI will retry on next focus */
    } finally {
      setDeletingId(null);
    }
  }, [fetchReports]);

  const toggleSev = (s: string) =>
    setSevFilter(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const filtered = reports.filter(r => {
    const sev = r.severity.toUpperCase();
    if (!sevFilter.has(sev)) return false;
    if (tagFilter.trim()) {
      const q = tagFilter.trim().toLowerCase();
      return r.tags.some(t => t.includes(q)) || r.title.toLowerCase().includes(q);
    }
    return true;
  });

  const allTags = Array.from(new Set(reports.flatMap(r => r.tags))).slice(0, 20);

  return (
    <div className="route-page-frame py-4 font-mono text-slate-200 sm:py-6">
      <div className="route-hero px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 sm:h-5 sm:w-5" style={{ color: 'rgb(var(--route-accent-rgb))' }} />
            <div>
              <h1 className="route-kicker">Threat Intelligence Hub</h1>
              <p className="route-copy mt-2 text-[13px] leading-7 sm:mt-3 sm:text-sm">
                Aktif saldırı raporları, CVE takibi ve siber tarih veritabanı.
              </p>
            </div>
          </div>

          <div className="route-tabs gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('reports')}
              className="route-tab-btn"
              data-active={activeTab === 'reports'}
            >
              <FileText className="w-3 h-3" />
              RAPORLAR
              <span className="route-tab-count">{reports.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className="route-tab-btn"
              data-active={activeTab === 'history'}
            >
              <Clock className="w-3 h-3" />
              TARİHSEL VERİTABANI
              <span className="route-tab-count">{breachData.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('cve')}
              className="route-tab-btn"
              data-active={activeTab === 'cve'}
            >
              <Zap className="w-3 h-3" />
              CVE RADAR
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {activeTab === 'reports' && (
          <div className="flex gap-4 lg:gap-5 max-lg:flex-col">
            <aside className="w-48 shrink-0 space-y-3 max-lg:w-full">
              <div className="rounded-xl border border-white/5 bg-[#0b0714]/60 p-3 sm:p-3.5">
                <div className="mb-2 flex items-center gap-1.5">
                  <Filter className="h-3 w-3 text-slate-600" />
                  <span className="text-[9px] uppercase tracking-widest text-slate-600">Önem Seviyesi</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SEV_ORDER.map((s) => {
                    const col = SEV_COLOR[s];
                    const active = sevFilter.has(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSev(s)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[10px] transition-all"
                        style={{
                          border: `1px solid ${active ? col + '70' : 'rgba(30,41,59,0.28)'}`,
                          background: active ? 'rgba(5,10,18,0.92)' : 'rgba(2,6,23,0.12)',
                          color: active ? '#f8fafc' : '#64748b',
                          boxShadow: active ? `inset 3px 0 0 ${col}, inset 0 0 0 1px ${col}22` : 'none',
                        }}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: active ? col : '#334155' }} />
                        {SEV_LABEL[s]}
                        <span className="ml-auto text-[9px]" style={{ color: active ? '#e2e8f0' : '#64748b', opacity: active ? 0.92 : 0.7 }}>
                          {reports.filter((r) => r.severity.toUpperCase() === s).length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-[#0b0714]/60 p-3 sm:p-3.5">
                <div className="mb-2 text-[9px] uppercase tracking-widest text-slate-600">Rapor Durumu</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ['active', 'Aktif'],
                    ['archived', 'Arşiv'],
                    ['all', 'Tümü'],
                  ] as Array<[ReportStatusFilter, string]>).map(([value, label]) => {
                    const active = reportStatus === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setReportStatus(value)}
                        className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-2 text-[10px] transition-all"
                        style={{
                          border: active ? '1px solid rgba(34,197,94,0.45)' : '1px solid rgba(30,41,59,0.28)',
                          background: active ? 'rgba(4,18,10,0.92)' : 'rgba(2,6,23,0.12)',
                          color: active ? '#bbf7d0' : '#64748b',
                          boxShadow: active ? 'inset 3px 0 0 rgba(34,197,94,0.9), inset 0 0 0 1px rgba(34,197,94,0.12)' : 'none',
                        }}
                      >
                        <span className="hidden h-2 w-2 shrink-0 rounded-full sm:block" style={{ background: active ? '#22c55e' : '#334155' }} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {allTags.length > 0 && (
                <div className="rounded-xl border border-white/5 bg-[#0b0714]/60 p-3 sm:p-3.5">
                  <button
                    type="button"
                    onClick={() => setShowTagFilters((prev) => !prev)}
                    className="flex w-full items-center justify-between text-left sm:hidden"
                  >
                    <span className="text-[9px] uppercase tracking-widest text-slate-600">Etiket Ara</span>
                    <span className="rounded-full border border-violet-900/30 px-2 py-0.5 text-[9px] text-violet-300">
                      {showTagFilters ? 'Gizle' : 'Aç'}
                    </span>
                  </button>
                  <div className={`sm:block ${showTagFilters ? 'mt-3 block' : 'hidden'}`}>
                    <div className="mb-2 hidden text-[9px] uppercase tracking-widest text-slate-600 sm:block">Etiket Ara</div>
                    <input
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      placeholder="rce, sqli..."
                      className="w-full rounded border border-violet-900/40 bg-[#0a0015] px-2 py-1.5 text-[10px] text-slate-300 transition-colors placeholder-slate-700 focus:border-violet-500/50 focus:outline-none"
                    />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {allTags.slice(0, 10).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTagFilter(t)}
                          className="rounded border border-violet-900/30 px-1.5 py-0.5 text-[9px] text-slate-600 transition-colors hover:border-violet-500/40 hover:text-violet-400"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setActiveTab('history')}
                className="w-full rounded-lg border border-white/5 bg-[#0b0714]/40 px-2.5 py-2 text-left text-[9px] text-slate-700 transition-colors hover:border-orange-500/20 hover:text-orange-400"
              >
                Tarihsel veritabanını gör {'->'}
              </button>
            </aside>

            <main className="min-w-0 flex-1">
              {loading && (
                <div className="py-16 text-center text-xs text-slate-600">
                  <span className="animate-pulse">Raporlar yükleniyor...</span>
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="space-y-2 py-16 text-center text-xs text-slate-600">
                  <FileText className="mx-auto h-8 w-8 opacity-30" />
                  <div>
                    {reportStatus === 'archived' ? 'Henüz arşivlenmiş rapor yok.' : 'Henüz rapor yok.'}
                  </div>
                  <div className="text-[10px]">
                    {reportStatus === 'archived'
                      ? 'Aktif raporlardan arşivlediğin kayıtlar burada görünecek.'
                      : "Dashboard'daki kritik saldırılardan rapor oluşturun."}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filtered.map((r) => {
                  const sev = r.severity.toUpperCase();
                  const col = SEV_COLOR[sev] ?? '#8b5cf6';
                  return (
                    <div
                      key={r.id}
                      className="flex cursor-pointer flex-col rounded-lg border p-4 transition-all hover:scale-[1.01]"
                      style={{
                        borderColor: `${col}30`,
                        background:
                          'linear-gradient(180deg, rgba(14,8,24,0.96), rgba(10,6,19,0.94))',
                        boxShadow: `inset 3px 0 0 ${col}, inset 0 0 0 1px ${col}10`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${col}55`
                        e.currentTarget.style.boxShadow = `inset 3px 0 0 ${col}, inset 0 0 0 1px ${col}16, 0 10px 26px rgba(0,0,0,0.18)`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = `${col}30`
                        e.currentTarget.style.boxShadow = `inset 3px 0 0 ${col}, inset 0 0 0 1px ${col}10`
                      }}
                      onClick={() => setSelected(r)}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded border px-1.5 py-0.5 text-[9px] font-bold"
                            style={{ color: col, borderColor: `${col}45`, background: `${col}18` }}
                          >
                            {SEV_LABEL[sev] ?? sev}
                          </span>
                          <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-500">
                            {r.status === 'archived' ? 'ARŞİV' : 'AKTİF'}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-600">{timeStr(r.createdAt)}</span>
                      </div>

                      <div className="mb-2 line-clamp-2 text-xs font-bold leading-snug text-slate-200">{r.title}</div>
                      <div className="mb-3 flex-1 text-[10px] leading-relaxed text-slate-500">{getReportPreview(r)}</div>

                      {r.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {r.tags.slice(0, 4).map((t) => (
                            <span key={t} className="rounded border border-violet-900/30 px-1.5 py-0.5 text-[9px] text-violet-500">
                              {t}
                            </span>
                          ))}
                          {r.tags.length > 4 && <span className="text-[9px] text-slate-600">+{r.tags.length - 4}</span>}
                        </div>
                      )}

                      {matchHistory(r).length > 0 && (
                        <div className="mb-2 flex items-center gap-1 text-[9px] text-orange-500/60">
                          <Clock className="h-2.5 w-2.5" />
                          {matchHistory(r).length} tarihsel benzer olay
                        </div>
                      )}

                      <div className="mt-auto flex items-center gap-1 text-[10px]" style={{ color: col }}>
                        <span>Raporu Oku</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </main>
          </div>
        )}

        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'cve' && <CveRadarTab />}
      </div>

      {selected && (
        <ReportModal
          report={selected}
          onClose={() => setSelected(null)}
          onArchive={archiveSelectedReport}
          archiving={archivingId === selected.id}
          onDelete={deleteSelectedReport}
          deleting={deletingId === selected.id}
        />
      )}
    </div>
  );
}




