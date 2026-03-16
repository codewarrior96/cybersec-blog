'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { PostMeta } from '@/lib/posts';

export default function SearchModal({ posts }: { posts: PostMeta[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered =
    query.trim() === ''
      ? posts.slice(0, 8)
      : posts.filter(
          (p) =>
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.tags?.some((t) => t.toLowerCase().includes(query.toLowerCase()))
        );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-[#0f0f1a] border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <span className="text-green-400 font-mono text-sm">$</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="başlık veya etiket ara..."
            className="flex-1 bg-transparent font-mono text-sm text-slate-100 placeholder-slate-600 outline-none"
          />
          <kbd className="text-xs text-slate-600 font-mono border border-slate-700 rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-slate-500 font-mono text-sm">
              sonuç bulunamadı
            </p>
          ) : (
            filtered.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors group border-b border-slate-800/50 last:border-0"
              >
                <span className="text-green-400 font-mono text-xs mt-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                  ›
                </span>
                <div className="min-w-0">
                  <p className="text-slate-200 text-sm font-medium group-hover:text-green-400 transition-colors truncate">
                    {post.title}
                  </p>
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex gap-2 mt-1">
                      {post.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs text-cyan-400/60 font-mono">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {post.readingTime && (
                  <span className="ml-auto text-xs text-slate-600 font-mono shrink-0 mt-0.5">
                    {post.readingTime} dk
                  </span>
                )}
              </Link>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-600 font-mono">⌘K / Ctrl+K ile aç/kapat</span>
          <span className="text-xs text-slate-600 font-mono">{filtered.length} sonuç</span>
        </div>
      </div>
    </div>
  );
}
