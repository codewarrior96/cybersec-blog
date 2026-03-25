import { getAllPosts } from '@/lib/posts';
import BlogCard from '@/components/BlogCard';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Blog' };

export default async function BlogPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const posts = await getAllPosts();
  const q = (searchParams.q ?? '').trim().toLowerCase();

  const filtered = q
    ? posts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      )
    : posts;

  /* ── sidebar data ─────────────────────────────── */
  const tagCounts: Record<string, number> = {};
  for (const post of posts) {
    for (const tag of post.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const categories = [
    { label: 'CTF',       keys: ['ctf', 'writeup'] },
    { label: 'Web',       keys: ['web', 'xss', 'sql'] },
    { label: 'Linux',     keys: ['linux', 'privesc'] },
    { label: 'Network',   keys: ['network', 'wireshark'] },
    { label: 'Pentest',   keys: ['pentest', 'reverse', 'buffer'] },
    { label: 'OSINT',     keys: ['osint', 'recon'] },
  ].map((cat) => ({
    ...cat,
    count: posts.filter((p) =>
      cat.keys.some((k) =>
        (p.tags ?? []).some((t) => t.toLowerCase().includes(k)) ||
        p.title.toLowerCase().includes(k)
      )
    ).length,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:px-6 md:py-16">
      {/* Header */}
      <div className="mb-10">
        <p className="font-mono text-slate-500 text-sm mb-2">
          <span className="text-green-400">guest</span>@cybersec:~$
          <span className="text-slate-300 ml-2">ls -la ./posts/</span>
        </p>
        <h1 className="text-3xl font-bold text-slate-100 font-mono">
          <span className="text-green-400">// </span>
          {q ? `"${q}" araması` : 'Tüm Yazılar'}
        </h1>
        <p className="text-slate-500 mt-1 text-sm font-mono">
          {filtered.length}/{posts.length} yazı
          {q && (
            <a href="/blog" className="ml-3 text-green-400/70 hover:text-green-400 transition-colors">
              [× temizle]
            </a>
          )}
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* ── Main content ── */}
        <main className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="border border-slate-800 rounded-xl p-12 text-center">
              <p className="font-mono text-slate-500 text-sm">
                <span className="text-yellow-400">warning:</span> sonuç bulunamadı.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </main>

        {/* ── Sidebar (desktop only) ── */}
        <aside className="w-64 shrink-0 hidden lg:block">
          {/* Search */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">Arama</div>
            <form action="/blog" method="get">
              <div className="flex items-center border border-green-400/20 rounded-lg overflow-hidden bg-[#0a0a14] focus-within:border-green-400/50 transition-colors">
                <span className="px-3 text-green-400 font-mono text-sm select-none">$</span>
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="başlık veya etiket..."
                  className="flex-1 bg-transparent py-2 pr-3 text-sm font-mono text-slate-300 outline-none placeholder-slate-700"
                  autoComplete="off"
                />
              </div>
            </form>
          </div>

          {/* Categories */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">Kategoriler</div>
            <ul className="space-y-1.5">
              {categories.map((cat) => (
                <li key={cat.label}>
                  <a
                    href={`/blog?q=${cat.label.toLowerCase()}`}
                    className="flex items-center justify-between font-mono text-xs text-slate-400 hover:text-green-400 transition-colors group"
                  >
                    <span className="group-hover:translate-x-0.5 transition-transform">
                      <span className="text-green-400/50 mr-1">›</span>
                      {cat.label}
                    </span>
                    <span className="text-slate-600 group-hover:text-green-400/60 tabular-nums">
                      {cat.count}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Tags cloud */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">Etiketler</div>
            <div className="flex flex-wrap gap-1.5">
              {topTags.map(([tag, count]) => (
                <a
                  key={tag}
                  href={`/blog?q=${encodeURIComponent(tag)}`}
                  className="px-2 py-0.5 font-mono text-xs border border-slate-700 text-slate-500 rounded hover:border-green-400/50 hover:text-green-400 transition-all"
                >
                  #{tag}
                  <span className="text-slate-700 ml-1">{count}</span>
                </a>
              ))}
            </div>
          </div>

          {/* About mini */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">Hakkımda</div>
            <p className="font-mono text-xs text-slate-500 leading-relaxed">
              Siber güvenlik araştırmacısı. CTF çözüyorum, sızma testi öğreniyorum, burada paylaşıyorum.
            </p>
            <a
              href="/about"
              className="mt-3 inline-block font-mono text-xs text-green-400/70 hover:text-green-400 transition-colors"
            >
              → daha fazla
            </a>
          </div>

          {/* Search hint */}
          <div className="font-mono text-xs text-slate-700 text-center mt-2">
            <kbd className="border border-slate-800 rounded px-1.5 py-0.5 text-slate-600">Ctrl</kbd>
            {' + '}
            <kbd className="border border-slate-800 rounded px-1.5 py-0.5 text-slate-600">K</kbd>
            {' '}global arama
          </div>
        </aside>
      </div>
    </div>
  );
}
