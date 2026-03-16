import Link from 'next/link';
import { PostMeta } from '@/lib/posts';

function DifficultyDot({ tag }: { tag: string }) {
  const hard = ['buffer-overflow', 'active-directory', 'reverse-shell', 'malware'];
  const med  = ['sql-injection', 'xss', 'web', 'network', 'pentest'];
  const t = tag.toLowerCase();
  if (hard.some((k) => t.includes(k)))
    return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" title="Zor" />;
  if (med.some((k) => t.includes(k)))
    return <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" title="Orta" />;
  return <span className="w-2 h-2 rounded-full bg-green-400 inline-block" title="Kolay" />;
}

export default function BlogCard({ post }: { post: PostMeta }) {
  const formattedDate = post.date
    ? new Date(post.date).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const primaryTag = post.tags?.[0] ?? 'genel';

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block card-hover glitch-hover p-6 bg-[#0f0f1a]"
    >
      {/* Tags + date */}
      <div className="flex items-center justify-between mb-3">
        {post.tags && post.tags.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {post.tags.slice(0, 2).map((tag: string) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded font-mono text-xs bg-green-400/8 text-green-400/80 border border-green-400/20"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="px-2 py-0.5 rounded font-mono text-xs bg-green-400/8 text-green-400/80 border border-green-400/20">
            #genel
          </span>
        )}
        <div className="flex items-center gap-2">
          <DifficultyDot tag={primaryTag} />
          <time className="text-xs text-slate-500 font-mono">{formattedDate}</time>
        </div>
      </div>

      {/* Title with terminal cursor */}
      <h2 className="text-lg font-semibold text-slate-100 mb-2 group-hover:text-green-400 transition-colors duration-200 font-mono flex items-start gap-2">
        <span className="text-green-400 shrink-0 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">›</span>
        <span>{post.title}</span>
      </h2>

      {post.description && (
        <p className="text-slate-400 text-sm leading-relaxed line-clamp-2 pl-5">{post.description}</p>
      )}

      {/* Footer: read more + reading time */}
      <div className="mt-4 pl-5 flex items-center justify-between">
        <div className="flex items-center gap-1 text-green-400 text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span>okumaya devam et</span>
          <span>→</span>
        </div>
        {post.readingTime != null && (
          <span className="text-xs text-slate-600 font-mono">
            ~{post.readingTime} dk
          </span>
        )}
      </div>
    </Link>
  );
}
