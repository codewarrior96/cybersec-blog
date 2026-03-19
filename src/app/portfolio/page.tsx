import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Portfolio' };

const skills = [
  { name: 'Python', level: 45, tag: 'scripting-basics' },
  { name: 'Linux / Bash', level: 48, tag: 'terminal' },
  { name: 'Network Temelleri', level: 40, tag: 'tcp-ip' },
  { name: 'Web Security Basics', level: 38, tag: 'owasp' },
  { name: 'Burp Suite', level: 35, tag: 'proxy-repeater' },
  { name: 'CTF (Web)', level: 32, tag: 'learning' },
];

const certs = [
  { name: 'Google Cybersecurity Certificate', status: 'progress', color: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/5' },
  { name: 'TryHackMe Learning Path', status: 'progress', color: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/5' },
  { name: 'CompTIA Security+', status: 'planned', color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5' },
  { name: 'eJPT', status: 'planned', color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5' },
];

const projects = [
  {
    name: 'CyberSec Blog',
    desc: 'Kendi öğrenme sürecimi paylaşmak için hazırladığım blog projesi.',
    tech: ['Next.js', 'MDX', 'Tailwind'],
    status: 'live',
    href: '/',
  },
  {
    name: 'Mini Port Scanner',
    desc: 'Python ile temel TCP port kontrolü yapan küçük bir öğrenme projesi.',
    tech: ['Python', 'socket'],
    status: 'planned',
    href: '#',
  },
  {
    name: 'CTF Notlari',
    desc: 'Çözdüğüm başlangıç seviye CTF sorularının kısa çözüm arşivi.',
    tech: ['Markdown', 'Linux'],
    status: 'live',
    href: '/blog',
  },
];

const timeline = [
  { year: '2024', event: 'Linux ve terminal komutlarına giriş yaptım.', dot: 'bg-slate-600' },
  { year: '2024', event: 'Python temelini öğrenmeye başladım (dosya, fonksiyon, script).', dot: 'bg-slate-600' },
  { year: '2025', event: 'Ağ temelleri: TCP/IP, Wireshark ve Nmap başlangıç pratiği.', dot: 'bg-cyan-500' },
  { year: '2025', event: 'OWASP Top 10 ve Burp Suite ile temel web güvenlik çalışmaları.', dot: 'bg-cyan-500' },
  { year: '2026', event: 'Blogu yayına alıp düzenli writeup paylaşmaya başladım.', dot: 'bg-green-400' },
  { year: 'Şimdi', event: '90 günlük plan: haftalık çalışma + aylık 1 mini proje + düzenli not.', dot: 'bg-green-400 shadow-[0_0_8px_#00ff41]' },
];

export default function PortfolioPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="mb-14">
        <p className="font-mono text-slate-500 text-sm mb-3">
          <span className="text-green-400">guest</span>@cybersec:~$
          <span className="text-slate-300 ml-2">cat portfolio.json</span>
        </p>
        <h1 className="text-3xl font-bold text-slate-100 font-mono">
          <span className="text-green-400">// </span>Portfolio
        </h1>
      </div>

      <section className="mb-16">
        <h2 className="font-mono text-green-400/80 text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
          <span className="text-green-400/40">01</span> Beceriler
        </h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {skills.map((skill, i) => (
            <div key={skill.name} className="space-y-2">
              <div className="flex items-center justify-between font-mono text-sm">
                <span className="text-slate-300">{skill.name}</span>
                <span className="text-green-400 text-xs">{skill.level}%</span>
              </div>
              <div className="skill-bar-bg">
                <div
                  className="skill-bar-fill"
                  style={{
                    width: `${skill.level}%`,
                    animationDelay: `${i * 0.12}s`,
                  }}
                />
              </div>
              <span className="text-xs font-mono text-slate-600">#{skill.tag}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="font-mono text-green-400/80 text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
          <span className="text-green-400/40">02</span> Sertifikalar
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {certs.map((cert) => (
            <div
              key={cert.name}
              className={`flex items-center justify-between p-4 rounded-xl border font-mono text-sm ${cert.color}`}
            >
              <span>{cert.name}</span>
              <span className="text-xs opacity-70 border border-current rounded px-2 py-0.5">
                {cert.status === 'planned' ? 'planlanan' : 'devam ediyor'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="font-mono text-green-400/80 text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
          <span className="text-green-400/40">03</span> Projeler
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {projects.map((proj) => (
            <Link
              key={proj.name}
              href={proj.href}
              className="card-hover p-5 bg-[#0f0f1a] block group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-mono font-semibold text-slate-200 group-hover:text-green-400 transition-colors text-sm">
                  {proj.name}
                </h3>
                {proj.status === 'live' ? (
                  <span className="text-xs font-mono text-green-400 border border-green-400/30 rounded px-1.5 py-0.5 shrink-0 ml-2">
                    live
                  </span>
                ) : (
                  <span className="text-xs font-mono text-slate-600 border border-slate-700 rounded px-1.5 py-0.5 shrink-0 ml-2">
                    soon
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs leading-relaxed mb-4">{proj.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {proj.tech.map((t) => (
                  <span
                    key={t}
                    className="text-xs font-mono px-2 py-0.5 bg-green-400/5 border border-green-400/15 text-green-400/70 rounded"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-mono text-green-400/80 text-xs uppercase tracking-widest mb-8 flex items-center gap-2">
          <span className="text-green-400/40">04</span> Öğrenme Yolculuğu
        </h2>
        <div className="relative pl-8">
          <div className="absolute left-2.5 top-0 bottom-0 w-px bg-gradient-to-b from-green-400/30 via-green-400/15 to-transparent" />

          <div className="space-y-6">
            {timeline.map((item, i) => (
              <div key={i} className="relative flex items-start gap-4">
                <div className={`absolute -left-6 mt-1 w-2.5 h-2.5 rounded-full border border-[#08080f] ${item.dot}`} />
                <div>
                  <span className="font-mono text-green-400 text-xs font-bold">{item.year}</span>
                  <p className="font-mono text-slate-400 text-sm mt-0.5">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

