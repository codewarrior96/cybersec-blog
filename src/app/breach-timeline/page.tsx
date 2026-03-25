'use client';

import { useState, useEffect, useRef } from 'react';
import { breachData, type BreachEvent, type BreachCategory, type BreachSeverity } from '@/lib/breachData';

type CategoryFilter = 'ALL' | BreachCategory;
type SeverityFilter2 = 'ALL' | BreachSeverity;

const CATEGORY_STYLES: Record<BreachCategory, { label: string; color: string; bg: string; border: string; dot: string }> = {
  espionage: {
    label: 'ESPIONAGE',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/30',
    dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]',
  },
  ransomware: {
    label: 'RANSOMWARE',
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/30',
    dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]',
  },
  datatheft: {
    label: 'DATA THEFT',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  },
  sabotage: {
    label: 'SABOTAGE',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/30',
    dot: 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]',
  },
  hacktivism: {
    label: 'HACKTIVISM',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/30',
    dot: 'bg-purple-400 shadow-[0_0_8px_rgba(196,181,253,0.6)]',
  },
};

const SEVERITY_STYLES: Record<BreachSeverity, { label: string; color: string; indicator: string }> = {
  catastrophic: { label: 'CATASTROPHIC', color: 'text-red-500', indicator: '███' },
  critical: { label: 'CRITICAL', color: 'text-orange-400', indicator: '██░' },
  major: { label: 'MAJOR', color: 'text-amber-400', indicator: '█░░' },
};

const NATION_FLAGS: Record<string, string> = {
  Russia: '🇷🇺',
  China: '🇨🇳',
  'North Korea': '🇰🇵',
  Iran: '🇮🇷',
  'USA/Israel': '🇺🇸🇮🇱',
};

function formatRecords(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}B`;
  return `${n}M`;
}

function EventCard({ event, side, visible }: { event: BreachEvent; side: 'left' | 'right'; visible: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const catStyle = CATEGORY_STYLES[event.category];
  const sevStyle = SEVERITY_STYLES[event.severity];

  const translateClass = side === 'left'
    ? visible ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
    : visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0';

  return (
    <div
      className={`transition-all duration-700 ease-out ${translateClass}`}
      style={{ transitionDelay: '50ms' }}
    >
      <div
        className={`bg-[#0a0a0f] border rounded-lg p-4 cursor-pointer group transition-all duration-200 hover:border-current ${catStyle.border} hover:shadow-[0_0_20px_rgba(0,0,0,0.5)]`}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Card top row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Year badge */}
            <span className="font-mono text-[10px] text-slate-500 border border-white/5 px-1.5 py-0.5 rounded">
              {event.year}
            </span>
            {/* Category badge */}
            <span
              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${catStyle.color} ${catStyle.bg} ${catStyle.border} border tracking-widest`}
            >
              {catStyle.label}
            </span>
            {/* Severity */}
            <span className={`font-mono text-[10px] ${sevStyle.color} tracking-widest`}>
              {sevStyle.indicator}
            </span>
          </div>

          {/* Nation state */}
          {event.nation && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-sm">{NATION_FLAGS[event.nation] ?? '🏴'}</span>
              <span className="font-mono text-[9px] text-slate-500 border border-purple-400/20 px-1 py-0.5 rounded bg-purple-400/5 text-purple-400/70">
                APT
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="font-mono font-bold text-slate-100 text-sm leading-snug mb-1.5">
          {event.title}
        </h3>

        {/* Target */}
        <p className="font-mono text-[10px] text-slate-500 mb-2">
          <span className="text-slate-600">HEDEF: </span>
          {event.target}
        </p>

        {/* Attack vector */}
        <div className="mb-2">
          <span className="font-mono text-[9px] text-slate-600 border border-white/5 px-1.5 py-0.5 rounded">
            {event.attackVector}
          </span>
        </div>

        {/* Records affected */}
        {event.records !== undefined && (
          <p className="font-mono text-[10px] text-red-400/80 mb-2">
            ⚠ {formatRecords(event.records)} KİŞİ ETKİLENDİ
          </p>
        )}

        {/* Description */}
        <p className={`font-mono text-[10px] text-slate-400 leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
          {event.description}
        </p>

        {/* Expanded: impact */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1">ETKİ</p>
            <p className="font-mono text-[10px] text-slate-300 leading-relaxed">{event.impact}</p>
          </div>
        )}

        {/* Expand hint */}
        <div className="mt-2 flex items-center">
          <span className={`font-mono text-[9px] transition-colors ${catStyle.color} opacity-50 group-hover:opacity-100`}>
            {expanded ? '▲ KAPAT' : '▼ DETAY →'}
          </span>
        </div>
      </div>
    </div>
  );
}

