import { getAllPosts } from '@/lib/posts';
import BlogCard from '@/components/BlogCard';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Blog' };

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      {/* Başlık */}
      <div className="mb-12">
        <p className="font-mono text-slate-500 text-sm mb-2">
          <span className="text-green-400">guest</span>@cybersec:~$
          <span className="text-slate-300"> ls ./posts/</span>
        </p>
        <h1 className="text-3xl font-bold text-slate-100">
          Tüm Yazılar
        </h1>
        <p className="text-slate-400 mt-2 text-sm">
          {posts.length} yazı bulundu
        </p>
      </div>

      {/* Liste */}
      {posts.length === 0 ? (
        <div className="border border-slate-800 rounded-xl p-12 text-center">
          <p className="font-mono text-slate-500 text-sm">
            <span className="text-yellow-400">warning:</span> henüz yazı yok.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
