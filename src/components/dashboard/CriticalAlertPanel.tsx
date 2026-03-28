'use client';
import React, { useEffect, useRef, useState } from 'react';
import { FileText, X, AlertTriangle, Shield, Zap } from 'lucide-react';
import type { AttackEvent } from '@/lib/dashboard-types';

interface CriticalAlertPanelProps {
  queue: AttackEvent[];
  open: boolean;
  onReport: (attack: AttackEvent) => void;
  onDismiss: (id: number) => void;
  onClose: () => void;
}

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  low:      '#8b5cf6',
};

const SEV_LABEL: Record<string, string> = {
  critical: 'KRİTİK',
  high:     'YÜKSEK',
  low:      'DÜŞÜK',
};

const TYPE_ICON: Record<string, string> = {
  'RCE Attempt':    '💀',
  'SQL Injection':  '🔓',
  'SSH Brute Force':'🔑',
  'DDoS':           '⚡',
  'Port Scan':      '🔍',
  'Phishing':       '🎣',
};

const TYPE_DESC: Record<string, string> = {
  'RCE Attempt':    'Uzaktan Kod Yürütme girişimi tespit edildi',
  'SQL Injection':  'Veritabanı enjeksiyon saldırısı algılandı',
  'SSH Brute Force':'Brute-force kimlik doğrulama saldırısı',
  'DDoS':           'Dağıtık hizmet engelleme saldırısı',
  'Port Scan':      'Hedef sistem port taraması gerçekleşti',
  'Phishing':       'Kimlik avı saldırı vektörü tespit edildi',
};

function timeStr(iso: string) {
  try { return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return iso; }
}

function ScanLine() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
      <div
        className="absolute left-0 right-0 h-[2px] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), rgba(255,255,255,0.3), rgba(239,68,68,0.6), transparent)',
          animation: 'scan-sweep 2.4s linear infinite',
        }}
      />
    </div>
  );
}

