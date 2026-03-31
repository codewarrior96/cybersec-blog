'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { ExternalLink, RefreshCw, Newspaper } from 'lucide-react';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
}

const SOURCE_COLORS: Record<string, string> = {
  THN: '#00ff88',
  Krebs: '#00d4ff',
  BleepingComputer: '#ffaa00',
  'SANS ISC': '#ff4444',
  SecurityWeek: '#a78bfa',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}d önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}s önce`;
  return `${Math.floor(hrs / 24)}g önce`;
}

export default function CyberNewsWidget() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState('');
  const [error, setError] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      setError(false);
      const res = await fetch('/api/cybernews', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items ?? []);
      setLastFetch(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNews();
    const interval = setInterval(() => void fetchNews(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#00ff88]/15 shrink-0">
        <div className="flex items-center gap-2">
          <Newspaper size={12} className="text-[#00ff88]" />
          <span className="text-[10px] font-black tracking-widest text-[#00ff88] uppercase">
            Siber Haber Akışı
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="text-[9px] text-[#525252] tabular-nums">{lastFetch}</span>
          )}
          <button
            onClick={() => { setLoading(true); void fetchNews(); }}
            className="text-[#525252] hover:text-[#00ff88] transition-colors"
            title="Yenile"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <div className="space-y-0">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="px-3 py-2.5 border-b border-[#00ff88]/05 animate-pulse">
                <div className="h-2 bg-[#1a1a1a] rounded w-3/4 mb-1.5" />
                <div className="h-2 bg-[#111111] rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#525252]">
            <span className="text-[10px]">Haber akışına ulaşılamıyor</span>
            <button
              onClick={() => { setLoading(true); void fetchNews(); }}
              className="text-[10px] text-[#00ff88] hover:underline"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex items-center justify-center h-full text-[#525252] text-[10px]">
            Haber bulunamadı
          </div>
        )}

        {!loading && !error && items.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-1 px-3 py-2.5 border-b border-[#00ff88]/05 hover:bg-[#00ff88]/03 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] text-[#d4d4d4] leading-tight group-hover:text-[#00ff88] transition-colors line-clamp-2 flex-1">
                {item.title}
              </span>
              <ExternalLink size={9} className="text-[#525252] group-hover:text-[#00ff88] transition-colors shrink-0 mt-0.5" />
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] font-bold px-1 rounded"
                style={{
                  color: SOURCE_COLORS[item.source] ?? '#00ff88',
                  background: `${SOURCE_COLORS[item.source] ?? '#00ff88'}15`,
                }}
              >
                {item.source}
              </span>
              <span className="text-[9px] text-[#525252]">{timeAgo(item.pubDate)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
