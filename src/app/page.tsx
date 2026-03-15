import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import BlogCard from '@/components/BlogCard';

export default async function HomePage() {
  const posts = await getAllPosts();
  const recentPosts = posts.slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto px-6">
      {/* Hero — Terminal */}
      <section className="py-24 md:py-32">
        <div className="font-mono space-y-3">
          <p className="text-slate-500 text-sm">
            <span className="text-green-400">guest</span>
            <span className="text-slate-600">@cybersec</span>
            <span className="text-slate-500">:~$</span>
          </p>

          <div className="space-y-1">
            <p className="text-slate-400 text-sm">
              <span className="text-slate-600 mr-2">$</span>whoami
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-100 leading-tight pl-4">
              Siber Güvenlik
              <br />
              <span className="text-green-400 glow-green">Araştırmacısı</span>
            </h1>
          </div>

          <div className="pt-4 space-y-1">
            <p className="text-slate-400 text-sm">
              <span className="text-slate-600 mr-2">$</span>cat topics.txt
            </p>
            <div className="pl-4 flex flex-wrap gap-3">
              {['Penetrasyon Testi', 'CTF Writeup', 'Malware Analizi', 'OSINT', 'Web Güvenliği'].map(
                (topic) => (
                  <span
                    key={topic}
                    className="px-3 py-1 rounded border border-slate-700 text-slate-300 text-sm hover:border-green-500/50 hover:text-green-400 transition-colors cursor-default"
                  >
                    {topic}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="pt-4 flex items-center gap-1 text-slate-400 text-sm">
            <span className="text-slate-600">$</span>
            <span className="cursor-blink text-green-400">█</span>
          </div>
        </div>

        <div className="mt-12 flex gap-4">
          <Link
            href="/blog"
            className="px-5 py-2.5 bg-green-400 text-gray-950 font-mono font-semibold rounded-lg text-sm hover:bg-green-300 transition-colors"
          >
            Yazıları Gör →
          </Link>
          <Link
            href="/about"
            className="px-5 py-2.5 border border-slate-700 text-slate-300 font-mono text-sm rounded-lg hover:border-slate-500 hover:text-slate-100 transition-colors"
          >
            Hakkımda
          </Link>
        </div>
      </section>

      {/* Son Yazılar */}
      {recentPosts.length > 0 && (
        <section className="pb-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-mono text-slate-300 text-lg">
              <span className="text-green-400">// </span>son yazılar
            </h2>
            <Link href="/blog" className="font-mono text-sm text-slate-500 hover:text-green-400 transition-colors">
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