function TimelineNode({
  event,
  index,
  isActive,
  isVisible,
}: {
  event: BreachEvent;
  index: number;
  isActive: boolean;
  isVisible: boolean;
}) {
  const side: 'left' | 'right' = index % 2 === 0 ? 'left' : 'right';
  const catStyle = CATEGORY_STYLES[event.category];

  return (
    <div className="relative grid grid-cols-[1fr_auto_1fr] gap-0 items-start mb-4 md:mb-2">
      {/* Left column */}
      <div className={`pr-6 ${side === 'left' ? 'block' : 'invisible'} ${!isActive ? 'opacity-20 blur-[1px]' : ''} transition-all duration-300`}>
        {side === 'left' && (
          <EventCard event={event} side="left" visible={isVisible} />
        )}
      </div>

      {/* Center: dot + line */}
      <div className="flex flex-col items-center relative" style={{ width: '48px' }}>
        {/* Year label above dot */}
        <div className="font-mono text-[9px] text-slate-600 mb-1 whitespace-nowrap text-center">
          {event.year}.{String(event.month).padStart(2, '0')}
        </div>
        {/* Dot */}
        <div
          className={`w-4 h-4 rounded-full border-2 border-[#0a0a0f] z-10 transition-all duration-300 ${
            isActive ? catStyle.dot : 'bg-slate-700'
          } ${isVisible ? 'scale-100' : 'scale-0'} transition-transform duration-500`}
          style={{ transitionDelay: '100ms' }}
        />
      </div>

      {/* Right column */}
      <div className={`pl-6 ${side === 'right' ? 'block' : 'invisible'} ${!isActive ? 'opacity-20 blur-[1px]' : ''} transition-all duration-300`}>
        {side === 'right' && (
          <EventCard event={event} side="right" visible={isVisible} />
        )}
      </div>
    </div>
  );
}

