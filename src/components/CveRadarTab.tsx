'use client';

import { useEffect, useState, useCallback } from 'react';
import type { CVEItem } from '@/app/api/cves/route';


interface CVEResponse {
  cves: CVEItem[];
  total: number;
  fetchedAt: string;
  error?: string;
}

const SEVERITY_COLORS: Record<string, { text: string; bg: string; border: string; bar: string; accent: string }> = {
  CRITICAL: { text: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/40',    bar: 'bg-red-500',    accent: 'bg-red-500'    },
  HIGH:     { text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/40', bar: 'bg-orange-500', accent: 'bg-orange-500' },
  MEDIUM:   { text: 'text-amber-400',  bg: 'bg-amber-500/15',  border: 'border-amber-500/40',  bar: 'bg-amber-500',  accent: 'bg-amber-400'  },
  LOW:      { text: 'text-slate-400',  bg: 'bg-slate-500/15',  border: 'border-slate-500/40',  bar: 'bg-slate-500',  accent: 'bg-slate-500'  },
};

function getSeverityStyle(severity: string | null) {
  if (!severity) return SEVERITY_COLORS['LOW'];
  return SEVERITY_COLORS[severity.toUpperCase()] ?? SEVERITY_COLORS['LOW'];
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.min(100, (score / 10) * 100);
  const style = getSeverityStyle(
    score >= 9 ? 'CRITICAL' : score >= 7 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW'
  );
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${style.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border-b border-white/5 py-4 px-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-4 w-32 bg-white/5 rounded" />
          <div className="h-4 w-16 bg-white/5 rounded" />
        </div>
        <div className="h-6 w-10 bg-white/5 rounded" />
      </div>
      <div className="mt-2 h-3 w-full bg-white/5 rounded" />
      <div className="mt-1 h-3 w-3/4 bg-white/5 rounded" />
    </div>
  );
}

function CVECard({ cve }: { cve: CVEItem }) {
  const [expanded, setExpanded] = useState(false);
  const style = getSeverityStyle(cve.severity);
  const published = new Date(cve.published);
  const dateStr = published.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div
      className="border-b border-white/5 py-4 px-6 hover:bg-white/[0.02] transition-colors cursor-pointer relative"
      onClick={() => setExpanded(v => !v)}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${style.accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono font-bold text-sm text-slate-200 tracking-wide">{cve.id}</span>
          {cve.severity && (
            <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${style.text} ${style.bg} border ${style.border} tracking-widest`}>
              {cve.severity}
            </span>
          )}
          {cve.weaknesses && (
            <span className="font-mono text-[10px] text-slate-500 border border-white/5 px-1.5 py-0.5 rounded">{cve.weaknesses}</span>
          )}
        </div>
        <div className="flex items-start gap-3 shrink-0">
          <div className="text-right">
            {cve.score !== null ? (
              <>
                <span className={`font-mono font-bold text-xl leading-none ${style.text}`}>{cve.score.toFixed(1)}</span>
                <ScoreBar score={cve.score} />
              </>
            ) : (
              <span className="font-mono text-slate-600 text-sm">N/A</span>
            )}
          </div>
          <div className="text-right pt-0.5">
            <span className="font-mono text-[11px] text-slate-400">{dateStr}</span>
          </div>
        </div>
      </div>
      <p className={`font-mono text-xs text-slate-400 leading-relaxed mt-2 ${!expanded ? 'line-clamp-2' : ''}`}>
        {cve.description}
      </p>
      {cve.references.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(expanded ? cve.references : cve.references.slice(0, 2)).map((ref, i) => {
            const domain = (() => { try { return new URL(ref).hostname.replace('www.', ''); } catch { return ref.slice(0, 30); } })();
            return (
              <a key={i} href={ref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="font-mono text-[10px] text-slate-500 border border-white/5 px-1.5 py-0.5 rounded hover:text-amber-400 hover:border-amber-400/20 transition-colors">
                ↗ {domain}
              </a>
            );
          })}
        </div>
      )}
      <div className="mt-2">
        <span className="font-mono text-[11px] text-slate-500">{expanded ? '▲ KAPAT' : '▼ DETAY'}</span>
      </div>
    </div>
  );
}

export default function CveRadarTab() {
  const [data, setData] = useState<CVEResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCVEs = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/cves');
      const json: CVEResponse = await res.json();
      if (!res.ok || json.error) { setError(true); setData(json); }
      else { setData(json); }
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchCVEs(); }, [fetchCVEs]);

  // Backend returns ALL CRITICAL CVEs in the 30-day window. Frontend sorts
  // by CVSS score descending and takes the top 20 — a curated live feed of
  // the most severe vulnerabilities of the past month, refreshed via NVD's
  // 5-minute server-side cache.
  const cves = [...(data?.cves ?? [])]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 20);

  return (
    <div>
      {/* Sub-header: source + timestamp */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-amber-400 font-bold tracking-widest text-xs uppercase">⬡ CVE RADAR</div>
          <div className="text-slate-400 text-xs mt-0.5">Kaynak: National Vulnerability Database (NVD/NIST) · 5 dk güncelleme</div>
        </div>
        <div className="flex items-center gap-2">
          {loading ? <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> : <span className="w-2 h-2 rounded-full bg-green-400" />}
          {data?.fetchedAt && <span className="font-mono text-[11px] text-slate-400">{new Date(data.fetchedAt).toLocaleTimeString('tr-TR')}</span>}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 border border-amber-400/20 bg-amber-400/5 rounded font-mono text-xs text-amber-400 flex items-center gap-2">
          <span>⚠</span> NVD API UNREACHABLE — SHOWING CACHED DATA
          <button onClick={() => void fetchCVEs()} className="ml-auto text-amber-400/60 hover:text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded transition-colors">RETRY</button>
        </div>
      )}

      {/* CVE List */}
      <div className="border border-white/5 rounded-lg overflow-hidden">
        <div className="border-b border-white/5 px-6 py-2 bg-white/[0.01] flex items-center justify-between">
          <span className="font-mono text-[11px] text-slate-500 tracking-widest">CVE ID / SEVERITY</span>
          <span className="font-mono text-[11px] text-slate-500 tracking-widest">CVSS SCORE</span>
        </div>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : cves.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-mono text-slate-600 text-sm">{error ? 'NVD API bağlantı hatası.' : 'Seçilen filtrelere uygun CVE bulunamadı.'}</p>
          </div>
        ) : (
          cves.map(cve => <CVECard key={cve.id} cve={cve} />)
        )}
      </div>

      <div className="pt-6 pb-2 font-mono text-[11px] text-slate-500 text-center">
        Veriler NVD/NIST API&apos;den alınmaktadır. CVE açıklamalarından sorumluluk kabul edilmez.
      </div>
    </div>
  );
}
