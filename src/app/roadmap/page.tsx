'use client';

import { useState, useEffect, useRef } from 'react';
import type { Metadata } from 'next';

// ─── Types ────────────────────────────────────────────────────────────────────

type Level   = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
type FreeTier = 'Yes' | 'No' | 'Audit' | 'Partial';

interface Course {
  platform: string;
  name: string;
  level: Level;
  free: FreeTier;
  link: string;
  desc: string;
}

interface Stage {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  target: string;
  certification: string;
  courses: Course[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STAGES: Stage[] = [
  {
    id: 'stage-01',
    number: '01',
    title: 'FOUNDATION',
    subtitle: 'Temel — Sıfırdan Başlayanlar İçin',
    target: '0 – 3 ay',
    certification: 'CompTIA Security+',
    courses: [
      {
        platform: 'TryHackMe',
        name:     'Pre-Security Path',
        level:    'Beginner',
        free:     'Yes',
        link:     'https://tryhackme.com/path/outline/presecurity',
        desc:     'Ağ, Linux ve Web temelleri',
      },
      {
        platform: 'Coursera',
        name:     'Google Cybersecurity Certificate',
        level:    'Beginner',
        free:     'Audit',
        link:     'https://www.coursera.org/professional-certificates/google-cybersecurity',
        desc:     "Google'dan 8 kurs serisi",
      },
      {
        platform: 'Cybrary',
        name:     'Introduction to IT & Cybersecurity',
        level:    'Beginner',
        free:     'Yes',
        link:     'https://www.cybrary.it/course/intro-to-it-and-cybersecurity',
        desc:     'IT altyapısı ve güvenlik temelleri',
      },
      {
        platform: 'YouTube',
        name:     'Professor Messer CompTIA Security+',
        level:    'Beginner',
        free:     'Yes',
        link:     'https://www.professormesser.com/security-plus/sy0-701/sy0-701-video/sy0-701-comptia-security-plus-course/',
        desc:     'Security+ sınav hazırlığı',
      },
      {
        platform: 'SANS',
        name:     'SEC275: Foundations',
        level:    'Beginner',
        free:     'No',
        link:     'https://www.sans.org/cyber-security-courses/foundations/',
        desc:     "SANS'ın başlangıç seviyesi kursu",
      },
    ],
  },
  {
    id: 'stage-02',
    number: '02',
    title: 'INTERMEDIATE',
    subtitle: 'Orta Seviye — Teknik Derinleşme',
    target: '3 – 9 ay',
    certification: 'CompTIA CySA+ veya eJPT',
    courses: [
      {
        platform: 'TryHackMe',
        name:     'SOC Level 1 Path',
        level:    'Intermediate',
        free:     'Partial',
        link:     'https://tryhackme.com/path/outline/soclevel1',
        desc:     'Blue team ve SOC analist becerileri',
      },
      {
        platform: 'HackTheBox Academy',
        name:     'Penetration Testing Job Role Path',
        level:    'Intermediate',
        free:     'Partial',
        link:     'https://academy.hackthebox.com/paths',
        desc:     'Hands-on sızma testi eğitimi',
      },
      {
        platform: 'Udemy',
        name:     'The Complete Ethical Hacking Course',
        level:    'Intermediate',
        free:     'No',
        link:     'https://www.udemy.com/course/the-complete-ethical-hacking-course-beginner-to-advanced/',
        desc:     'Kapsamlı etik hacking kursu',
      },
      {
        platform: 'Coursera',
        name:     'IBM Cybersecurity Analyst',
        level:    'Intermediate',
        free:     'Audit',
        link:     'https://www.coursera.org/professional-certificates/ibm-cybersecurity-analyst',
        desc:     "IBM'den 8 kurs profesyonel sertifika",
      },
      {
        platform: 'PortSwigger',
        name:     'Web Security Academy',
        level:    'Intermediate',
        free:     'Yes',
        link:     'https://portswigger.net/web-security',
        desc:     'Burp Suite yapımcısından ücretsiz web güvenliği',
      },
    ],
  },
  {
    id: 'stage-03',
    number: '03',
    title: 'ADVANCED',
    subtitle: 'İleri Seviye — Uzmanlaşma',
    target: '9 – 18 ay',
    certification: 'OSCP, GCIH',
    courses: [
      {
        platform: 'Offensive Security',
        name:     'PEN-200 / OSCP',
        level:    'Advanced',
        free:     'No',
        link:     'https://www.offensive-security.com/pwk-oscp/',
        desc:     'Endüstrinin altın standardı sertifikası',
      },
      {
        platform: 'SANS',
        name:     'SEC504: Hacker Tools, Techniques & Incident Handling',
        level:    'Advanced',
        free:     'No',
        link:     'https://www.sans.org/cyber-security-courses/hacker-techniques-incident-handling/',
        desc:     'GCIH sertifikasına hazırlık',
      },
      {
        platform: 'HackTheBox',
        name:     'Pro Labs — RastaLabs',
        level:    'Advanced',
        free:     'No',
        link:     'https://www.hackthebox.com/hacker/pro-labs',
        desc:     'Gerçek AD ortamı simülasyonu',
      },
      {
        platform: 'TCM Security',
        name:     'Practical Malware Analysis & Triage',
        level:    'Advanced',
        free:     'No',
        link:     'https://academy.tcm-sec.com/p/practical-malware-analysis-triage',
        desc:     'Gerçek dünya malware analizi',
      },
      {
        platform: 'Udemy',
        name:     'Advanced Penetration Testing',
        level:    'Advanced',
        free:     'No',
        link:     'https://www.udemy.com/course/advanced-penetration-testing-course/',
        desc:     'İleri seviye sızma testi teknikleri',
      },
    ],
  },
  {
    id: 'stage-04',
    number: '04',
    title: 'EXPERT',
    subtitle: 'Uzman — Endüstri Seviyesi Operasyonlar',
    target: '18+ ay',
    certification: 'OSED, GXPN, CRTO, GREM',
    courses: [
      {
        platform: 'Offensive Security',
        name:     'EXP-401 / OSED',
        level:    'Expert',
        free:     'No',
        link:     'https://www.offensive-security.com/exp401-osed/',
        desc:     'Windows exploit geliştirme',
      },
      {
        platform: 'SANS',
        name:     'SEC660: Advanced Pen Testing',
        level:    'Expert',
        free:     'No',
        link:     'https://www.sans.org/cyber-security-courses/advanced-penetration-testing-exploits-ethical-hacking/',
        desc:     'GXPN sertifikasına hazırlık',
      },
      {
        platform: 'Zero-Point Security',
        name:     'Red Team Ops (CRTO)',
        level:    'Expert',
        free:     'No',
        link:     'https://training.zeropointsecurity.co.uk/courses/red-team-ops',
        desc:     'C2 framework ve red team operasyonları',
      },
      {
        platform: 'VX Underground',
        name:     'Malware Development',
        level:    'Expert',
        free:     'Yes',
        link:     'https://www.vx-underground.org',
        desc:     'Malware geliştirme ve analiz kaynakları',
      },
      {
        platform: 'SANS',
        name:     'FOR610: Reverse Engineering Malware',
        level:    'Expert',
        free:     'No',
        link:     'https://www.sans.org/cyber-security-courses/reverse-engineering-malware-malware-analysis-tools-techniques/',
        desc:     'GREM sertifikasına hazırlık',
      },
    ],
  },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  TryHackMe:           'border-red-400/30 text-red-400',
  Coursera:            'border-blue-400/30 text-blue-400',
  Cybrary:             'border-cyan-400/30 text-cyan-400',
  YouTube:             'border-rose-500/30 text-rose-400',
  SANS:                'border-amber-400/30 text-amber-400',
  'HackTheBox Academy':'border-green-400/30 text-green-400',
  HackTheBox:          'border-green-500/30 text-green-400',
  Udemy:               'border-purple-400/30 text-purple-400',
  PortSwigger:         'border-orange-400/30 text-orange-400',
  'Offensive Security':'border-red-500/30 text-red-500',
  'TCM Security':      'border-teal-400/30 text-teal-400',
  'Zero-Point Security':'border-slate-400/30 text-slate-300',
  'VX Underground':    'border-rose-400/30 text-rose-400',
};

const LEVEL_DOT: Record<Level, string> = {
  Beginner:     'bg-green-400',
  Intermediate: 'bg-amber-400',
  Advanced:     'bg-orange-400',
  Expert:       'bg-red-500',
};

const FREE_BADGE: Record<FreeTier, string> = {
  Yes:     'border-green-500/30 text-green-400',
  No:      'border-red-500/30 text-red-400',
  Audit:   'border-blue-500/30 text-blue-400',
  Partial: 'border-amber-500/30 text-amber-400',
};

const FREE_LABEL: Record<FreeTier, string> = {
  Yes:     'ÜCRETSİZ',
  No:      'ÜCRETLİ',
  Audit:   'DENETİM',
  Partial: 'KISMİ',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CourseCard({ course }: { course: Course }) {
  const platformColor = PLATFORM_COLORS[course.platform] ?? 'border-slate-500/30 text-slate-400';

  return (
    <div className="bg-[#070709] border border-white/10 p-4 hover:border-amber-400/40 transition-all duration-200 flex flex-col gap-2">
      {/* Top row: platform + level dot + free badge */}
      <div className="flex items-start justify-between gap-2">
        <span className={`text-[9px] font-mono border px-1.5 py-0.5 tracking-wider uppercase leading-tight ${platformColor}`}>
          {course.platform}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${LEVEL_DOT[course.level]}`} />
          <span className={`text-[9px] font-mono border px-1.5 py-0.5 tracking-wider uppercase ${FREE_BADGE[course.free]}`}>
            {FREE_LABEL[course.free]}
          </span>
        </div>
      </div>

      {/* Course title */}
      <h3 className="text-slate-200 text-xs font-mono font-bold leading-snug">
        {course.name}
      </h3>

      {/* Description */}
      <p className="text-slate-600 text-[10px] flex-1">
        {course.desc}
      </p>

      {/* CTA */}
      <a
        href={course.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-1 inline-block text-amber-400/60 hover:text-amber-400 text-[10px] font-mono transition-colors"
      >
        → KURSA GİT
      </a>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const [activeStage, setActiveStage] = useState<string>('stage-01');
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Track active stage via IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    STAGES.forEach((stage) => {
      const el = sectionRefs.current.get(stage.id);
      if (!el) return;

      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveStage(stage.id); },
        { rootMargin: '-35% 0px -50% 0px', threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen font-mono">

      {/* ── Page header ── */}
      <div className="border-b border-amber-400/10 bg-[#070709]/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <p className="text-amber-400/40 text-[10px] tracking-[0.3em] uppercase mb-3">
            {'>'} classification: public {'//'}  status: active
          </p>
          <h1 className="text-amber-400 text-xl md:text-2xl tracking-[0.2em] uppercase font-bold mb-2">
            [ CYBERSECURITY TRAINING MATRIX ]
          </h1>
          <p className="text-slate-500 text-sm">
            Acemiden Uzmana — Yapılandırılmış Öğrenme Yolu
          </p>

          {/* Stage progress bar */}
          <div className="flex items-center gap-3 mt-6">
            {STAGES.map((stage, i) => (
              <button
                key={stage.id}
                onClick={() => scrollTo(stage.id)}
                className="flex items-center gap-2 group"
              >
                <span
                  className={`text-[9px] tracking-widest transition-colors ${
                    activeStage === stage.id
                      ? 'text-amber-400'
                      : 'text-slate-600 group-hover:text-slate-400'
                  }`}
                >
                  {stage.number}
                </span>
                {i < STAGES.length - 1 && (
                  <span className="text-slate-800 text-[10px]">──</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12">

        {/* Mobile tabs */}
        <nav className="lg:hidden flex gap-2 overflow-x-auto pb-4 mb-10 scrollbar-hide">
          {STAGES.map((stage) => (
            <button
              key={stage.id}
              onClick={() => scrollTo(stage.id)}
              className={`flex-shrink-0 px-3 py-1.5 text-[10px] tracking-widest border transition-all ${
                activeStage === stage.id
                  ? 'border-amber-400/50 text-amber-400 bg-amber-400/5'
                  : 'border-white/10 text-slate-500 hover:border-amber-400/25 hover:text-slate-400'
              }`}
            >
              STAGE {stage.number}
            </button>
          ))}
        </nav>

        <div className="flex gap-10 lg:gap-16">

          {/* ── Sticky sidebar — desktop only ── */}
          <aside className="hidden lg:flex flex-col items-center w-6 flex-shrink-0">
            <div className="sticky top-28 flex flex-col items-center gap-5">
              {STAGES.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => scrollTo(stage.id)}
                  title={`Stage ${stage.number} — ${stage.title}`}
                  className="relative group flex flex-col items-center"
                >
                  <span
                    className={`block w-2 h-2 rounded-full transition-all duration-200 ${
                      activeStage === stage.id
                        ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                        : 'bg-slate-700 group-hover:bg-slate-500'
                    }`}
                  />
                  <span
                    className={`absolute left-5 text-[9px] whitespace-nowrap tracking-wider transition-colors ${
                      activeStage === stage.id ? 'text-amber-400' : 'text-transparent'
                    }`}
                  >
                    {stage.number}
                  </span>
                </button>
              ))}

              {/* Connecting line behind dots */}
              <div className="absolute top-1 bottom-1 w-px bg-white/5 -z-10" />
            </div>
          </aside>

          {/* ── Stage sections ── */}
          <div className="flex-1 min-w-0 space-y-20">
            {STAGES.map((stage) => (
              <section
                key={stage.id}
                id={stage.id}
                ref={(el) => {
                  if (el) sectionRefs.current.set(stage.id, el);
                }}
                className="scroll-mt-28"
              >
                {/* Stage header */}
                <div className="border-l-2 border-amber-400 pl-4 mb-8">
                  <div className="flex items-baseline gap-4 flex-wrap">
                    <h2 className="text-amber-400 text-sm tracking-[0.2em] uppercase">
                      STAGE {stage.number} — {stage.title}
                    </h2>
                    <span className="text-slate-600 text-[10px] tracking-widest uppercase">
                      TARGET: {stage.target}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">{stage.subtitle}</p>
                </div>

                {/* Course grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {stage.courses.map((course) => (
                    <CourseCard key={course.link} course={course} />
                  ))}
                </div>

                {/* Certification target box */}
                <div className="border border-amber-400/30 bg-amber-400/[0.03] p-3 mt-5">
                  <p className="text-amber-400 text-xs tracking-wider">
                    ◈ HEDEF SERTİFİKA:&nbsp;
                    <span className="text-amber-400/80">{stage.certification}</span>
                  </p>
                </div>
              </section>
            ))}

            {/* Footer note */}
            <div className="border-t border-white/5 pt-8 pb-4">
              <p className="text-slate-700 text-[10px] tracking-wider">
                {'// '}Bu yol haritası tahmini süreleri göstermektedir. Bireysel ilerleme farklılık gösterebilir.
                Tüm bağlantılar üçüncü taraf platformlara aittir.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