function CornerDeco({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const styles: Record<string, React.CSSProperties> = {
    tl: { top: 0, left: 0, borderTop: '2px solid', borderLeft: '2px solid' },
    tr: { top: 0, right: 0, borderTop: '2px solid', borderRight: '2px solid' },
    bl: { bottom: 0, left: 0, borderBottom: '2px solid', borderLeft: '2px solid' },
    br: { bottom: 0, right: 0, borderBottom: '2px solid', borderRight: '2px solid' },
  };
  return (
    <div
      className="absolute w-4 h-4 pointer-events-none"
      style={{ ...styles[pos], borderColor: 'rgba(239,68,68,0.7)' }}
    />
  );
}

export default function CriticalAlertPanel({
  queue, open, onReport, onDismiss, onClose,
}: CriticalAlertPanelProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setExiting(false);
      setVisible(true);
    }
    if (!open && prevOpen.current && visible) {
      setExiting(true);
      const t = setTimeout(() => setVisible(false), 260);
      return () => clearTimeout(t);
    }
    prevOpen.current = open;
  }, [open, visible]);

  if (!visible) return null;

  const latest = [...queue].reverse();

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center font-mono"
      style={{
        background: 'rgba(6,0,15,0.82)',
        animation: exiting ? 'alert-exit 0.25s ease-in both' : 'backdrop-in 0.3s ease-out both',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Main card */}
      <div
        className={`relative flex flex-col ${exiting ? 'alert-exit' : 'alert-entrance alert-glow'}`}
        style={{
          width: 'min(520px, 92vw)',
          maxHeight: 'min(640px, 88vh)',
          background: 'linear-gradient(160deg, #100010 0%, #0a000f 60%, #14000a 100%)',
          border: '1px solid rgba(239,68,68,0.45)',
          borderRadius: 12,
        }}
      >
        {/* Corner decorations */}
        <CornerDeco pos="tl" />
        <CornerDeco pos="tr" />
        <CornerDeco pos="bl" />
        <CornerDeco pos="br" />

        {/* Scan line sweep */}
        <ScanLine />

        {/* ── Header ── */}
        <div
          className="relative flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(239,68,68,0.2)' }}
        >
          {/* Left: icon + title */}
          <div className="flex items-center gap-3">
            {/* Pulsing alert icon */}
            <div className="relative flex items-center justify-center w-8 h-8">
              <div
                className="absolute w-8 h-8 rounded-full animate-ping"
                style={{ background: 'rgba(239,68,68,0.25)' }}
              />
              <div
                className="relative w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)' }}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              </div>
            </div>

            <div className="flex flex-col">
              <span
                className="text-red-400 font-black tracking-[0.2em] text-xs uppercase critical-flicker"
              >
                ⚠ KRİTİK GÜVENLİK UYARISI
              </span>
              <span className="text-[9px] text-red-600 tracking-widest uppercase mt-0.5">
                P1 · Otomatik Algılama · Öncelikli Müdahale Gerekli
              </span>
            </div>
          </div>

          {/* Right: count badge + close */}
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <span
                className="alert-badge-pop bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full"
                style={{ boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}
              >
                {queue.length}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-slate-600 hover:text-red-400 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Alert list ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {latest.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative">
                <Shield className="w-12 h-12 text-slate-700" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-slate-500 text-xs tracking-widest uppercase">Sistem Güvende</div>
                <div className="text-slate-700 text-[10px] mt-1">Kritik saldırı sinyali bekleniyor...</div>
              </div>
            </div>
          )}

          {latest.map((a, idx) => {
            const col = SEV_COLOR[a.severity] ?? '#ef4444';
            const icon = TYPE_ICON[a.type] ?? '⚠';
            const desc = TYPE_DESC[a.type] ?? 'Bilinmeyen tehdit vektörü';
            const sevLabel = SEV_LABEL[a.severity] ?? a.severity.toUpperCase();

            return (
              <div
                key={a.id}
                className="relative rounded-lg overflow-hidden"
                style={{
                  border: `1px solid ${col}30`,
                  background: `linear-gradient(135deg, ${col}06 0%, transparent 60%)`,
                  animationDelay: `${idx * 0.08}s`,
                }}
              >
                {/* Left severity bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
                  style={{ background: `linear-gradient(180deg, ${col}, ${col}55)`, boxShadow: `0 0 8px ${col}` }}
                />

                <div className="pl-4 pr-3 py-3 space-y-2.5">
                  {/* Row 1: type + time + severity badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{icon}</span>
                      <span
                        className="font-black text-xs tracking-wider"
                        style={{ color: col }}
                      >
                        {a.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider"
                        style={{
                          color: col,
                          background: `${col}18`,
                          border: `1px solid ${col}40`,
                          boxShadow: `0 0 6px ${col}30`,
                        }}
                      >
                        {sevLabel}
                      </span>
                      <span className="text-[9px] text-slate-600 tabular-nums">{timeStr(a.createdAt)}</span>
                    </div>
                  </div>

                  {/* Row 2: description */}
                  <div className="text-[10px] text-slate-400 leading-relaxed">{desc}</div>

                  {/* Row 3: IP / country / port grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['KAYNAK IP',   a.sourceIP,      '#94a3b8'],
                      ['ÜLKE',        a.sourceCountry, col      ],
                      ['HEDEF PORT',  String(a.targetPort), '#f59e0b'],
                    ] as [string, string, string][]).map(([label, value, valCol]) => (
                      <div
                        key={label}
                        className="rounded px-2 py-1.5"
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <div className="text-[8px] text-slate-600 tracking-widest uppercase mb-0.5">{label}</div>
                        <div
                          className="text-[10px] font-bold tabular-nums truncate"
                          style={{ color: valCol }}
                        >
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Row 4: action buttons */}
                  <div className="flex gap-2 pt-0.5">
                    <button
                      onClick={() => onReport(a)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all duration-200 hover:brightness-125 active:scale-95"
                      style={{
                        background: `${col}15`,
                        border: `1px solid ${col}45`,
                        color: col,
                        boxShadow: `0 0 12px ${col}20`,
                      }}
                    >
                      <FileText className="w-3 h-3" />
                      Rapor Oluştur
                    </button>
                    <button
                      onClick={() => onDismiss(a.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] text-slate-500 hover:text-slate-300 border border-slate-800 transition-colors"
                    >
                      <Zap className="w-3 h-3" />
                      Kapat
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-2.5"
          style={{ borderTop: '1px solid rgba(239,68,68,0.12)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] text-slate-600 tracking-widest uppercase">
              Kritik saldırılar otomatik algılanır
            </span>
          </div>
          <span className="text-[9px] text-red-900 font-bold tracking-widest">P1 ÖNCELİKLİ</span>
        </div>
      </div>
    </div>
  );
}