export default function BreachTimelinePage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter2>('ALL');
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Intersection observer for scroll animations
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.id;
            if (id) setVisibleIds((prev) => { const next = new Set(prev); next.add(id); return next; });
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    cardRefs.current.forEach((el) => observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  const setCardRef = (id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(id, el);
      observerRef.current?.observe(el);
    }
  };

  const filteredEvents = breachData.filter((e) => {
    if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
    if (severityFilter !== 'ALL' && e.severity !== severityFilter) return false;
    return true;
  });

  const totalRecords = breachData.reduce((sum, e) => sum + (e.records ?? 0), 0);

  const categoryButtons: { label: string; value: CategoryFilter }[] = [
    { label: 'TÜMÜ', value: 'ALL' },
    { label: 'ESPIONAGE', value: 'espionage' },
    { label: 'RANSOMWARE', value: 'ransomware' },
    { label: 'DATA THEFT', value: 'datatheft' },
    { label: 'SABOTAGE', value: 'sabotage' },
    { label: 'HACKTIVISM', value: 'hacktivism' },
  ];

  const severityButtons: { label: string; value: SeverityFilter2 }[] = [
    { label: 'TÜMÜ', value: 'ALL' },
    { label: 'CATASTROPHIC', value: 'catastrophic' },
    { label: 'CRITICAL', value: 'critical' },
    { label: 'MAJOR', value: 'major' },
  ];

  return (
    <div className="min-h-screen bg-[#070709]">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-4 md:px-6 md:pt-10 md:pb-6">
        <h1 className="font-mono text-amber-400 tracking-[0.3em] text-2xl font-bold">
          [ BREACH TIMELINE ]
        </h1>
        <p className="font-mono text-slate-500 text-xs mt-1.5">
          2000 — 2024: Siber Tarihin En Büyük Olayları
        </p>
      </div>

      {/* Sticky filters */}
      <div className="sticky top-[65px] z-40 bg-[#070709] border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 space-y-2">
          {/* Category filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categoryButtons.map(({ label, value }) => {
              const catStyle = value !== 'ALL' ? CATEGORY_STYLES[value as BreachCategory] : null;
              const isActive = categoryFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => setCategoryFilter(value)}
                  className={`font-mono text-[10px] px-2.5 py-1 border rounded transition-all duration-150 tracking-widest ${
                    isActive
                      ? catStyle
                        ? `${catStyle.color} ${catStyle.bg} ${catStyle.border}`
                        : 'text-amber-400 bg-amber-400/10 border-amber-400/30'
                      : 'text-slate-500 border-white/10 hover:border-white/20 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Severity filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {severityButtons.map(({ label, value }) => {
              const sevStyle = value !== 'ALL' ? SEVERITY_STYLES[value as BreachSeverity] : null;
              const isActive = severityFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => setSeverityFilter(value)}
                  className={`font-mono text-[10px] px-2.5 py-1 border rounded transition-all duration-150 tracking-widest ${
                    isActive
                      ? sevStyle
                        ? `${sevStyle.color} bg-white/5 border-current/30`
                        : 'text-amber-400 bg-amber-400/10 border-amber-400/30'
                      : 'text-slate-500 border-white/10 hover:border-white/20 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/[0.02] border border-white/5 rounded px-4 py-3">
            <div className="font-mono font-bold text-xl text-amber-400">{breachData.length}</div>
            <div className="font-mono text-[10px] text-slate-500 mt-0.5 tracking-widest">TOPLAM OLAY</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded px-4 py-3">
            <div className="font-mono font-bold text-xl text-red-400">{formatRecords(totalRecords)}</div>
            <div className="font-mono text-[10px] text-slate-500 mt-0.5 tracking-widest">ETKİLENEN KİŞİ</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded px-4 py-3">
            <div className="font-mono font-bold text-xl text-orange-400">$100B+</div>
            <div className="font-mono text-[10px] text-slate-500 mt-0.5 tracking-widest">TAHMİNİ ZARAR</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded px-4 py-3">
            <div className="font-mono font-bold text-xs text-slate-300 leading-tight">2017</div>
            <div className="font-mono text-[10px] text-slate-500 mt-0.5 tracking-widest">EN YIKICI YIL</div>
            <div className="font-mono text-[9px] text-slate-600 mt-0.5">NotPetya + WannaCry</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-20 relative">
        {/* Vertical center line */}
        <div
          className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(245,158,11,0.05) 0%, rgba(245,158,11,0.3) 50%, rgba(245,158,11,0.6) 100%)',
          }}
        />

        {/* Year markers */}
        <div className="relative">
          {Array.from({ length: 25 }, (_, i) => 2000 + i).map((year) => {
            const hasEvent = filteredEvents.some((e) => e.year === year);
            return (
              <div
                key={year}
                className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
                style={{ top: `${((year - 2000) / 25) * 100}%` }}
              >
                {!hasEvent && (
                  <div className="w-1.5 h-px bg-amber-400/10 -translate-x-1/2" />
                )}
              </div>
            );
          })}
        </div>

        {/* Events */}
        <div className="pt-4">
          {filteredEvents.map((event, index) => {
            const isActive =
              (categoryFilter === 'ALL' || event.category === categoryFilter) &&
              (severityFilter === 'ALL' || event.severity === severityFilter);

            return (
              <div
                key={event.id}
                ref={(el) => setCardRef(event.id, el)}
                data-id={event.id}
              >
                <TimelineNode
                  event={event}
                  index={index}
                  isActive={isActive}
                  isVisible={visibleIds.has(event.id)}
                />
              </div>
            );
          })}

          {filteredEvents.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-mono text-slate-600 text-sm">Seçilen filtrelere uygun olay bulunamadı.</p>
            </div>
          )}
        </div>

        {/* End of timeline */}
        <div className="flex justify-center mt-8">
          <div className="font-mono text-[10px] text-slate-700 border border-white/5 px-4 py-2 rounded">
            — TİMLİNE SONU — 2024 —
          </div>
        </div>
      </div>
    </div>
  );
}
