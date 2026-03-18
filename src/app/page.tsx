"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link';
import BlogCard from '@/components/BlogCard';
import CountUp from '@/components/CountUp';
import BootSequence from '@/components/BootSequence';
import InteractiveTerminal from '@/components/InteractiveTerminal';
import ThreatFeed from '@/components/ThreatFeed';
import EmbeddedLogin from '@/components/EmbeddedLogin'
import type { PostMeta } from '@/lib/posts'

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

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [recentPosts, setRecentPosts] = useState<PostMeta[]>([])

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('auth_user') === 'ghost')
  }, [])

  useEffect(() => {
    fetch('/api/posts')
      .then(r => r.json())
      .then((posts: PostMeta[]) => setRecentPosts(posts.slice(0, 3)))
      .catch(() => {})
  }, [])

  return (
    <div>
      {!isLoggedIn
        ? (
          <EmbeddedLogin
            onLogin={() => {
              localStorage.setItem('auth_user', 'ghost')
              setIsLoggedIn(true)
            }}
          />
        )
        : (
          <BootSequence>
            <div>
              {/* ══════════════════ HERO ══════════════════ */}
              <InteractiveTerminal />

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

              {/* ══════════════════ THREAT FEED ══════════════════ */}
              <section className="max-w-5xl mx-auto px-6 py-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-mono text-slate-300 text-sm">
                    <span className="text-amber-400">// </span>tehdit istihbaratı
                  </h2>
                  <span className="font-mono text-[10px] text-amber-400/50 border border-amber-400/20 px-2 py-0.5">
                    CANLI
                  </span>
                </div>
                <ThreatFeed />
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
          </BootSequence>
        )
      }
    </div>
  );
}
