'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
}

interface FeedResponse {
  items: FeedItem[];
  fetchedAt: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INITIAL_VISIBLE  = 10;

const SOURCE_CONFIG: Record<string, { border: string; text: string; bg: string }> = {
  THN:              { border: 'border-green-500/30',  text: 'text-green-400',  bg: '' },
  Krebs:            { border: 'border-red-500/30',    text: 'text-red-400',    bg: '' },
  'SANS ISC':       { border: 'border-amber-500/30',  text: 'text-amber-400',  bg: '' },
  BleepingComputer: { border: 'border-blue-500/30',   text: 'text-blue-400',   bg: '' },
  SecurityWeek:     { border: 'border-purple-500/30', text: 'text-purple-400', bg: '' },
};

const DEFAULT_SOURCE = { border: 'border-slate-500/30', text: 'text-slate-400', bg: '' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min <  1)  return 'just now';
  if (min < 60)  return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour:   '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--';
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonItem() {
  return (
    <div className="border-b border-white/5 px-4 py-3">
      <div className="flex justify-between items-center mb-2">
        <div className="h-3 w-14 shimmer-block rounded" />
        <div className="h-2 w-10 shimmer-block rounded" />
      </div>
      <div className="h-3 w-full shimmer-block rounded mb-1.5" />
      <div className="h-2 w-2/3 shimmer-block rounded" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ThreatFeed() {
  const [items,       setItems]       = useState<FeedItem[]>([]);
  const [fetchedAt,   setFetchedAt]   = useState<string>('');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(false);
  const [showAll,     setShowAll]     = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      setError(false);
      const res  = await fetch('/api/cybernews', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FeedResponse = await res.json() as FeedResponse;
      setItems(data.items);
      setFetchedAt(data.fetchedAt);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    const id = setInterval(fetchFeed, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchFeed]);

  const visible      = showAll ? items : items.slice(0, INITIAL_VISIBLE);
  const tickerText   = items.map(i => i.title).join('  ▸  ');

  return (
    <>
      {/* ── Injected keyframes ── */}
      <style>{`
        @keyframes threat-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes threat-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .shimmer-block {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.03) 25%,
            rgba(255,255,255,0.07) 50%,
            rgba(255,255,255,0.03) 75%
          );
          background-size: 400px 100%;
          animation: threat-shimmer 1.4s ease-in-out infinite;
        }
        .threat-ticker-inner {
          animation: threat-ticker 35s linear infinite;
        }
        .threat-ticker-inner:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="relative bg-[#070709] border border-amber-400/20 overflow-hidden font-mono">
        {/* Scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(transparent 0px, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)',
          }}
        />

        {/* ── Header bar ── */}
        <div className="relative z-20 flex items-center justify-between bg-amber-400/5 border-b border-amber-400/20 px-4 py-2">
          <span className="text-amber-400 text-xs tracking-[0.2em] uppercase select-none">
            ◈ THREAT INTELLIGENCE FEED
          </span>
          <div className="flex items-center gap-2">
            {fetchedAt && (
              <span className="text-amber-400/50 text-[10px] tabular-nums">
                {formatTime(fetchedAt)}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-amber-400/70 text-[10px] uppercase tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
              </span>
              LIVE
            </span>
          </div>
        </div>

        {/* ── Ticker bar ── */}
        {items.length > 0 && (
          <div className="relative z-20 overflow-hidden bg-black/30 border-b border-amber-400/10 py-1.5">
            <div className="threat-ticker-inner flex whitespace-nowrap">
              {/* Duplicated for seamless loop */}
              <span className="text-amber-400/40 text-[10px] pr-8">{tickerText}</span>
              <span className="text-amber-400/40 text-[10px] pr-8">{tickerText}</span>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <div className="relative z-20">
          {/* Loading state */}
          {loading && (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonItem key={i} />
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="px-4 py-8 text-center">
              <p className="text-amber-400/70 text-xs tracking-widest uppercase">
                FEED UNAVAILABLE — RETRYING...
              </p>
              <button
                onClick={fetchFeed}
                className="mt-3 text-[10px] text-amber-400/40 hover:text-amber-400/70 transition-colors border border-amber-400/20 px-3 py-1"
              >
                RETRY NOW
              </button>
            </div>
          )}

          {/* Items list */}
          {!loading && !error && items.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-slate-600 text-xs">NO INTELLIGENCE AVAILABLE</p>
            </div>
          )}

          {!loading && !error && visible.map((item, i) => {
            const src = SOURCE_CONFIG[item.source] ?? DEFAULT_SOURCE;
            return (
              <div
                key={`${item.link}-${i}`}
                onClick={() => window.open(item.link, '_blank', 'noopener,noreferrer')}
                className="border-b border-white/5 px-4 py-3 hover:bg-amber-400/[0.03] transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] border px-1.5 py-0.5 tracking-wider uppercase ${src.border} ${src.text}`}
                  >
                    [{item.source}]
                  </span>
                  <span className="text-slate-600 text-[10px] tabular-nums">
                    {getRelativeTime(item.pubDate)}
                  </span>
                </div>

                <p className="text-slate-300 text-xs leading-snug mt-1.5 group-hover:text-amber-400 transition-colors line-clamp-2">
                  {item.title}
                </p>

                {item.description && (
                  <p className="text-slate-600 text-[10px] mt-0.5 line-clamp-1">
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}

          {/* Load more */}
          {!loading && !error && items.length > INITIAL_VISIBLE && (
            <div className="border-t border-white/5">
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full py-2.5 text-[10px] text-amber-400/40 hover:text-amber-400/70 hover:bg-amber-400/[0.03] transition-colors tracking-widest uppercase"
              >
                {showAll
                  ? `▲ COLLAPSE — SHOWING ALL ${items.length}`
                  : `▼ LOAD MORE — ${items.length - INITIAL_VISIBLE} ADDITIONAL ITEMS`}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
