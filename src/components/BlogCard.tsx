import Link from 'next/link';
import { PostMeta } from '@/lib/posts';

export default function BlogCard({ post }: { post: PostMeta }) {
  const formattedDate = post.date
    ? new Date(post.date).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <Link href={`/blog/${post.slug}`} className="group block card-hover p-6 bg-[#0f0f1a]">
      <div className="flex items-center justify-between mb-4">
        {post.tags && post.tags.length > 0 ? (
          <div className="flex gap-2">
            {post.tags.slice(0, 2).map((tag: string) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded font-mono text-xs bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="px-2 py-0.5 rounded font-mono text-xs bg-green-400/10 text-green-400 border border-green-400/20">
            genel
          </span>
        )}
        <time className="text-xs text-slate-500 font-mono">{formattedDate}</time>
      </div>

      <h2 className="text-lg font-semibold text-slate-100 mb-2 group-hover:text-green-400 transition-colors duration-200">
        {post.title}
      </h2>

      {post.description && (
        <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">{post.description}</p>
      )}

      <div className="mt-4 flex items-center gap-1 text-green-400 text-sm font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span>okumaya devam et</span>
        <span>→</span>
      </div>
    </Link>
  );
}
