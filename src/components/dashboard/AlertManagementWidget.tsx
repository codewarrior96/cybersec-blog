'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, Plus, X, RefreshCw, Brain } from 'lucide-react';

interface Alert {
  id: number;
  title: string;
  description: string;
  status: 'new' | 'in_progress' | 'blocked' | 'resolved';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  createdAt: string;
  ageMinutes?: number;
}

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#ff4444',
  P2: '#ffaa00',
  P3: '#00d4ff',
  P4: '#525252',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'YENİ',
  in_progress: 'DEVAM',
  blocked: 'BLOKE',
  resolved: 'ÇÖZÜLDÜ',
};

const STATUS_COLOR: Record<string, string> = {
  new: '#00ff88',
  in_progress: '#ffaa00',
  blocked: '#ff4444',
  resolved: '#525252',
};

type Filter = 'all' | 'active' | 'resolved';

function formatAge(mins?: number): string {
  if (!mins) return '';
  if (mins < 60) return `${mins}d`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}s`;
  return `${Math.floor(h / 24)}g`;
}

export default function AlertManagementWidget() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'P2' });
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [aiToast, setAiToast] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (filter === 'resolved') params.set('status', 'resolved');
      const res = await fetch(`/api/alerts?${params}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      let items: Alert[] = data.alerts ?? [];
      if (filter === 'active') items = items.filter(a => a.status !== 'resolved');
      if (filter === 'resolved') items = items.filter(a => a.status === 'resolved');
      setAlerts(items);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void fetchAlerts();
    const i = setInterval(() => void fetchAlerts(), 30_000);
    return () => clearInterval(i);
  }, [fetchAlerts]);

  const updateStatus = async (id: number, status: Alert['status']) => {
    setUpdatingId(id);
    try {
      await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchAlerts();
    } finally {
      setUpdatingId(null);
    }
  };

  const createAlert = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setCreating(true);
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ title: '', description: '', priority: 'P2' });
      setShowCreate(false);
      await fetchAlerts();
    } finally {
      setCreating(false);
    }
  };

  const handleAiClick = () => {
    setAiToast(true);
    setTimeout(() => setAiToast(false), 2500);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* AI Coming Soon Toast */}
      {aiToast && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#00d4ff]/40 bg-[#0a0a0a] shadow-lg"
          style={{ boxShadow: '0 0 20px rgba(0,212,255,0.15)' }}>
          <Brain size={11} className="text-[#00d4ff]" />
          <span className="text-[10px] font-mono text-[#00d4ff] whitespace-nowrap">AI analizi yakında aktif olacak</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#00ff88]/15 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert size={12} className="text-[#00ff88]" />
          <span className="text-[10px] font-black tracking-widest text-[#00ff88] uppercase">Alert Yönetimi</span>
          <span className="text-[9px] text-[#525252] tabular-nums">({alerts.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); void fetchAlerts(); }}
            className="text-[#525252] hover:text-[#00ff88] transition-colors"
            title="Yenile"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/10 transition-colors font-bold tracking-widest"
          >
            <Plus size={9} />
            YENİ
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-[#00ff88]/10 shrink-0">
        {(['active', 'all', 'resolved'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 text-[9px] py-1.5 uppercase tracking-widest font-bold transition-colors ${
              filter === f
                ? 'text-[#00ff88] border-b border-[#00ff88]'
                : 'text-[#525252] hover:text-[#d4d4d4]'
            }`}
          >
            {f === 'active' ? 'Aktif' : f === 'all' ? 'Tümü' : 'Çözüldü'}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-3 py-2.5 border-b border-[#00ff88]/15 bg-[#0a0a0a] shrink-0">
          <div className="flex flex-col gap-2">
            <input
              className="w-full bg-[#111111] border border-[#00ff88]/20 rounded px-2 py-1.5 text-[11px] text-[#d4d4d4] placeholder-[#525252] focus:outline-none focus:border-[#00ff88]/50 font-mono"
              placeholder="Alert başlığı..."
              value={form.title}
              onChange={e => setForm(v => ({ ...v, title: e.target.value }))}
            />
            <input
              className="w-full bg-[#111111] border border-[#00ff88]/20 rounded px-2 py-1.5 text-[11px] text-[#d4d4d4] placeholder-[#525252] focus:outline-none focus:border-[#00ff88]/50 font-mono"
              placeholder="Açıklama..."
              value={form.description}
              onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
            />
            <div className="flex items-center gap-2">
              <select
                className="bg-[#111111] border border-[#00ff88]/20 rounded px-2 py-1 text-[10px] text-[#d4d4d4] font-mono focus:outline-none"
                value={form.priority}
                onChange={e => setForm(v => ({ ...v, priority: e.target.value }))}
              >
                <option value="P1">P1 — Kritik</option>
                <option value="P2">P2 — Yüksek</option>
                <option value="P3">P3 — Orta</option>
                <option value="P4">P4 — Düşük</option>
              </select>
              <div className="flex gap-1 ml-auto">
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-[#525252] hover:text-[#d4d4d4] transition-colors"
                >
                  <X size={12} />
                </button>
                <button
                  onClick={createAlert}
                  disabled={creating || !form.title.trim()}
                  className="text-[9px] px-3 py-1 rounded bg-[#00ff88] text-black font-bold hover:bg-[#00d4ff] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creating ? '...' : 'OLUŞTUR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <div className="space-y-0">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="px-3 py-3 border-b border-[#00ff88]/05 animate-pulse">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded bg-[#1a1a1a] shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2 bg-[#1a1a1a] rounded w-2/3" />
                    <div className="h-2 bg-[#111111] rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <div className="flex items-center justify-center h-full text-[#525252] text-[10px]">
            {filter === 'active' ? 'Aktif alert yok' : filter === 'resolved' ? 'Çözülen alert yok' : 'Alert bulunamadı'}
          </div>
        )}

        {!loading && alerts.map(alert => (
          <div
            key={alert.id}
            className="flex items-start gap-2.5 px-3 py-3 border-b border-[#00ff88]/05 hover:bg-[#00ff88]/02 transition-colors"
          >
            {/* Priority indicator */}
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
              style={{ background: PRIORITY_COLOR[alert.priority], boxShadow: `0 0 4px ${PRIORITY_COLOR[alert.priority]}` }}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-[#d4d4d4] leading-tight line-clamp-1 flex-1">
                  {alert.title}
                </span>
                <span
                  className="text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    color: PRIORITY_COLOR[alert.priority],
                    background: `${PRIORITY_COLOR[alert.priority]}18`,
                  }}
                >
                  {alert.priority}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {/* Status selector */}
                <select
                  value={alert.status}
                  disabled={updatingId === alert.id}
                  onChange={e => updateStatus(alert.id, e.target.value as Alert['status'])}
                  className="text-[8px] font-bold px-1 py-0.5 rounded border bg-transparent focus:outline-none cursor-pointer"
                  style={{
                    color: STATUS_COLOR[alert.status],
                    borderColor: `${STATUS_COLOR[alert.status]}40`,
                    background: `${STATUS_COLOR[alert.status]}10`,
                  }}
                >
                  <option value="new">YENİ</option>
                  <option value="in_progress">DEVAM</option>
                  <option value="blocked">BLOKE</option>
                  <option value="resolved">ÇÖZÜLDÜ</option>
                </select>
                {alert.ageMinutes !== undefined && (
                  <span className="text-[9px] text-[#525252]">{formatAge(alert.ageMinutes)}</span>
                )}
                {updatingId === alert.id && (
                  <span className="text-[9px] text-[#00ff88] animate-pulse">güncelleniyor...</span>
                )}
                <button
                  onClick={handleAiClick}
                  className="ml-auto flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded border border-[#00d4ff]/25 text-[#00d4ff]/60 hover:text-[#00d4ff] hover:border-[#00d4ff]/50 hover:bg-[#00d4ff]/05 transition-all font-bold tracking-widest"
                  title="AI ile analiz et (yakında)"
                >
                  <Brain size={8} />
                  AI
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
