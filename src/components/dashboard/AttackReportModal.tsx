'use client';
import React, { useState, useEffect } from 'react';
import { X, FileText, Send, CheckCircle, AlertCircle, Tag, Users } from 'lucide-react';
import type { AttackEvent } from '@/lib/dashboard-types';

interface AttackReportModalProps {
  attack: AttackEvent | null;
  open: boolean;
  onClose: () => void;
}

/* Derive tags from attack type */
function deriveTags(attack: AttackEvent): string[] {
  const type = attack.type.toLowerCase();
  const tags: string[] = [];
  if (type.includes('ssh') || type.includes('brute')) tags.push('bruteforce');
  if (type.includes('sql'))      tags.push('sqli');
  if (type.includes('rce'))      tags.push('exploit', 'rce');
  if (type.includes('ddos'))     tags.push('botnet', 'ddos');
  if (type.includes('phishing')) tags.push('phishing', 'social-engineering');
  if (type.includes('port') || type.includes('scan')) tags.push('scanner', 'reconnaissance');
  if (type.includes('xss'))      tags.push('xss', 'web');
  tags.push(attack.sourceCountry.toLowerCase().replace(/\s+/g, '-'));
  return Array.from(new Set(tags));
}

/* Map severity to community difficulty */
function toDifficulty(sev: string): 'beginner' | 'intermediate' | 'advanced' {
  if (sev === 'critical') return 'advanced';
  if (sev === 'high')     return 'intermediate';
  return 'beginner';
}

/* Derive community category */
function toCategory(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('phishing') || t.includes('malware')) return 'MALWARE';
  if (t.includes('rce') || t.includes('sql') || t.includes('xss')) return 'PENTEST';
  return 'NETWORK';
}

const SEV_LABELS: Record<string, string> = {
  critical: 'KRİTİK',
  high:     'YÜKSEK',
  low:      'DÜŞÜK',
};

