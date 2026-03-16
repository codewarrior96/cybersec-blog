import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import BlogCard from '@/components/BlogCard';
import MatrixRain from '@/components/MatrixRain';
import CountUp from '@/components/CountUp';

const categories = [
  { name: 'CTF Writeups',    abbr: 'CTF', desc: 'Yarışma çözümleri' },
  { name: 'Web Security',    abbr: 'WEB', desc: 'XSS, SQLi, CSRF...' },
  { name: 'Linux',           abbr: 'NIX', desc: 'Privesc & araçlar' },
  { name: 'Network',         abbr: 'NET', desc: 'Protokol analizi' },
  { name: 'OSINT',           abbr: 'OSI', desc: 'Açık kaynak istihbarat' },
  { name: 'Pentest',         abbr: 'PEN', desc: 'Sızma testi teknikleri' },
];

const stats = [
  { label: 'Writeup',     value: 8,    suffix: '+' },
  { label: 'Konu',        value: 6,    suffix: '+' },
  { label: 'Satır Kod',   value: 1337, suffix: ''  },
  { label: 'CVE İnceleme',value: 42,   suffix: '+' },
];

export default async function HomePage() {
  const posts = await getAllPosts();
  const recentPosts = posts.slice(0, 3);

  return (
    <div>
      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden">
        {/* Matrix rain background */}
        <div className="absolute inset-0 opacity-35">
          <MatrixRain />
        </div>

        {/* Gradient vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#08080f]/70 via-[#08080f]/30 to-[#08080f]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#08080f]/80 via-transparent to-[#08080f]/80" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 w-full">
          {/* ASCII box decoration */}
          <div
            className="font-mono text-green-400/40 text-xs leading-tight mb-10 hidden md:block select-none"
            aria-hidden
          >
            <div>┌─────────────────────────────────────────────────────┐</div>
            <div>│  CYBERSEC RESEARCH TERMINAL  //  v2.0.26            │</div>
            <div>│  STATUS: ONLINE  │  THREAT LEVEL: ELEVATED         │</div>
            <div>└─────────────────────────────────────────────────────┘</div>
          </div>

          <div className="font-mono space-y-5">
            {/* Prompt line */}
            <p className="text-slate-500 text-sm">
              <span className="text-green-400">[root@matrix ~]</span>
              <span className="text-slate-600">#</span>
              <span className="text-slate-400 ml-2">whoami</span>
            </p>

            {/* Glitch title */}
            <div>
              <h1 className="text-4xl md:text-6xl font-bold text-slate-100 leading-tight">
                <span
                  className="glitch-text block"
                  data-text="Siber Güvenlik"
                >
                  Siber Güvenlik
                </span>
                <span className="neon-text text-4xl md:text-6xl font-bold">
                  Araştırmacısı
                </span>
              </h1>
            </div>

            {/* Mission */}
            <div className="space-y-1 pt-1">
              <p className="text-slate-500 text-sm">
                <span className="text-green-400">$</span>
                <span className="ml-2">cat mission.txt</span>
              </p>
              <p className="text-slate-300 pl-4 text-sm border-l border-green-400/20">
                → CTF çözümleri, sızma testi teknikleri ve güvenlik araştırmaları
              </p>
            </div>

            {/* Topics */}
            <div className="space-y-1">
              <p className="text-slate-500 text-sm">
                <span className="text-green-400">$</span>
                <span className="ml-2">ls ./topics/</span>
              </p>
              <div className="pl-4 flex flex-wrap gap-2">
                {['Penetrasyon Testi', 'CTF Writeup', 'Malware Analizi', 'OSINT', 'Web Güvenliği'].map(
                  (topic) => (
                    <span
                      key={topic}
                      className="px-3 py-1 font-mono text-xs border border-green-400/20 text-green-400/70 rounded hover:border-green-400/60 hover:text-green-400 transition-all duration-300 cursor-default"
                    >
                      {topic}
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Blinking cursor */}
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <span className="text-green-400">$</span>
              <span className="cursor-blink text-green-400 text-base">█</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex gap-4 flex-wrap">
            <Link href="/blog" className="neon-btn-solid">
              ./blog --list →
            </Link>
            <Link href="/portfolio" className="neon-btn">
              ./portfolio
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════ STATS ══════════════════ */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <p className="font-mono text-slate-500 text-xs mb-5">
          <span className="text-green-400">$</span>
          <span className="ml-2 text-slate-400">cat stats.json</span>
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="text-3xl font-bold text-green-400 mb-1 glow-green">
                <CountUp to={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-slate-500 text-xs uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ CATEGORIES ══════════════════ */}
      <section className="max-w-5xl mx-auto px-6 pb-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-slate-300 text-sm">
            <span className="text-green-400">// </span>kategoriler
          </h2>
          <Link
            href="/blog"
            className="font-mono text-xs text-slate-500 hover:text-green-400 transition-colors"
          >
            tüm yazılar →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link key={cat.name} href="/blog" className="category-card group">
              <div className="font-mono text-green-400 text-xs mb-3 border border-green-400/30 rounded px-2 py-0.5 inline-block group-hover:border-green-400/70 group-hover:bg-green-400/5 transition-all">
                [{cat.abbr}]
              </div>
              <div className="font-mono text-slate-200 font-semibold text-sm group-hover:text-green-400 transition-colors">
                {cat.name}
              </div>
              <div className="font-mono text-slate-600 text-xs mt-1">{cat.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════ RECENT POSTS ══════════════════ */}
      {recentPosts.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-mono text-slate-300 text-sm">
              <span className="text-green-400">// </span>son yazılar
            </h2>
            <Link
              href="/blog"
              className="font-mono text-xs text-slate-500 hover:text-green-400 transition-colors"
            >
              tümünü gör →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
