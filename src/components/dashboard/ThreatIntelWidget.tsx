'use client';
import React, { useState, useEffect } from 'react';
import { Search, Globe, Tag, Shield, Wifi } from 'lucide-react';

interface GreyNoiseIP {
  ip: string;
  country: string;
  classification: string;
  tag: string;
  last_seen: string;
}

interface GreyNoiseData {
  total: number;
  countries: { name: string; count: number }[];
  tags: { name: string; count: number }[];
  ips: GreyNoiseIP[];
}

const CLASSIFICATION_COLOR: Record<string, string> = {
  malicious: '#ff4444',
  benign: '#00ff88',
  unknown: '#525252',
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  malicious: 'TEHLİKELİ',
  benign: 'TEMİZ',
  unknown: 'BİLİNMİYOR',
};

const HISTORY_KEY = 'threat-intel-history';

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveHistory(ip: string) {
  if (typeof window === 'undefined') return;
  const history = loadHistory().filter(h => h !== ip);
  history.unshift(ip);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
}

export default function ThreatIntelWidget() {
  const [data, setData] = useState<GreyNoiseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'ips'>('overview');

  useEffect(() => {
    setHistory(loadHistory());
    const fetchData = async () => {
      try {
        const res = await fetch('/api/greynoise', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const handleSearch = (ip?: string) => {
    const target = (ip ?? query).trim();
    if (!target) return;
    saveHistory(target);
    setHistory(loadHistory());
    // Open external GreyNoise search
    window.open(`https://viz.greynoise.io/ip/${encodeURIComponent(target)}`, '_blank', 'noopener');
  };

  const maxCountryCount = data?.countries?.[0]?.count ?? 1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#00ff88]/15 shrink-0">
        <div className="flex items-center gap-2">
          <Shield size={12} className="text-[#00ff88]" />
          <span className="text-[10px] font-black tracking-widest text-[#00ff88] uppercase">Tehdit İstihbaratı</span>
          {data && (
            <span className="text-[9px] text-[#525252]">
              son 24s: <span className="text-[#00d4ff] font-bold">{data.total.toLocaleString()}</span> IP
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(['overview', 'ips'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-bold transition-colors ${
                activeTab === tab ? 'text-[#00ff88] bg-[#00ff88]/10' : 'text-[#525252] hover:text-[#d4d4d4]'
              }`}
            >
              {tab === 'overview' ? 'Genel' : 'IP Listesi'}
            </button>
          ))}
        </div>
      </div>

      {/* IP Search */}
      <div className="px-3 py-2 border-b border-[#00ff88]/10 shrink-0">
        <div className="flex items-center gap-2 bg-[#111111] border border-[#00ff88]/20 rounded px-2 py-1.5 focus-within:border-[#00ff88]/50 transition-colors">
          <span className="text-[#00ff88] text-[10px] font-mono">›</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="IP adresi sorgula..."
            className="flex-1 bg-transparent text-[11px] text-[#d4d4d4] placeholder-[#525252] font-mono focus:outline-none"
          />
          <button
            onClick={() => handleSearch()}
            className="text-[#525252] hover:text-[#00ff88] transition-colors"
          >
            <Search size={11} />
          </button>
        </div>
        {history.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[8px] text-[#525252] uppercase tracking-widest">Geçmiş:</span>
            {history.map(ip => (
              <button
                key={ip}
                onClick={() => handleSearch(ip)}
                className="text-[8px] text-[#00d4ff] hover:text-[#00ff88] font-mono transition-colors px-1 rounded hover:bg-[#00ff88]/05"
              >
                {ip}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-[10px] text-[#525252] animate-pulse">Yükleniyor...</div>
          </div>
        )}

        {!loading && data && activeTab === 'overview' && (
          <div className="flex gap-0 h-full divide-x divide-[#00ff88]/10">
            {/* Countries */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#00ff88]/08">
                <Globe size={9} className="text-[#00ff88]" />
                <span className="text-[9px] text-[#525252] uppercase tracking-widest font-bold">Ülkeler</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {data.countries.slice(0, 8).map((c, i) => (
                  <div key={i} className="px-3 py-2 border-b border-[#00ff88]/05">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[#d4d4d4]">{c.name}</span>
                      <span className="text-[9px] text-[#525252] tabular-nums">{c.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1 bg-[#111111] rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${(c.count / maxCountryCount) * 100}%`,
                          background: i === 0 ? '#ff4444' : i === 1 ? '#ffaa00' : '#00d4ff',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#00ff88]/08">
                <Tag size={9} className="text-[#00d4ff]" />
                <span className="text-[9px] text-[#525252] uppercase tracking-widest font-bold">Etiketler</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {data.tags.map((t, i) => (
                  <div key={i} className="px-3 py-2.5 border-b border-[#00ff88]/05 flex items-center justify-between">
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.1)' }}
                    >
                      {t.name}
                    </span>
                    <span className="text-[9px] text-[#525252] tabular-nums">{t.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && data && activeTab === 'ips' && (
          <div>
            {data.ips.map((ip, i) => (
              <div
                key={i}
                className="px-3 py-2.5 border-b border-[#00ff88]/05 hover:bg-[#00ff88]/02 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wifi size={9} className="text-[#525252] shrink-0 mt-0.5" />
                    <button
                      onClick={() => handleSearch(ip.ip)}
                      className="text-[10px] font-mono text-[#00d4ff] hover:text-[#00ff88] transition-colors"
                    >
                      {ip.ip}
                    </button>
                  </div>
                  <span
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      color: CLASSIFICATION_COLOR[ip.classification] ?? '#525252',
                      background: `${CLASSIFICATION_COLOR[ip.classification] ?? '#525252'}18`,
                    }}
                  >
                    {CLASSIFICATION_LABEL[ip.classification] ?? ip.classification}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 ml-5">
                  <span className="text-[9px] text-[#525252]">{ip.country}</span>
                  <span className="text-[9px] text-[#525252] font-mono">{ip.tag}</span>
                  <span className="text-[9px] text-[#525252]">{ip.last_seen}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