export default function AttackReportModal({ attack, open, onClose }: AttackReportModalProps) {
  const [title,      setTitle]      = useState('');
  const [content,    setContent]    = useState('');
  const [severity,   setSeverity]   = useState('CRITICAL');
  const [tags,       setTags]       = useState<string[]>([]);
  const [tagInput,   setTagInput]   = useState('');
  const [toCommunity, setToCommunity] = useState(false);
  const [status,     setStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg,   setErrorMsg]   = useState('');

  /* Pre-fill from attack */
  useEffect(() => {
    if (!attack) return;
    const sev = attack.severity.toUpperCase();
    setTitle(`[${sev}] ${attack.type} — ${attack.sourceCountry} (${attack.sourceIP})`);
    setContent(
      `## Saldırı Özeti\n\n` +
      `**Kaynak IP:** ${attack.sourceIP}\n` +
      `**Kaynak Ülke:** ${attack.sourceCountry}\n` +
      `**Saldırı Tipi:** ${attack.type}\n` +
      `**Hedef Port:** ${attack.targetPort}\n` +
      `**Önem Seviyesi:** ${attack.severity.toUpperCase()}\n` +
      `**Zaman:** ${new Date(attack.createdAt).toLocaleString('tr-TR')}\n\n` +
      `## Bulgular\n\n` +
      `[Burada inceleme bulgularınızı yazın...]\n\n` +
      `## Etki Değerlendirmesi\n\n` +
      `[Olası etki ve risk analizi...]\n\n` +
      `## Öneriler\n\n` +
      `[Alınması gereken önlemler...]`
    );
    setSeverity(sev);
    setTags(deriveTags(attack));
    setStatus('idle');
    setErrorMsg('');
  }, [attack]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setErrorMsg('Başlık ve içerik zorunludur.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, severity, tags }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }

      /* Optionally push to community localStorage */
      if (toCommunity && attack && typeof window !== 'undefined') {
        try {
          const existing = JSON.parse(localStorage.getItem('community_posts') ?? '[]') as unknown[];
          const newPost = {
            id: `report-${Date.now()}`,
            author: 'Ghost Admin',
            authorRole: 'Admin',
            title,
            content,
            category: toCategory(attack.type),
            difficulty: toDifficulty(attack.severity),
            tags,
            likes: [],
            comments: [],
            createdAt: new Date().toISOString(),
            views: 0,
          };
          localStorage.setItem('community_posts', JSON.stringify([newPost, ...existing]));
        } catch { /* ignore localStorage errors */ }
      }

      setStatus('success');
      setTimeout(() => { onClose(); setStatus('idle'); }, 2400);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Bilinmeyen hata.');
      setStatus('error');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(6,0,15,0.85)', backdropFilter: 'blur(6px)' }}>
      <div
        className="w-full max-w-2xl flex flex-col rounded-lg border overflow-hidden font-mono"
        style={{
          background: '#0d0018',
          borderColor: 'rgba(139,92,246,0.3)',
          boxShadow: '0 0 60px rgba(139,92,246,0.12)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-violet-500/20 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-400" />
            <span className="text-violet-400 font-bold tracking-widest text-xs uppercase">
              Saldırı İnceleme Raporu
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {status === 'success' ? (
          /* Success state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 px-8">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <p className="text-green-400 font-bold text-lg">Rapor oluşturuldu!</p>
            <p className="text-slate-500 text-sm text-center">
              Rapor kaydedildi.{toCommunity && ' Community\'ye gönderildi.'}
            </p>
            <a
              href="/zafiyet-taramasi"
              className="text-violet-400 text-xs underline underline-offset-2 hover:text-violet-300"
            >
              Zafiyet Taraması'nda görüntüle →
            </a>
          </div>
        ) : (
          /* Form */
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-500 tracking-widest uppercase">Başlık</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-[#06000f] border border-violet-900/40 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-violet-500/60 transition-colors"
                placeholder="Rapor başlığı..."
              />
            </div>

            {/* Severity + Tags row */}
            <div className="flex gap-3">
              <div className="space-y-1.5 w-36 shrink-0">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">Önem</label>
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value)}
                  className="w-full bg-[#06000f] border border-violet-900/40 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-violet-500/60"
                >
                  <option value="CRITICAL">KRİTİK</option>
                  <option value="HIGH">YÜKSEK</option>
                  <option value="MEDIUM">ORTA</option>
                  <option value="LOW">DÜŞÜK</option>
                </select>
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">Etiketler</label>
                <div className="flex flex-wrap gap-1.5 min-h-[38px] bg-[#06000f] border border-violet-900/40 rounded px-2 py-1.5 items-center focus-within:border-violet-500/60 transition-colors">
                  {tags.map(t => (
                    <span key={t} className="flex items-center gap-1 bg-violet-900/30 border border-violet-700/40 px-1.5 py-0.5 rounded text-[10px] text-violet-300">
                      <Tag className="w-2.5 h-2.5" />
                      {t}
                      <button onClick={() => removeTag(t)} className="text-slate-500 hover:text-red-400 ml-0.5">×</button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }}}
                    className="flex-1 min-w-[80px] bg-transparent text-[11px] text-slate-300 focus:outline-none placeholder-slate-600"
                    placeholder="etiket ekle..."
                  />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-500 tracking-widest uppercase">Bulgular & Analiz</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={12}
                className="w-full bg-[#06000f] border border-violet-900/40 rounded px-3 py-2 text-sm text-slate-300 font-mono resize-none focus:outline-none focus:border-violet-500/60 transition-colors leading-relaxed"
                placeholder="Saldırı analizi ve bulgular..."
              />
            </div>

            {/* Community toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setToCommunity(v => !v)}
                className="w-9 h-5 rounded-full border transition-all duration-200 flex items-center px-0.5"
                style={{
                  background: toCommunity ? 'rgba(139,92,246,0.3)' : '#0a0015',
                  borderColor: toCommunity ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.2)',
                }}
              >
                <div
                  className="w-4 h-4 rounded-full transition-transform duration-200"
                  style={{
                    background: toCommunity ? '#8b5cf6' : '#334155',
                    transform: toCommunity ? 'translateX(16px)' : 'translateX(0)',
                    boxShadow: toCommunity ? '0 0 8px #8b5cf6' : 'none',
                  }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-400 transition-colors" />
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                  Community'ye de paylaş
                </span>
              </div>
            </label>

            {/* Error */}
            {status === 'error' && errorMsg && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-red-400 text-xs">{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        {status !== 'success' && (
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-violet-500/15">
            <button
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={status === 'loading'}
              className="flex items-center gap-2 px-5 py-2 rounded font-bold text-xs transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.45)', color: '#c084fc' }}
            >
              {status === 'loading' ? (
                <span className="animate-spin w-3.5 h-3.5 border border-t-transparent border-violet-400 rounded-full" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {status === 'loading' ? 'Gönderiliyor...' : 'Raporu Kaydet'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
